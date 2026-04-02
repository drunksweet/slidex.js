/**
 * useAnimationController
 *
 * 步骤动画控制器（Build Animation）
 *
 * 架构说明：
 *   - 入场动画（Auto-play）：由 slide 的 tang.onLoad 回调负责，框架不干涉
 *   - 步骤动画（Build）：由本控制器统一管理，基于 data-step 属性
 *
 * 关键特性：
 *   - controller 封装在 useRef 里，返回稳定引用（防止 useEffect 依赖循环）
 *   - 运行时状态用闭包变量，不用 React state（避免不必要的重渲染）
 *   - 隐藏使用 visibility:hidden + opacity:0（不用 display:none，canvas 尺寸不归零）
 *   - N 步需 N+1 次点击（最后一步 advance() 仍返回 'stepped'，再点一次才 'done'）
 */

import { useRef } from 'react'
import { useUiStore } from '../store/uiStore'
import { useAnimStore } from '../store/animStore'

// ── 效果预设 ──────────────────────────────────────────────────────────────────

const PRESETS: Record<string, Record<string, unknown>> = {
  'fade':       { opacity: 0 },
  'fade-up':    { opacity: 0, y: 30 },
  'fade-down':  { opacity: 0, y: -30 },
  'fade-left':  { opacity: 0, x: 30 },
  'fade-right': { opacity: 0, x: -30 },
  'zoom-in':    { opacity: 0, scale: 0.85 },
  'zoom-out':   { opacity: 0, scale: 1.15 },
  'slide-up':   { y: 60 },
  'slide-right':{ x: -60 },
  'none':       {},
  // 'custom' 通过 tang.onStep 注册的回调处理
}

// ── 属性解析 ─────────────────────────────────────────────────────────────────

function parseAnimAttrs(el: HTMLElement) {
  return {
    animation: el.dataset.animation ?? 'fade-up',
    duration:  parseInt(el.dataset.duration ?? '400') / 1000,  // ms → s
    delay:     parseInt(el.dataset.delay   ?? '0')   / 1000,
    ease:      el.dataset.ease    ?? 'power2.out',
    stagger:   parseFloat(el.dataset.stagger ?? '0'),
  }
}

// ── 公开接口 ─────────────────────────────────────────────────────────────────

export interface AnimationController {
  /** 扫描 data-step 属性，隐藏 step≥1 的元素（在 <script> 执行后调用） */
  init(slideEl: HTMLElement | null): void
  /** 推进一步：返回 'stepped'（继续等待）或 'done'（外部翻页） */
  advance(): 'stepped' | 'done'
  /** 回退一步：返回 'retreated'（继续）或 'at-start'（外部翻到上一页） */
  retreat(): 'retreated' | 'at-start'
  /** 编辑模式：立即显示所有步骤元素 */
  revealAll(): void
  /** AnimateTab 预览：播放指定步骤的入场动画（不影响 currentStep） */
  previewStep(step: number): void
  /** 换页时清理状态 */
  dispose(): void
  /** 获取步骤元素映射（供 AnimateTab 使用） */
  getStepMap(): Map<number, HTMLElement[]>
}

// ── Hook ─────────────────────────────────────────────────────────────────────

export function useAnimationController(): AnimationController {
  const ctrlRef = useRef<AnimationController | null>(null)

  if (!ctrlRef.current) {
    ctrlRef.current = createController()
  }

  return ctrlRef.current
}

function createController(): AnimationController {
  // 闭包状态（不进 React state）
  let currentStep = 0
  let totalSteps  = 0
  const stepMap   = new Map<number, HTMLElement[]>()

  // ── 获取 GSAP（运行时） ──────────────────────────────────────────────────
  function getGsap() {
    return (window as unknown as Record<string, unknown>).gsap as any
  }

  // ── 获取 tang 运行时 API ─────────────────────────────────────────────────
  function getTang() {
    return (window as unknown as Record<string, unknown>).tang as any
  }

  // ── 同步 Zustand store（驱动 NavBar 步骤点 UI） ─────────────────────────
  function syncStore() {
    useAnimStore.getState().setStepState(currentStep, totalSteps)
  }

  // ── 立即隐藏（不播动画） ─────────────────────────────────────────────────
  // 关键：只用 visibility:hidden 隐藏，不写 opacity inline style
  // 这样 GSAP from({ opacity:0 }) 时目标态是 CSS 默认的 opacity:1，动画才能生效
  function hideEls(els: HTMLElement[]) {
    const gsap = getGsap()
    if (gsap) {
      gsap.killTweensOf(els)
      // 清除 GSAP 残留的 inline transform/opacity（防止上次动画结束后的遗留值）
      gsap.set(els, { clearProps: 'opacity,transform,x,y,scale' })
    }
    els.forEach(el => {
      el.style.visibility = 'hidden'
      // ⚠️ 不要设置 opacity inline style！留给 GSAP 管控
    })
  }

  // ── 立即显示（不播动画） ─────────────────────────────────────────────────
  function showEls(els: HTMLElement[]) {
    const gsap = getGsap()
    if (gsap) {
      gsap.killTweensOf(els)
      gsap.set(els, { clearProps: 'opacity,transform,x,y,scale' })
    }
    els.forEach(el => {
      el.style.visibility = 'visible'
    })
  }

  // ── 播放步骤入场动画 ─────────────────────────────────────────────────────
  function playStepAnim(step: number, els: HTMLElement[]) {
    const gsap = getGsap()
    if (!gsap) {
      // 无 GSAP 时直接显示
      showEls(els)
      return
    }

    // 先检查 tang.onStep 注册的自定义回调
    const tang = getTang()
    const customFn = tang?._getStepFn?.(step) as ((els: HTMLElement[]) => void) | undefined
    if (customFn) {
      gsap.set(els, { visibility: 'visible' })
      customFn(els)
      return
    }

    // 使用预设效果
    const { animation, duration, delay, ease, stagger } = parseAnimAttrs(els[0])
    const preset = PRESETS[animation] ?? PRESETS['fade-up']

    // 先确保元素可见（visibility），GSAP 会从 preset 的初始值 animate 到当前 CSS 值
    // clearProps 确保没有 inline opacity/transform 残留干扰目标态
    gsap.set(els, { visibility: 'visible', clearProps: 'opacity,transform,x,y,scale' })

    if (Object.keys(preset).length === 0) {
      // 'none'：直接显示，不播动画
      return
    }

    gsap.from(els, {
      ...preset,
      duration,
      delay: delay,
      ease,
      stagger: els.length > 1 ? (stagger || 0.08) : 0,
    })
  }

  // ── Controller 实现 ────────────────────────────────────────────────────────

  const ctrl: AnimationController = {

    init(slideEl) {
      currentStep = 0
      totalSteps  = 0
      stepMap.clear()

      if (!slideEl) { syncStore(); return }

      // 扫描 data-step≥1 的元素
      slideEl.querySelectorAll<HTMLElement>('[data-step]').forEach(el => {
        const n = parseInt(el.dataset.step ?? '0')
        if (isNaN(n) || n <= 0) return
        if (!stepMap.has(n)) stepMap.set(n, [])
        stepMap.get(n)!.push(el)
      })

      if (stepMap.size === 0) { syncStore(); return }

      totalSteps = Math.max(...stepMap.keys())

      // 判断当前模式
      const mode = useUiStore.getState().mode

      if (mode === 'edit') {
        // 编辑模式：立即显示所有步骤元素
        for (let s = 1; s <= totalSteps; s++) {
          const els = stepMap.get(s) ?? []
          showEls(els)
        }
        currentStep = totalSteps
      } else {
        // 演示模式：隐藏 step≥1 的元素
        // gsap.killTweensOf 是保底机制，防止 script 违规操作留下的 tween
        for (let s = 1; s <= totalSteps; s++) {
          const els = stepMap.get(s) ?? []
          hideEls(els)
        }
      }

      syncStore()
    },

    advance() {
      if (totalSteps === 0) return 'done'
      if (currentStep >= totalSteps) return 'done'

      currentStep++
      const els = stepMap.get(currentStep) ?? []
      playStepAnim(currentStep, els)
      syncStore()
      return 'stepped'
      // 注意：即使是最后一步也返回 'stepped'，需要再点一次才翻页（N步N+1次点击）
    },

    retreat() {
      if (totalSteps === 0 || currentStep <= 0) return 'at-start'

      const els = stepMap.get(currentStep) ?? []
      hideEls(els)
      currentStep--
      syncStore()

      return currentStep <= 0 ? 'at-start' : 'retreated'
    },

    revealAll() {
      for (let s = 1; s <= totalSteps; s++) {
        const els = stepMap.get(s) ?? []
        showEls(els)
      }
      currentStep = totalSteps
      syncStore()
    },

    previewStep(step) {
      const els = stepMap.get(step)
      if (!els || els.length === 0) return

      const gsap = getGsap()
      if (!gsap) {
        // 无 GSAP：直接显示
        showEls(els)
        return
      }

      // 先立即隐藏（kill 在途 tween + 复位 visibility，不动 opacity inline style）
      gsap.killTweensOf(els)
      els.forEach(el => {
        el.style.visibility = 'hidden'
      })

      // 一帧后播放入场动画（确保浏览器渲染了隐藏状态再 from）
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          playStepAnim(step, els)
        })
      })
    },

    dispose() {
      // 清理所有步骤元素的状态（换页时调用）
      const gsap = getGsap()
      for (let s = 1; s <= totalSteps; s++) {
        const els = stepMap.get(s) ?? []
        if (gsap) gsap.killTweensOf(els)
      }
      currentStep = 0
      totalSteps  = 0
      stepMap.clear()
      syncStore()
    },

    getStepMap() {
      return new Map(stepMap)
    },
  }

  return ctrl
}
