/**
 * @tang-slidex/editor — EditManager
 *
 * 第一层（WYSIWYG）编辑管理器。
 * 职责：
 *   - 进入/退出编辑模式
 *   - 收集用户的可视化操作 → WysiwygPatch[]
 *   - POST /api/save-slide 提交 patches
 *   - 支持 Ctrl+Z 撤销（POST /api/undo）
 *
 * 与其他模块解耦：
 *   - 通过 EditManagerOptions 注入依赖（slideStage、getCurrentIndex 等）
 *   - 不直接引用 index.html 的全局变量
 *   - UI 更新通过 onStateChange 回调通知宿主
 */

import type {
  WysiwygPatch, LineAnchor, Anchor,
  SaveSlideRequest, SaveSlideResponse,
} from './types.js'
import { getAnchor, cleanInjectAttrs, decodeHtmlEntities } from './patchHelpers.js'

export type ResizeDirection =
  | 'n' | 's' | 'e' | 'w'
  | 'ne' | 'nw' | 'se' | 'sw'

export interface EditManagerOptions {
  /** slide 舞台（直接注入 DOM 方案，非 Shadow DOM） */
  slideStage: HTMLElement
  /** 获取当前 slide index（0-based） */
  getCurrentIndex: () => number
  /** 缩放比例（用于拖拽坐标换算） */
  getCurrentScale: () => number
  /** 状态变化时通知宿主（用于更新导航栏 UI） */
  onStateChange?: (active: boolean) => void
  /** 显示 toast 消息（可选，由宿主实现） */
  showToast?: (msg: string, type?: 'success' | 'error' | 'info') => void
  /** 保存端点（默认 /api/save-slide） */
  saveEndpoint?: string
  /** 撤销端点（默认 /api/undo） */
  undoEndpoint?: string
  /** 拖拽中回调（用于宿主更新 overlay / 辅助线） */
  onDragMove?: (el: HTMLElement) => void
  /** 拖拽结束回调 */
  onDragEnd?: () => void
  /** 元素被点击回调（用于宿主更新选中框） */
  onElementClick?: (el: HTMLElement) => void
}

// 不可编辑的标签
const NON_EDITABLE_TAGS = new Set(['CANVAS', 'SVG', 'SCRIPT', 'STYLE', 'PRE', 'CODE'])
// 不可拖拽的标签
const NON_DRAGGABLE_TAGS = new Set(['STYLE', 'CANVAS', 'SCRIPT'])

export class EditManager {
  active = false

  patches: WysiwygPatch[] = []
  private snapshots = new Map<Element, string>()    // 文本快照（用于 _onTextBlur 检测变更）
  private blockSnapshots = new Map<Element, string>() // .slide 直接子元素的完整 outerHTML 快照（用于放弃还原）
  private dragState: {
    el: HTMLElement
    startX: number; startY: number
    baseX: number; baseY: number
    dx: number; dy: number
  } | null = null

  private resizeState: {
    el: HTMLElement
    dir: ResizeDirection
    startX: number; startY: number
    baseW: number; baseH: number
    baseX: number; baseY: number  // base translate
    scale: number
  } | null = null

  private rotateState: {
    el: HTMLElement
    cx: number; cy: number    // 元素中心（screen coords）
    baseRad: number            // 开始时的旋转角（radians）
    baseDeg: number            // 开始时的旋转角（degrees）
  } | null = null

  private readonly opts: Required<Omit<EditManagerOptions, 'onDragMove'|'onDragEnd'|'onElementClick'>> & Pick<EditManagerOptions, 'onDragMove'|'onDragEnd'|'onElementClick'>

  constructor(options: EditManagerOptions) {
    this.opts = {
      saveEndpoint: '/api/save-slide',
      undoEndpoint: '/api/undo',
      onStateChange: () => {},
      showToast: () => {},
      ...options,
    }
  }

  // ─── 公开 API ──────────────────────────────────────────────────────────────

  /** 进入编辑模式 */
  enable(): void {
    if (this.active) return
    this.active = true
    this.patches = []
    this.snapshots.clear()
    this.blockSnapshots.clear()  // 确保从干净状态开始
    this.opts.slideStage.classList.add('tang-edit-mode')
    this._bindSlide()
    this.opts.onStateChange(true)
  }

  /** 退出编辑模式（不保存，还原所有改动） */
  disable(): void {
    if (!this.active) return
    this.active = false
    this._restoreSnapshots()   // 用 outerHTML 快照完整还原
    this._cleanup()
    this.opts.onStateChange(false)
  }

  /** 保存（仅提交 patches，不退出编辑模式；patches 清空后继续编辑） */
  async save(): Promise<void> {
    if (!this.active) return
    if (this.patches.length === 0) {
      this.opts.showToast('✓ 无改动', 'info')
      return
    }
    try {
      const body: SaveSlideRequest = {
        slideIndex: this.opts.getCurrentIndex(),
        patches: this.patches,
      }
      const res = await fetch(this.opts.saveEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data: SaveSlideResponse = await res.json()
      if (data.ok) {
        this.opts.showToast('💾 已保存', 'success')
        // 保存成功：重置 patches，重拍快照（以新保存的状态为基准），rebind
        this.patches = []
        this.snapshots.clear()
        this.blockSnapshots.clear()  // 清空旧快照，让 _bindSlide 重拍（以保存后状态为新基准）
        this._cleanup(false)
        this._bindSlide()
        this.opts.onStateChange(true)
      } else {
        this.opts.showToast(`❌ 保存失败: ${data.error}`, 'error')
      }
    } catch (err) {
      this.opts.showToast('❌ 网络错误', 'error')
      console.error('[EditManager] save error:', err)
    }
  }

  /** 撤销上一次保存（Ctrl+Z）：文件级回滚 + 重新加载当前 slide */
  async undo(): Promise<void> {
    const idx = this.opts.getCurrentIndex()
    const num = String(idx + 1).padStart(3, '0')
    try {
      const res = await fetch(this.opts.undoEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ file: `slides/slide-${num}.html` }),
      })
      const data = await res.json()
      if (data.ok) {
        this.opts.showToast('↩️ 已撤销', 'info')
        // 文件已还原，重新加载当前 slide 让 DOM 同步
        document.dispatchEvent(new CustomEvent('tang:reload-slide', { detail: { index: idx } }))
      } else {
        this.opts.showToast(data.message ?? '无更多历史', 'info')
      }
    } catch (err) {
      console.error('[EditManager] undo error:', err)
    }
  }

  /**
   * 切换到新 slide 后重新绑定（editManager.active 时调用）
   */
  rebind(): void {
    if (!this.active) return
    this._cleanup(false)
    this.snapshots.clear()
    this.blockSnapshots.clear()  // 换页后旧引用失效，清空让新页重拍快照
    this._bindSlide()
  }

  /**
   * 删除元素（记录 patch，DOM 隐藏）
   */
  deleteElement(el: Element): void {
    if (!this.active) return
    const anchor = getAnchor(el, this.opts.slideStage)
    if (anchor.type !== 'line') return
    this.patches.push({ type: 'delete', anchor })
    ;(el as HTMLElement).style.display = 'none'
  }

  /**
   * 从 overlay 边框区域发起移动拖拽（由 React 侧的 overlay mousedown 调用）
   */
  startDrag(el: HTMLElement, clientX: number, clientY: number): void {
    if (!this.active) return
    const scale = this.opts.getCurrentScale()
    const parts0 = _getTransformParts(el.style.transform || '')
    const baseX = parts0.tx
    const baseY = parts0.ty

    el.classList.add('tang-dragging')
    this.dragState = { el, startX: clientX, startY: clientY, baseX, baseY, dx: 0, dy: 0 }

    const onMove = (ev: MouseEvent) => {
      if (!this.dragState) return
      const dx = (ev.clientX - clientX) / scale
      const dy = (ev.clientY - clientY) / scale
      this.dragState.dx = dx
      this.dragState.dy = dy
      const cur = _getTransformParts(el.style.transform || '')
      el.style.transform = _buildTransform({ ...cur, tx: baseX + dx, ty: baseY + dy })
      this.opts.onDragMove?.(el)
    }

    const onUp = () => {
      if (!this.dragState) return
      el.classList.remove('tang-dragging')
      const { dx, dy } = this.dragState
      if (Math.abs(dx) > 2 || Math.abs(dy) > 2) {
        const anchor = getAnchor(el, this.opts.slideStage)
        if (anchor.type === 'line') {
          this.patches = this.patches.filter(
            p => !(p.type === 'move' && _anchorKey(p.anchor) === _anchorKey(anchor))
          )
          // dx/dy 存绝对坐标（与 slideSavePlugin translate 写法一致）
          this.patches.push({ type: 'move', anchor, dx: Math.round(baseX + dx), dy: Math.round(baseY + dy) })
        }
      }
      this.dragState = null
      this.opts.onDragEnd?.()
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
    }

    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }

  /**
   * 从 overlay 的角/边手柄发起缩放（由 React 侧 overlay mousedown 调用）
   * dir: 'n'|'s'|'e'|'w'|'ne'|'nw'|'se'|'sw'
   */
  startResize(el: HTMLElement, clientX: number, clientY: number, dir: ResizeDirection): void {
    if (!this.active) return
    const scale = this.opts.getCurrentScale()
    const cs = getComputedStyle(el)
    const baseW = parseFloat(cs.width)  || el.offsetWidth
    const baseH = parseFloat(cs.height) || el.offsetHeight

    const parts0 = _getTransformParts(el.style.transform || '')
    const baseX = parts0.tx
    const baseY = parts0.ty

    this.resizeState = { el, dir, startX: clientX, startY: clientY, baseW, baseH, baseX, baseY, scale }

    const onMove = (ev: MouseEvent) => {
      if (!this.resizeState) return
      const { baseW: bW, baseH: bH, baseX: bX, baseY: bY } = this.resizeState
      const dx = (ev.clientX - clientX) / scale
      const dy = (ev.clientY - clientY) / scale

      let newW = bW, newH = bH, newX = bX, newY = bY

      // 水平方向
      if (dir.includes('e')) newW = Math.max(40, bW + dx)
      if (dir.includes('w')) { newW = Math.max(40, bW - dx); newX = bX + dx }
      // 垂直方向
      if (dir.includes('s')) newH = Math.max(20, bH + dy)
      if (dir.includes('n')) { newH = Math.max(20, bH - dy); newY = bY + dy }

      el.style.width  = `${newW}px`
      el.style.height = `${newH}px`
      if (dir.includes('w') || dir.includes('n')) {
        // 保留旋转角
        const cur = _getTransformParts(el.style.transform || '')
        el.style.transform = _buildTransform({ ...cur, tx: newX, ty: newY })
      }
      this.opts.onDragMove?.(el)
    }

    const onUp = () => {
      if (!this.resizeState) return
      const cs2 = getComputedStyle(el)
      const w = parseFloat(cs2.width)
      const h = parseFloat(cs2.height)
      const anchor = getAnchor(el, this.opts.slideStage)
      if (anchor.type === 'line') {
        // 写入 resize patch
        this.patches = this.patches.filter(
          p => !(p.type === 'resize' && _anchorKey(p.anchor) === _anchorKey(anchor))
        )
        this.patches.push({ type: 'resize', anchor, width: Math.round(w), height: Math.round(h) })
        // 如果 n/w 方向还改变了位置，也记录 move patch
        const finalParts = _getTransformParts(el.style.transform || '')
        if (finalParts.tx !== this.resizeState.baseX || finalParts.ty !== this.resizeState.baseY) {
          this.patches = this.patches.filter(
            p => !(p.type === 'move' && _anchorKey(p.anchor) === _anchorKey(anchor))
          )
          this.patches.push({ type: 'move', anchor, dx: Math.round(finalParts.tx), dy: Math.round(finalParts.ty) })
        }
      }
      this.resizeState = null
      this.opts.onDragEnd?.()
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
    }

    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }

  /**
   * 从旋转手柄发起旋转操作（由 React 侧 SelectionBox mousedown 调用）
   * 旋转以元素 BoundingRect 中心为轴。
   */
  startRotate(el: HTMLElement, startClientX: number, startClientY: number): void {
    if (!this.active) return
    const rect = el.getBoundingClientRect()
    const cx = rect.left + rect.width  / 2
    const cy = rect.top  + rect.height / 2

    // 读取当前已有的旋转角（保持与现有 transform 的连续性）
    const parts = _getTransformParts(el.style.transform)
    const baseDeg = parts.deg

    // 鼠标相对元素中心的初始角度
    const startAngle = Math.atan2(startClientY - cy, startClientX - cx)
    // baseRad = 当前旋转角对应的 rad（用于减法计算增量）
    const baseRad = baseDeg * (Math.PI / 180)

    this.rotateState = { el, cx, cy, baseRad, baseDeg }

    const onMove = (ev: MouseEvent) => {
      if (!this.rotateState) return
      const angle = Math.atan2(ev.clientY - cy, ev.clientX - cx)
      const deltaDeg = (angle - startAngle) * (180 / Math.PI)
      const newDeg = Math.round(baseDeg + deltaDeg)
      const parts2 = _getTransformParts(el.style.transform)
      el.style.transform = _buildTransform({ ...parts2, deg: newDeg })
      this.opts.onDragMove?.(el)
    }

    const onUp = () => {
      if (!this.rotateState) return
      const parts2 = _getTransformParts(el.style.transform)
      const finalDeg = parts2.deg
      const anchor = getAnchor(el, this.opts.slideStage)
      if (anchor.type === 'line') {
        this.patches = this.patches.filter(
          p => !(p.type === 'rotate' && _anchorKey(p.anchor) === _anchorKey(anchor))
        )
        this.patches.push({ type: 'rotate', anchor, deg: finalDeg })
      }
      this.rotateState = null
      this.opts.onDragEnd?.()
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
    }

    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }

  /**
   * 向 patches 中记录一条 style 属性修改（供工具面板调用）
   */
  applyStyleProp(el: Element, property: string, value: string): void {
    if (!this.active) return
    const anchor = getAnchor(el, this.opts.slideStage)
    if (anchor.type !== 'line') return
    this.patches = this.patches.filter(
      p => !(p.type === 'style-prop' && _anchorKey(p.anchor) === _anchorKey(anchor))
    )
    this.patches.push({ type: 'style-prop', anchor, property, value })
    // 实时应用到 DOM（视觉反馈）
    ;(el as HTMLElement).style.setProperty(property, value)
  }

  /**
   * 设置 HTML attribute（供工具面板调用，如 data-liquid-glass）
   * value 为空字符串时移除该属性
   */
  applyAttr(el: Element, attr: string, value: string): void {
    if (!this.active) return
    const anchor = getAnchor(el, this.opts.slideStage)
    if (anchor.type !== 'line') return
    // 去掉同一元素同一 attr 的旧 patch，保持幂等
    this.patches = this.patches.filter(
      p => !(p.type === 'attr-set' && _anchorKey(p.anchor) === _anchorKey(anchor) && p.attr === attr)
    )
    if (value !== '') {
      this.patches.push({ type: 'attr-set', anchor, attr, value })
      ;(el as HTMLElement).setAttribute(attr, value)
    } else {
      // 空字符串 = 移除属性；补一个 attr-set value='' 让 save 端清除
      this.patches.push({ type: 'attr-set', anchor, attr, value: '' })
      ;(el as HTMLElement).removeAttribute(attr)
    }
  }

  /**
   * 清除 inline style（供清除格式按钮调用）
   */
  clearStyle(el: Element): void {
    if (!this.active) return
    const anchor = getAnchor(el, this.opts.slideStage)
    if (anchor.type !== 'line') return
    // 移除同一元素的所有 style-prop patch（已不再需要）
    this.patches = this.patches.filter(
      p => !(
        (p.type === 'style-prop' || p.type === 'clear-style') &&
        _anchorKey(p.anchor) === _anchorKey(anchor)
      )
    )
    this.patches.push({ type: 'clear-style', anchor })
    // 实时清除 DOM inline style（视觉反馈）
    ;(el as HTMLElement).removeAttribute('style')
  }

  /**
   * 添加 class（供工具面板调用）
   */
  applyClassAdd(el: Element, className: string): void {
    if (!this.active) return
    const anchor = getAnchor(el, this.opts.slideStage)
    if (anchor.type !== 'line') return
    el.classList.add(className)
    this.patches.push({ type: 'class-add', anchor, className })
  }

  /**
   * 移除 class（供工具面板调用）
   */
  applyClassRemove(el: Element, className: string): void {
    if (!this.active) return
    const anchor = getAnchor(el, this.opts.slideStage)
    if (anchor.type !== 'line') return
    el.classList.remove(className)
    this.patches.push({ type: 'class-remove', anchor, className })
  }

  // ─── 私有：绑定当前 slide ──────────────────────────────────────────────────

  private _bindSlide(): void {
    const slide = this.opts.slideStage.querySelector('.slide')
    if (!slide) return

    // 0. 对 .slide 每个直接子元素拍 outerHTML 快照（用于放弃时完整还原）
    //    只在首次绑定时拍（rebind 时不覆盖，否则会记录编辑中状态）
    Array.from(slide.children).forEach(child => {
      if (!this.blockSnapshots.has(child)) {
        this.blockSnapshots.set(child, (child as HTMLElement).outerHTML)
      }
    })

    // 1. 绑定代码块编辑（textarea 浮层）
    this._bindCodeBlocks()

    // 2. 绑定文本可编辑
    const textEls = this._collectTextElements(slide)
    textEls.forEach(el => {
      if (!this.snapshots.has(el)) this.snapshots.set(el, el.textContent ?? '')
      ;(el as HTMLElement).contentEditable = 'true'
      el.classList.add('tang-editable')
      el.addEventListener('blur', () => this._onTextBlur(el), { once: false })
    })

    // 3. 只添加 tang-draggable class（拖拽由 overlay 的 startDrag 公开方法触发）
    Array.from(slide.children).forEach(child => {
      if (NON_DRAGGABLE_TAGS.has(child.tagName)) return
      child.classList.add('tang-draggable')
    })
  }

  private _bindCodeBlocks(): void {
    this.opts.slideStage.querySelectorAll('pre code[data-highlighted]').forEach(codeEl => {
      const pre = codeEl.closest('pre') as HTMLElement | null
      if (!pre || pre.dataset['editBound']) return
      pre.dataset['editBound'] = '1'

      const raw = (codeEl as HTMLElement).dataset['rawCode'] ??
        decodeHtmlEntities(codeEl.textContent ?? '')
      ;(codeEl as HTMLElement).dataset['rawCode'] = raw

      const activate = (e: Event) => {
        if (!this.active) return
        e.stopPropagation()
        if (pre.querySelector('.tang-code-textarea')) return

        const ta = document.createElement('textarea')
        ta.className = 'tang-code-textarea'
        ta.value = (codeEl as HTMLElement).dataset['rawCode'] ?? raw
        ta.spellcheck = false
        ta.style.cssText = `
          position:absolute;left:0;top:0;right:0;bottom:0;
          width:100%;height:100%;
          background:rgba(13,17,23,0.97);color:#e6edf3;
          font-family:ui-monospace,SFMono-Regular,Menlo,monospace;
          font-size:12px;line-height:1.75;
          padding:16px 18px;
          border:2px solid #3b82f6;border-radius:inherit;
          resize:none;z-index:100;outline:none;tab-size:2;
        `
        pre.style.position = 'relative'
        pre.appendChild(ta)
        ta.focus()

        ta.addEventListener('keydown', ev => {
          if (ev.key === 'Tab') {
            ev.preventDefault()
            const s = ta.selectionStart, e2 = ta.selectionEnd
            ta.value = ta.value.substring(0, s) + '  ' + ta.value.substring(e2)
            ta.selectionStart = ta.selectionEnd = s + 2
          }
          if (ev.key === 'Escape') { ev.stopPropagation(); ta.blur() }
        })

        ta.addEventListener('blur', () => {
          const newCode = ta.value
          ;(codeEl as HTMLElement).dataset['rawCode'] = newCode
          codeEl.textContent = newCode
          delete (codeEl as HTMLElement).dataset['highlighted']
          // @ts-ignore — highlight.js 是全局库
          if (typeof hljs !== 'undefined') hljs.highlightElement(codeEl)
          ta.remove()

          if (newCode !== raw) {
            const anchor = getAnchor(codeEl, this.opts.slideStage)
            if (anchor.type === 'line') {
              this.patches = this.patches.filter(
                p => !(p.type === 'text' && _anchorKey(p.anchor) === _anchorKey(anchor))
              )
              this.patches.push({ type: 'text', anchor, value: newCode })
            }
          }
        })
      }

      pre.addEventListener('click', activate)
      ;(pre as HTMLElement & { _editActivate?: EventListener })['_editActivate'] = activate
    })
  }

  // ─── 私有：事件处理 ────────────────────────────────────────────────────────

  private _onTextBlur(el: Element): void {
    if (!this.active) return
    const original = this.snapshots.get(el) ?? ''
    const current  = el.textContent ?? ''
    if (current !== original) {
      const anchor = getAnchor(el, this.opts.slideStage)
      if (anchor.type === 'line') {
        this.patches = this.patches.filter(
          p => !(p.type === 'text' && _anchorKey(p.anchor) === _anchorKey(anchor))
        )
        this.patches.push({ type: 'text', anchor, value: current, original })
        this.snapshots.set(el, current)
      }
    }
  }

  // ─── 私有：工具方法 ────────────────────────────────────────────────────────

  /** 收集可内联编辑的"叶子文本"元素
   *
   * 规则：只要元素有「直接 TextNode 子节点且内容非空」就允许编辑。
   * 这样 <p>内容 <span>高亮</span></p> 里的 <p> 也能被选中编辑，
   * 而不是只有严格叶子节点（之前 hasElementChild 检查过于严格）。
   */
  private _collectTextElements(root: Element): Element[] {
    const result: Element[] = []
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT)
    let node: Node | null
    while ((node = walker.nextNode())) {
      const el = node as Element
      if (NON_EDITABLE_TAGS.has(el.tagName)) continue
      // 有直接 TextNode 子节点且非空 → 可编辑
      const hasDirectText = Array.from(el.childNodes).some(
        n => n.nodeType === Node.TEXT_NODE && n.textContent?.trim()
      )
      if (hasDirectText) {
        result.push(el)
      }
    }
    return result
  }

  /** 还原所有块级元素到进入编辑前的完整状态（outerHTML 快照替换） */
  private _restoreSnapshots(): void {
    const slide = this.opts.slideStage.querySelector('.slide')
    if (!slide) return

    this.blockSnapshots.forEach((html, originalEl) => {
      // 将保存的 outerHTML 解析为新节点
      const tmp = document.createElement('div')
      tmp.innerHTML = html
      const newEl = tmp.firstElementChild
      if (!newEl) return

      // 用新节点替换当前（可能被改动过的）节点
      if (slide.contains(originalEl)) {
        slide.replaceChild(newEl, originalEl)
      }
    })

    // 清空快照（还原后状态就是干净的初始状态）
    this.blockSnapshots.clear()
    this.snapshots.clear()
  }

  /** 清理编辑态 class 和事件 */
  private _cleanup(resetActive = true): void {
    // 清理代码块
    this.opts.slideStage.querySelectorAll('.tang-code-textarea').forEach(ta => ta.remove())
    this.opts.slideStage.querySelectorAll<HTMLElement>('pre[data-edit-bound]').forEach(pre => {
      delete pre.dataset['editBound']
      const ep = (pre as HTMLElement & { _editActivate?: EventListener })['_editActivate']
      if (ep) pre.removeEventListener('click', ep)
    })
    // 清理 contenteditable
    this.opts.slideStage.querySelectorAll('[contenteditable]').forEach(el => {
      (el as HTMLElement).removeAttribute('contenteditable')
      el.classList.remove('tang-editable')
    })
    // 清理拖拽 class
    this.opts.slideStage.querySelectorAll('.tang-draggable').forEach(el => {
      el.classList.remove('tang-draggable')
    })
    this.opts.slideStage.classList.remove('tang-edit-mode')

    if (resetActive) {
      this.patches = []
      this.snapshots.clear()
    }
  }
}

// ─── 工具函数 ─────────────────────────────────────────────────────────────────

function _anchorKey(anchor: LineAnchor): string {
  return `${anchor.file}:${anchor.line}`
}

/**
 * 解析 CSS transform 字符串，提取 translate 和 rotate 分量。
 * 支持：translate(x, y)  rotate(Ndeg)  及其任意组合顺序。
 */
export interface TransformParts {
  tx: number   // translateX px
  ty: number   // translateY px
  deg: number  // rotate deg
}

export function _getTransformParts(transform: string): TransformParts {
  const tMatch = transform.match(/translate\(\s*([-\d.]+)px\s*,\s*([-\d.]+)px\s*\)/)
  const rMatch = transform.match(/rotate\(\s*([-\d.]+)deg\s*\)/)
  return {
    tx:  tMatch ? parseFloat(tMatch[1]!) : 0,
    ty:  tMatch ? parseFloat(tMatch[2]!) : 0,
    deg: rMatch ? parseFloat(rMatch[1]!) : 0,
  }
}

/**
 * 将 TransformParts 序列化为 CSS transform 字符串。
 * 顺序固定为 translate rotate，符合 CSS 变换标准（先平移后旋转，旋转轴不随平移偏移）。
 */
export function _buildTransform(parts: TransformParts): string {
  const t = (parts.tx !== 0 || parts.ty !== 0)
    ? `translate(${parts.tx}px, ${parts.ty}px)`
    : ''
  const r = parts.deg !== 0 ? `rotate(${parts.deg}deg)` : ''
  return [t, r].filter(Boolean).join(' ')
}
