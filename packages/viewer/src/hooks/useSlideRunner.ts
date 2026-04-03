import { useRef, useCallback } from 'react'
import { useSlideStore } from '../store/slideStore'
import { rehydrateAll } from '../utils/liquidGlassManager'
import { getPreset } from '../utils/animPresets'
import type { AnimationController } from './useAnimationController'

/** window.tang 运行时 API 类型 */
interface TangRuntime {
  onLoad(fn: () => void): void
  onStep(step: number, fn: (els: HTMLElement[]) => void): void
  onRetreat(step: number, fn: (els: HTMLElement[]) => void): void
  _runLoad(): void
  _hasLoadAnim(): boolean
  _getStepFn(step: number): ((els: HTMLElement[]) => void) | undefined
  _getRetreatFn(step: number): ((els: HTMLElement[]) => void) | undefined
}

/** 注入/重置 window.tang，每次换页前调用 */
function resetTangRuntime() {
  const loadFns:   Array<() => void>                         = []
  const stepFns    = new Map<number, (els: HTMLElement[]) => void>()
  const retreatFns = new Map<number, (els: HTMLElement[]) => void>()

  const tang: TangRuntime = {
    onLoad:    fn => loadFns.push(fn),
    onStep:    (n, fn) => stepFns.set(n, fn),
    onRetreat: (n, fn) => retreatFns.set(n, fn),
    _hasLoadAnim: () => loadFns.length > 0,
    _runLoad: () => {
      // 检查 .slide 是否有 data-disable-load-anim="true"
      const slide = document.querySelector('#slide-host .slide') as HTMLElement | null
      if (slide?.dataset?.disableLoadAnim === 'true') return

      // 如果 .slide 有 data-load-animation，框架托管模式：应用预设，不跑脚本 onLoad
      if (slide?.dataset?.loadAnimation) {
        const gsap = (window as unknown as Record<string, unknown>).gsap as any
        if (gsap) {
          const preset = getPreset(slide.dataset.loadAnimation)
          const duration = parseInt(slide.dataset.loadDuration ?? '600') / 1000
          const ease     = slide.dataset.loadEase ?? 'power2.out'
          gsap.from(slide, { ...preset, duration, ease })
        }
        return  // 托管模式下不跑 onLoad 脚本
      }

      // 默认：执行 tang.onLoad 脚本注册的回调
      loadFns.forEach(fn => { try { fn() } catch(e) { console.warn('[tang.onLoad]', e) } })
    },
    _getStepFn:    n => stepFns.get(n),
    _getRetreatFn: n => retreatFns.get(n),
  }

  ;(window as unknown as Record<string, unknown>).tang = tang
  return tang
}

/** 与 tech-intro/index.html 相同的直接 DOM 注入方案（非 Shadow DOM）
 *  这样 EditManager 可以正常绑定、getBoundingClientRect 正常工作
 *
 *  关键时序（修正版，解决 3 个原始 bug）：
 *  host.opacity='0'
 *  → 注入 window.tang（重置）
 *  → 注入 style + DOM（不含 script）
 *  → requestAnimationFrame:
 *      host.opacity='1'（整个 host fade in，不碰 .slide，与 GSAP 零干扰）
 *      执行 <script>（收集 tang 注册，顶层 GSAP 调用立即执行）
 *      animCtrl.dispose() + init()（在 script 后！隐藏步骤元素，覆盖违规操作）
 *      tang._runLoad()（onLoad 入场动画，此时步骤元素已隐藏）
 *      rehydrateAll / highlight.js
 *      dispatch 'tang:slide-loaded'（最后！EditManager 再绑定）
 */
export function useSlideRunner(
  hostRef: React.RefObject<HTMLDivElement | null>,
  animCtrl: AnimationController,
) {
  const { setCurrent, setTotal, setLoading } = useSlideStore()

  // 内部状态（不进 React state，避免重渲染）
  const currentRef      = useRef(-1)
  const isNavigating    = useRef(false)  // 重命名：只锁 fetch/注入阶段，不锁步骤点击
  const totalSlidesRef  = useRef(0)
  const initializedRef  = useRef(false)

  // ── 初始化（由 StageArea 在 DOM 确实存在后调用） ──────────────────────────
  function init(cfg: { totalSlides: number; slidesDir?: string }) {
    if (initializedRef.current) return
    initializedRef.current = true

    totalSlidesRef.current = cfg.totalSlides
    setTotal(cfg.totalSlides)
    setLoading(true)

    const startIndex = parseInt(location.hash.slice(1)) || 0
    navigateToInner(startIndex, true).finally(() => setLoading(false))
  }

  // ── 内部导航函数 ─────────────────────────────────────────────────────────
  async function navigateToInner(index: number, instant = false) {
    const total = totalSlidesRef.current
    // 只锁重复的 navigateTo 调用（防止同时 fetch 两个 slide）
    // advance/retreat 不受此锁影响
    if (isNavigating.current && !instant) return
    if (index < 0 || (total > 0 && index >= total)) return

    const host = hostRef.current
    if (!host) {
      console.warn('[SlideRunner] hostRef is null, retry in 100ms')
      setTimeout(() => navigateToInner(index, instant), 100)
      return
    }

    isNavigating.current = true
    try {
      const num = String(index + 1).padStart(3, '0')
      const res = await fetch(`./slides/slide-${num}.html?t=${Date.now()}`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const html = await res.text()

      const parser = new DOMParser()
      const doc    = parser.parseFromString(html, 'text/html')

      // ① 整个 host 淡出（不碰 .slide 内部，与 GSAP 零干扰）
      if (!instant) {
        host.style.transition = 'none'
        host.style.opacity    = '0'
      }

      // ② 重置 window.tang（收集新页的注册）
      resetTangRuntime()

      // ③ 清空 host
      host.innerHTML = ''

      // ④ 注入 <style>
      doc.head.querySelectorAll('style').forEach(s => {
        const el = document.createElement('style')
        el.textContent = s.textContent
        host.appendChild(el)
      })

      // ⑤ 注入 DOM 节点（不含 <script>，先收集脚本代码）
      const scripts: string[] = []
      Array.from(doc.body.childNodes).forEach(node => {
        if (node.nodeName === 'SCRIPT') {
          scripts.push((node as HTMLScriptElement).textContent ?? '')
        } else {
          host.appendChild(document.importNode(node, true))
        }
      })

      // ⑥ 更新路由和 store（同步，不等 rAF）
      currentRef.current = index
      history.replaceState(null, '', `#${index}`)
      setCurrent(index)

      // ⑦ rAF：执行所有后续操作（保证 DOM 已渲染）
      requestAnimationFrame(() => {
        // host fade in（整个 host，不会与 .slide 内的 GSAP 冲突）
        if (!instant) {
          host.style.transition = 'opacity 0.2s ease'
          host.style.opacity    = '1'
        }

        // 执行 <script>（收集 tang.onLoad/onStep/onRetreat 注册）
        for (const code of scripts) {
          if (!code.trim()) continue
          try { new Function(code)() } catch (e) { console.warn('[slide script]', e) }
        }

        // animCtrl 初始化（在 script 之后！）
        // 此时 tang 注册已收集，data-step 元素已在 DOM 中
        const slideEl = host.querySelector<HTMLElement>('.slide')
        animCtrl.dispose()
        animCtrl.init(slideEl)

        // 执行入场动画（onLoad 回调）
        // 注意：init() 此时 **不** 隐藏步骤元素，让 onLoad 里的 gsap.from 能正常播放
        const tang = (window as unknown as Record<string, unknown>).tang as TangRuntime | undefined
        tang?._runLoad()

        // onLoad 启动后，再把演示模式下的入场步骤元素设为 hidden。
        // 此时 gsap.from 动画已经启动（启动时元素可见），对动画本身无影响；
        // 而那些没有被 onLoad 控制的步骤元素，也会被正确隐藏。
        animCtrl.initHideForPresentation()

        // highlight.js
        const hljs = (window as unknown as Record<string, unknown>).hljs as any
        if (hljs) {
          host.querySelectorAll('pre code[class*="language-"]').forEach((el: any) => {
            if (!el.dataset.highlighted) hljs.highlightElement(el)
          })
        }

        // 刷新 liquid-glass 元素
        rehydrateAll(host)

        // 最后通知 EditManager 重新绑定（所有 DOM 和动画状态都稳定了）
        document.dispatchEvent(new CustomEvent('tang:slide-loaded', { detail: { index } }))
      })

    } catch (err) {
      console.error('[SlideRunner]', err)
      const h = hostRef.current
      if (h) {
        h.innerHTML = `<div style="color:#ef4444;padding:48px;font-family:monospace;">❌ ${(err as Error).message}</div>`
        h.style.opacity = '1'
      }
    } finally {
      isNavigating.current = false
    }
  }

  // ── 公开 API ──────────────────────────────────────────────────────────────
  const navigateTo = useCallback((index: number, opts?: { instant?: boolean }) => {
    return navigateToInner(index, opts?.instant)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const next = useCallback(() => navigateToInner(currentRef.current + 1), [])  // eslint-disable-line
  const prev = useCallback(() => navigateToInner(currentRef.current - 1), [])  // eslint-disable-line

  return { init, navigateTo, next, prev, currentRef }
}
