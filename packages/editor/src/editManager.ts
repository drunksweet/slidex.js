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
  private snapshots = new Map<Element, string>()
  private dragState: {
    el: HTMLElement
    startX: number; startY: number
    baseX: number; baseY: number
    dx: number; dy: number
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
    this.opts.slideStage.classList.add('tang-edit-mode')
    this._bindSlide()
    this.opts.onStateChange(true)
  }

  /** 退出编辑模式（不保存，还原所有改动） */
  disable(): void {
    if (!this.active) return
    this.active = false
    this._restoreSnapshots()
    this._cleanup()
    this.opts.onStateChange(false)
  }

  /** 保存并退出 */
  async save(): Promise<void> {
    if (!this.active) return
    if (this.patches.length === 0) {
      this.disable()
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
        this.active = false
        this._cleanup()
        this.opts.onStateChange(false)
      } else {
        this.opts.showToast(`❌ 保存失败: ${data.error}`, 'error')
      }
    } catch (err) {
      this.opts.showToast('❌ 网络错误', 'error')
      console.error('[EditManager] save error:', err)
    }
  }

  /** 撤销上一次保存（Ctrl+Z） */
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

    // 3. 绑定拖拽
    Array.from(slide.children).forEach(child => {
      if (NON_DRAGGABLE_TAGS.has(child.tagName)) return
      child.classList.add('tang-draggable')
      ;(child as HTMLElement).addEventListener('mousedown', (e) =>
        this._onDragStart(e, child as HTMLElement)
      )
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

  private _onDragStart(e: MouseEvent, el: HTMLElement): void {
    if (!this.active) return
    if ((e.target as HTMLElement).isContentEditable && e.target !== el) return
    e.preventDefault()

    const scale = this.opts.getCurrentScale()
    const startX = e.clientX, startY = e.clientY
    const origTransform = el.style.transform || ''
    const m = origTransform.match(/translate\(([^,]+),\s*([^)]+)\)/)
    const baseX = m ? parseFloat(m[1]!) : 0
    const baseY = m ? parseFloat(m[2]!) : 0

    el.classList.add('tang-dragging')
    this.dragState = { el, startX, startY, baseX, baseY, dx: 0, dy: 0 }

    const onMove = (ev: MouseEvent) => {
      if (!this.dragState) return
      const dx = (ev.clientX - startX) / scale
      const dy = (ev.clientY - startY) / scale
      this.dragState.dx = dx
      this.dragState.dy = dy
      el.style.transform = `translate(${baseX + dx}px, ${baseY + dy}px)`
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
          this.patches.push({ type: 'move', anchor, dx: Math.round(dx), dy: Math.round(dy) })
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

  // ─── 私有：工具方法 ────────────────────────────────────────────────────────

  /** 收集可内联编辑的"叶子文本"元素 */
  private _collectTextElements(root: Element): Element[] {
    const result: Element[] = []
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT)
    let node: Node | null
    while ((node = walker.nextNode())) {
      const el = node as Element
      if (NON_EDITABLE_TAGS.has(el.tagName)) continue
      const hasElementChild = Array.from(el.childNodes).some(n => n.nodeType === 1)
      if (!hasElementChild && el.textContent?.trim()) {
        result.push(el)
      }
    }
    return result
  }

  /** 还原所有快照 */
  private _restoreSnapshots(): void {
    this.snapshots.forEach((orig, el) => {
      el.textContent = orig
    })
    // 还原 transform
    this.patches.filter(p => p.type === 'move').forEach(p => {
      if (p.type !== 'move') return
      if (p.anchor.type !== 'line') return
      try {
        const el = this.opts.slideStage.querySelector<HTMLElement>(
          `[data-tang-line="${p.anchor.line}"]`
        )
        if (el) el.style.transform = ''
      } catch {}
    })
    // 还原删除
    this.patches.filter(p => p.type === 'delete').forEach(p => {
      if (p.type !== 'delete') return
      if (p.anchor.type !== 'line') return
      try {
        const el = this.opts.slideStage.querySelector<HTMLElement>(
          `[data-tang-line="${p.anchor.line}"]`
        )
        if (el) el.style.display = ''
      } catch {}
    })
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
