/**
 * @tang-slidex/editor — SelectionManager
 *
 * 管理用户的"选区"（选中哪些元素），作为 AI Agent 辅助编辑的上下文信号。
 *
 * 支持两种选区模式：
 *   1. 元素级选中（单击块级元素）
 *   2. 范围框选（拖拽矩形区域）
 *
 * 与 EditManager 解耦：SelectionManager 只负责"选中什么"，
 * 不关心后续是做 WYSIWYG 编辑还是 AI 对话。
 */

import type { AgentEditContext, FragmentContext } from './types.js'
import { cleanInjectAttrs } from './patchHelpers.js'

/** 框选状态（拖拽中） */
interface DragRangeState {
  startX: number
  startY: number
  overlay: HTMLElement
}

export interface SelectionManagerOptions {
  /** slide 舞台容器（非 Shadow DOM 方案，即 #slide-host） */
  slideStage: HTMLElement
  /** 当选区变化时的回调 */
  onSelectionChange?: (ctx: AgentEditContext | null) => void
  /** 获取当前 slide index */
  getCurrentIndex: () => number
}

/** 选中元素时渲染的高亮框样式 */
const HIGHLIGHT_STYLE = `
  position: fixed;
  border: 2px solid #3b82f6;
  border-radius: 3px;
  pointer-events: none;
  z-index: 1000;
  box-shadow: 0 0 0 3px rgba(59,130,246,0.15);
  transition: all 0.1s ease;
`

export class SelectionManager {
  private selectedElements: Element[] = []
  private mode: 'none' | 'element' | 'range' = 'none'
  private highlightEls: HTMLElement[] = []
  private dragState: DragRangeState | null = null
  private rangeOverlay: HTMLElement | null = null
  private options: SelectionManagerOptions

  constructor(options: SelectionManagerOptions) {
    this.options = options
  }

  // ─── 公开 API ──────────────────────────────────────────────────────────────

  /** 单元素选中（单击） */
  selectElement(el: Element): void {
    this.clear(false)
    this.selectedElements = [el]
    this.mode = 'element'
    this._renderHighlights()
    this._emit()
  }

  /** 多元素选中（Shift 点击追加） */
  addElement(el: Element): void {
    if (!this.selectedElements.includes(el)) {
      this.selectedElements.push(el)
    }
    this.mode = 'element'
    this._renderHighlights()
    this._emit()
  }

  /** 清除选区 */
  clear(emit = true): void {
    this.selectedElements = []
    this.mode = 'none'
    this._clearHighlights()
    if (emit) this._emit()
  }

  /** 是否有选中的元素 */
  get hasSelection(): boolean {
    return this.selectedElements.length > 0
  }

  /** 当前选中的元素列表（只读） */
  get elements(): readonly Element[] {
    return this.selectedElements
  }

  /** 序列化为 Agent 可用的上下文 */
  toAgentContext(): AgentEditContext {
    const idx = this.options.getCurrentIndex()
    const num = String(idx + 1).padStart(3, '0')

    const fragments: FragmentContext[] = this.selectedElements.map(el => {
      const he = el as HTMLElement
      return {
        tagName:     el.tagName.toLowerCase(),
        classList:   [...el.classList].join(' '),
        line:        he.dataset['tangLine'] ? parseInt(he.dataset['tangLine']!, 10) : null,
        file:        he.dataset['tangFile'] ?? null,
        html:        cleanInjectAttrs(el.outerHTML),
        textContent: el.textContent?.trim() ?? '',
      }
    })

    const slideEl = this.options.slideStage.querySelector('.slide')
    const fullSlideHtml = slideEl ? cleanInjectAttrs(slideEl.outerHTML) : ''

    return {
      slideFile:      `slides/slide-${num}.html`,
      slideIndex:     idx,
      selectionMode:  this.mode,
      selectedCount:  this.selectedElements.length,
      fragments,
      fullSlideHtml,
    }
  }

  // ─── 框选支持 ──────────────────────────────────────────────────────────────

  /** 开始框选拖拽（在 mousedown 时调用） */
  startRangeDrag(e: MouseEvent): void {
    if (e.button !== 0) return

    // 创建框选 overlay
    const overlay = document.createElement('div')
    overlay.style.cssText = `
      position: fixed;
      border: 1.5px dashed rgba(59,130,246,0.7);
      background: rgba(59,130,246,0.05);
      pointer-events: none;
      z-index: 999;
    `
    document.body.appendChild(overlay)

    this.dragState = { startX: e.clientX, startY: e.clientY, overlay }
    this.rangeOverlay = overlay

    const onMove = (ev: MouseEvent) => {
      if (!this.dragState) return
      const x = Math.min(ev.clientX, this.dragState.startX)
      const y = Math.min(ev.clientY, this.dragState.startY)
      const w = Math.abs(ev.clientX - this.dragState.startX)
      const h = Math.abs(ev.clientY - this.dragState.startY)
      overlay.style.left   = `${x}px`
      overlay.style.top    = `${y}px`
      overlay.style.width  = `${w}px`
      overlay.style.height = `${h}px`
    }

    const onUp = (ev: MouseEvent) => {
      if (!this.dragState) return
      const rect: DOMRect = {
        left:   Math.min(ev.clientX, this.dragState.startX),
        top:    Math.min(ev.clientY, this.dragState.startY),
        right:  Math.max(ev.clientX, this.dragState.startX),
        bottom: Math.max(ev.clientY, this.dragState.startY),
        width:  Math.abs(ev.clientX - this.dragState.startX),
        height: Math.abs(ev.clientY - this.dragState.startY),
        x:      Math.min(ev.clientX, this.dragState.startX),
        y:      Math.min(ev.clientY, this.dragState.startY),
        toJSON: () => ({}),
      }

      overlay.remove()
      this.rangeOverlay = null
      this.dragState = null

      if (rect.width > 5 && rect.height > 5) {
        this._selectByRect(rect)
      }

      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
    }

    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }

  // ─── 私有方法 ──────────────────────────────────────────────────────────────

  /** 框选矩形区域内的所有块级元素 */
  private _selectByRect(rect: DOMRect): void {
    const slide = this.options.slideStage.querySelector('.slide')
    if (!slide) return

    const SKIP = new Set(['STYLE', 'SCRIPT', 'CANVAS', 'HEAD', 'HTML', 'BODY'])
    const matched = Array.from(slide.querySelectorAll('*')).filter(el => {
      if (SKIP.has(el.tagName)) return false
      const r = el.getBoundingClientRect()
      // 元素和框选区域有交叉
      return !(r.right < rect.left || r.left > rect.right ||
               r.bottom < rect.top || r.top > rect.bottom)
    })

    if (matched.length === 0) return

    this.clear(false)
    this.selectedElements = matched
    this.mode = 'range'
    this._renderHighlights()
    this._emit()
  }

  /** 渲染高亮框（每个选中元素一个蓝框） */
  private _renderHighlights(): void {
    this._clearHighlights()
    this.selectedElements.forEach(el => {
      const rect = el.getBoundingClientRect()
      const hl = document.createElement('div')
      hl.className = 'tang-selection-highlight'
      hl.style.cssText = HIGHLIGHT_STYLE
      hl.style.left   = `${rect.left   - 2}px`
      hl.style.top    = `${rect.top    - 2}px`
      hl.style.width  = `${rect.width  + 4}px`
      hl.style.height = `${rect.height + 4}px`
      document.body.appendChild(hl)
      this.highlightEls.push(hl)
    })
  }

  /** 清除所有高亮框 */
  private _clearHighlights(): void {
    this.highlightEls.forEach(el => el.remove())
    this.highlightEls = []
  }

  /** 发出 selection-change 事件 */
  private _emit(): void {
    const detail = this.hasSelection ? this.toAgentContext() : null
    this.options.onSelectionChange?.(detail)
    window.dispatchEvent(
      new CustomEvent('tang:selection-change', { detail })
    )
  }
}
