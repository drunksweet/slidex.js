import type { TransitionType } from '../standards/index.js'

export interface SlideRunnerOptions {
  /** Shadow DOM 挂载的宿主容器 */
  container: HTMLElement
  /** slides/ 目录的 base URL（相对或绝对路径） */
  slidesDir: string
  /** 总页数 */
  totalSlides: number
  /** 默认页面切换动画 */
  defaultTransition?: TransitionType
  /** 切换完成回调 */
  onNavigate?: (index: number) => void
}

export interface NavigateOptions {
  transition?: TransitionType
  instant?:    boolean
}

/**
 * PPT 幻灯片运行时引擎
 *
 * 采用 fetch + Shadow DOM 方案：
 * - Shadow DOM 保证 CSS 完全隔离
 * - 共享全局库（GSAP / ECharts），资源只加载一次
 * - 支持流畅的 GSAP 入场动画
 */
export class SlideRunner {
  private current    = -1
  private isAnimating = false
  private host: HTMLElement

  constructor(private options: SlideRunnerOptions) {
    this.host = options.container
    this.bindKeyboard()
  }

  get currentIndex() { return this.current }
  get total()        { return this.options.totalSlides }

  // ─── 核心导航 ────────────────────────────────────────────────────────────────

  async navigateTo(index: number, opts: NavigateOptions = {}): Promise<void> {
    if (index < 0 || index >= this.options.totalSlides) return
    if (this.isAnimating && !opts.instant) return

    this.isAnimating = true

    try {
      const url  = this.slideUrl(index)
      const html = await this.fetchSlide(url)

      // 重建 Shadow DOM（完全隔离上一页的 CSS/JS）
      this.host.innerHTML = ''
      const shadow = this.host.attachShadow({ mode: 'open' })
      shadow.innerHTML    = html

      // 手动执行 Shadow DOM 内的 <script>（浏览器不自动执行 shadowRoot 中的脚本）
      this.executeScripts(shadow)

      // 入场动画
      if (!opts.instant) {
        await this.playEnterAnimation(
          shadow,
          opts.transition ?? this.options.defaultTransition ?? 'fade',
        )
      }

      this.current = index
      this.updateUrlHash(index)
      this.options.onNavigate?.(index)
    } finally {
      this.isAnimating = false
    }
  }

  next(opts?: NavigateOptions) { return this.navigateTo(this.current + 1, opts) }
  prev(opts?: NavigateOptions) { return this.navigateTo(this.current - 1, opts) }

  // ─── 内部工具 ────────────────────────────────────────────────────────────────

  private slideUrl(index: number): string {
    const num = String(index + 1).padStart(3, '0')
    return `${this.options.slidesDir}/slide-${num}.html`
  }

  private async fetchSlide(url: string): Promise<string> {
    // 支持内联数据（build 后单文件模式）
    const inlineData = (window as unknown as Record<string, unknown>)['__TANG_SLIDES__'] as Record<string, string> | undefined
    if (inlineData) {
      const key = url.split('/').pop()!
      return inlineData[key] ?? `<div class="slide"><p>页面未找到: ${key}</p></div>`
    }

    const res = await fetch(url)
    if (!res.ok) throw new Error(`加载页面失败: ${url} (${res.status})`)
    return res.text()
  }

  /**
   * Shadow DOM 中 <script> 标签不会自动执行，需手动重建
   */
  private executeScripts(root: ShadowRoot) {
    root.querySelectorAll('script').forEach(old => {
      const next = document.createElement('script')
      // 复制所有属性
      Array.from(old.attributes).forEach(attr => next.setAttribute(attr.name, attr.value))
      next.textContent = old.textContent
      old.replaceWith(next)
    })
  }

  private async playEnterAnimation(root: ShadowRoot, type: TransitionType): Promise<void> {
    const slide = root.querySelector<HTMLElement>('.slide')
    if (!slide) return

    const gsap = (window as unknown as Record<string, unknown>)['gsap'] as
      | { from: (target: HTMLElement, vars: Record<string, unknown>) => Promise<void> }
      | undefined

    if (!gsap) {
      // 无 GSAP 时，用 CSS transition 回退
      slide.style.opacity = '0'
      slide.style.transition = 'opacity 0.4s ease'
      requestAnimationFrame(() => { slide.style.opacity = '1' })
      return
    }

    const animations: Record<TransitionType, Record<string, unknown>> = {
      fade:  { opacity: 0, duration: 0.4, ease: 'power2.out' },
      slide: { x: 60, opacity: 0, duration: 0.45, ease: 'power2.out' },
      zoom:  { scale: 0.92, opacity: 0, duration: 0.4, ease: 'power2.out' },
      none:  {},
    }

    if (type !== 'none') {
      await gsap.from(slide, animations[type] ?? animations.fade)
    }
  }

  private updateUrlHash(index: number) {
    history.replaceState(null, '', `#${index}`)
  }

  // ─── 键盘事件 ────────────────────────────────────────────────────────────────

  private bindKeyboard() {
    document.addEventListener('keydown', (e) => {
      switch (e.key) {
        case 'ArrowRight':
        case ' ':
          e.preventDefault()
          this.next()
          break
        case 'ArrowLeft':
          e.preventDefault()
          this.prev()
          break
        case 'ArrowUp':
          e.preventDefault()
          this.navigateTo(0)
          break
        case 'ArrowDown':
          e.preventDefault()
          this.navigateTo(this.total - 1)
          break
        case 'f':
        case 'F':
          document.documentElement.requestFullscreen?.()
          break
        case 'Escape':
          document.exitFullscreen?.()
          break
      }
    })
  }
}
