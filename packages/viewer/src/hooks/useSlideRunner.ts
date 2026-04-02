import { useRef, useCallback } from 'react'
import { useSlideStore } from '../store/slideStore'
import { rehydrateAll } from '../utils/liquidGlassManager'

/** 与 tech-intro/index.html 相同的直接 DOM 注入方案（非 Shadow DOM）
 *  这样 EditManager 可以正常绑定、getBoundingClientRect 正常工作 */
export function useSlideRunner(hostRef: React.RefObject<HTMLDivElement | null>) {
  const { setCurrent, setTotal, setLoading } = useSlideStore()

  // 内部状态（不进 React state，避免重渲染）
  const currentRef     = useRef(-1)
  const isAnimating    = useRef(false)
  const totalSlidesRef = useRef(0)
  const initializedRef = useRef(false)

  // ── 初始化（由 StageArea 在 DOM 确实存在后调用） ──────────────────────────────
  function init(cfg: { totalSlides: number; slidesDir?: string }) {
    if (initializedRef.current) return
    initializedRef.current = true

    totalSlidesRef.current = cfg.totalSlides
    setTotal(cfg.totalSlides)
    setLoading(true)

    const startIndex = parseInt(location.hash.slice(1)) || 0
    navigateToInner(startIndex, true).finally(() => setLoading(false))
  }

  // ── 内部导航函数 ─────────────────────────────────────────────────────────────
  async function navigateToInner(index: number, instant = false) {
    const total = totalSlidesRef.current
    if (isAnimating.current && !instant) return
    if (index < 0 || (total > 0 && index >= total)) return

    const host = hostRef.current
    if (!host) {
      console.warn('[SlideRunner] hostRef is null, retry in 100ms')
      setTimeout(() => navigateToInner(index, instant), 100)
      return
    }

    isAnimating.current = true
    try {
      const num = String(index + 1).padStart(3, '0')
      const res = await fetch(`./slides/slide-${num}.html?t=${Date.now()}`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const html = await res.text()

      const parser = new DOMParser()
      const doc    = parser.parseFromString(html, 'text/html')
      host.innerHTML = ''

      // 注入 <style>
      doc.head.querySelectorAll('style').forEach(s => {
        const el = document.createElement('style')
        el.textContent = s.textContent
        host.appendChild(el)
      })

      // 收集 script，先注入其他节点
      const scripts: string[] = []
      Array.from(doc.body.childNodes).forEach(node => {
        if (node.nodeName === 'SCRIPT') {
          scripts.push((node as HTMLScriptElement).textContent ?? '')
        } else {
          host.appendChild(document.importNode(node, true))
        }
      })

      // 入场动画（非 instant）
      if (!instant) {
        const slide = host.querySelector<HTMLElement>('.slide')
        if (slide) {
          slide.style.opacity = '0'
          slide.style.transition = 'opacity 0.25s ease'
          requestAnimationFrame(() => { slide.style.opacity = '1' })
        }
      }

      // 执行脚本 + highlight.js
      requestAnimationFrame(() => {
        for (const code of scripts) {
          if (!code.trim()) continue
          try { new Function(code)() } catch (e) { console.warn('[slide script]', e) }
        }
        const hljs = (window as any).hljs
        if (hljs) {
          host.querySelectorAll('pre code[class*="language-"]').forEach((el: any) => {
            if (!el.dataset.highlighted) hljs.highlightElement(el)
          })
        }
      })

      currentRef.current = index
      history.replaceState(null, '', `#${index}`)
      setCurrent(index)

      // 刷新后自动重注入带 data-liquid-glass 的元素
      rehydrateAll(host)

      // 换页完成后通知 EditManager 重新绑定（若当前处于编辑模式）
      // 用自定义事件解耦，避免循环依赖
      document.dispatchEvent(new CustomEvent('tang:slide-loaded', { detail: { index } }))

    } catch (err) {
      console.error('[SlideRunner]', err)
      const h = hostRef.current
      if (h) {
        h.innerHTML = `<div style="color:#ef4444;padding:48px;font-family:monospace;">❌ ${(err as Error).message}</div>`
      }
    } finally {
      isAnimating.current = false
    }
  }

  // ── 公开 API ────────────────────────────────────────────────────────────────
  const navigateTo = useCallback((index: number, opts?: { instant?: boolean }) => {
    return navigateToInner(index, opts?.instant)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const next = useCallback(() => navigateToInner(currentRef.current + 1), [])  // eslint-disable-line
  const prev = useCallback(() => navigateToInner(currentRef.current - 1), [])  // eslint-disable-line

  return { init, navigateTo, next, prev, currentRef }
}
