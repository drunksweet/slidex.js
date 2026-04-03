/**
 * useAnimationController
 *
 * 步骤动画控制器（Build Animation） v2
 *
 * 架构说明：
 *   - 入场动画（Auto-play）：由 slide 的 tang.onLoad 回调负责，框架不干涉
 *   - 步骤动画（Build）：由本控制器统一管理，基于 data-step-N 多绑定属性
 *
 * 多绑定支持：
 *   - 同一元素可绑定多个步骤，如 data-step-1="1" data-step-2="3"
 *   - 各步骤独立存入 stepMap，触发时自动判别 in/out 方向
 *   - in  → gsap.from()（该元素最小步骤号，元素首次出现）
 *   - out → gsap.to()（后续步骤，元素飞出后隐藏）
 *
 * 关键特性：
 *   - controller 封装在 useRef 里，返回稳定引用（防止 useEffect 依赖循环）
 *   - 运行时状态用闭包变量，不用 React state（避免不必要的重渲染）
 *   - 隐藏使用 visibility:hidden（不用 display:none，canvas 尺寸不归零）
 *   - N 步需 N+1 次点击（最后一步 advance() 仍返回 'stepped'，再点一次才 'done'）
 */

import { useRef } from 'react'
import { useUiStore } from '../store/uiStore'
import { useAnimStore } from '../store/animStore'
import { parseAnimBindings, getPreset, AnimBinding } from '../utils/animPresets'

// ── 内部类型 ─────────────────────────────────────────────────────────────────

interface StepEntry {
  el:      HTMLElement
  binding: AnimBinding
}

// ── 公开接口 ─────────────────────────────────────────────────────────────────

export interface AnimationController {
  /** 扫描 data-step-N 属性，建立 stepMap（在 <script> 执行后调用）。
   *  演示模式下不立即隐藏元素，需在 _runLoad() 后手动调用 initHideForPresentation()。*/
  init(slideEl: HTMLElement | null): void
  /** 演示模式专用：在 tang._runLoad() 执行之后调用，隐藏尚未到达步骤的入场元素。
   *  这样 onLoad 里的 gsap.from 可以先正常播放，不被提前的 visibility:hidden 干扰。*/
  initHideForPresentation(): void
  /** 推进一步：返回 'stepped'（继续等待）或 'done'（外部翻页） */
  advance(): 'stepped' | 'done'
  /** 回退一步：返回 'retreated'（继续）或 'at-start'（外部翻到上一页） */
  retreat(): 'retreated' | 'at-start'
  /** 编辑模式：立即显示所有步骤元素 */
  revealAll(): void
  /** 换页时清理状态 */
  dispose(): void
}

// ── Hook ─────────────────────────────────────────────────────────────────────

export function useAnimationController(): AnimationController {
  const ctrlRef = useRef<AnimationController | null>(null)
  if (!ctrlRef.current) {
    ctrlRef.current = createController()
  }
  return ctrlRef.current
}

// ── 控制器工厂 ────────────────────────────────────────────────────────────────

function createController(): AnimationController {
  let currentStep = 0
  let totalSteps  = 0

  /**
   * stepMap: Map<stepNumber, StepEntry[]>
   * 同一步骤可有多个条目（不同元素，或同一元素的某个绑定）
   */
  const stepMap = new Map<number, StepEntry[]>()

  function getGsap() {
    return (window as unknown as Record<string, unknown>).gsap as any
  }
  function getTang() {
    return (window as unknown as Record<string, unknown>).tang as any
  }
  function syncStore() {
    useAnimStore.getState().setStepState(currentStep, totalSteps)
  }

  // ── 立即隐藏/显示（不播动画） ─────────────────────────────────────────────
  function hideEl(el: HTMLElement) {
    const gsap = getGsap()
    if (gsap) {
      gsap.killTweensOf(el)
      gsap.set(el, { clearProps: 'opacity,transform,x,y,scale' })
    }
    el.style.visibility = 'hidden'
  }

  function showEl(el: HTMLElement) {
    const gsap = getGsap()
    if (gsap) {
      gsap.killTweensOf(el)
      gsap.set(el, { clearProps: 'opacity,transform,x,y,scale' })
    }
    el.style.visibility = 'visible'
  }

  // ── 播放单条目动画 ────────────────────────────────────────────────────────
  function playEntry(entry: StepEntry) {
    const { el, binding } = entry
    const gsap = getGsap()

    if (!gsap) {
      // 无 GSAP：入场直接显示，出场直接隐藏
      if (binding.direction === 'in') showEl(el)
      else hideEl(el)
      return
    }

    const preset = getPreset(binding.animation)

    if (binding.direction === 'in') {
      // ── 入场：gsap.from() ─────────────────────────────────────────────────
      gsap.killTweensOf(el)
      gsap.set(el, { visibility: 'visible', clearProps: 'opacity,transform,x,y,scale' })
      if (Object.keys(preset).length > 0) {
        gsap.from(el, {
          ...preset,
          duration: binding.duration,
          delay:    binding.delay,
          ease:     binding.ease,
        })
      }
    } else {
      // ── 出场：gsap.to() → 播完后隐藏 ─────────────────────────────────────
      gsap.killTweensOf(el)
      if (Object.keys(preset).length === 0) {
        el.style.visibility = 'hidden'
      } else {
        gsap.to(el, {
          ...preset,
          duration: binding.duration,
          delay:    binding.delay,
          ease:     binding.ease,
          onComplete: () => {
            el.style.visibility = 'hidden'
            gsap.set(el, { clearProps: 'opacity,transform,x,y,scale' })
          },
        })
      }
    }
  }

  // ── 播放某步的所有条目 ─────────────────────────────────────────────────────
  function playStep(step: number) {
    const entries = stepMap.get(step) ?? []
    const gsap    = getGsap()
    const tang    = getTang()

    // 优先检查 tang.onStep 自定义回调（兼容旧 custom 模式）
    const customFn = tang?._getStepFn?.(step) as ((els: HTMLElement[]) => void) | undefined
    if (customFn) {
      const els = entries.map(e => e.el)
      if (gsap) gsap.set(els, { visibility: 'visible' })
      else els.forEach(el => { el.style.visibility = 'visible' })
      customFn(els)
      return
    }

    for (const entry of entries) {
      playEntry(entry)
    }
  }

  // ── Controller 实现 ────────────────────────────────────────────────────────

  const ctrl: AnimationController = {

    init(slideEl) {
      currentStep = 0
      totalSteps  = 0
      stepMap.clear()

      if (!slideEl) { syncStore(); return }

      // 扫描所有带 data-step 或 data-step-N 的元素
      // querySelectorAll 用 attribute-contains 匹配所有 data-step 开头的属性
      const candidates = new Set<HTMLElement>()

      // 兼容旧格式 data-step
      slideEl.querySelectorAll<HTMLElement>('[data-step]').forEach(el => candidates.add(el))
      // 新格式 data-step-1 .. data-step-9（最多 9 个）
      for (let i = 1; i <= 9; i++) {
        slideEl.querySelectorAll<HTMLElement>(`[data-step-${i}]`).forEach(el => candidates.add(el))
      }

      for (const el of candidates) {
        const bindings = parseAnimBindings(el)
        for (const binding of bindings) {
          if (!stepMap.has(binding.step)) stepMap.set(binding.step, [])
          stepMap.get(binding.step)!.push({ el, binding })
        }
      }

      if (stepMap.size === 0) { syncStore(); return }

      totalSteps = Math.max(...stepMap.keys())

      const mode = useUiStore.getState().mode

      if (mode === 'edit') {
        // 编辑模式：立即显示所有元素
        for (const entries of stepMap.values()) {
          for (const { el } of entries) showEl(el)
        }
        currentStep = totalSteps
      }
      // 演示模式：初始隐藏留给 initHideForPresentation() 在 onLoad 之后调用

      syncStore()
    },

    /**
     * 演示模式专用：在 tang._runLoad() **之后** 调用，隐藏尚未到达步骤的入场元素。
     * 这样 onLoad 里的 gsap.from 动画能正常对元素做入场，不会被提前 hidden 干扰。
     */
    initHideForPresentation() {
      for (const entries of stepMap.values()) {
        for (const { binding, el } of entries) {
          if (binding.direction === 'in') hideEl(el)
        }
      }
    },

    advance() {
      if (totalSteps === 0) return 'done'
      if (currentStep >= totalSteps) return 'done'

      currentStep++
      playStep(currentStep)
      syncStore()
      return 'stepped'
    },

    retreat() {
      if (totalSteps === 0 || currentStep <= 0) return 'at-start'

      // 回退当前步：
      //   入场 entry → 重新隐藏（取消显示）
      //   出场 entry → 重新显示（取消隐藏）
      const entries = stepMap.get(currentStep) ?? []
      const gsap    = getGsap()
      for (const { el, binding } of entries) {
        if (gsap) gsap.killTweensOf(el)
        if (binding.direction === 'in') {
          hideEl(el)
        } else {
          showEl(el)
        }
      }

      currentStep--
      syncStore()
      return currentStep <= 0 ? 'at-start' : 'retreated'
    },

    revealAll() {
      for (const entries of stepMap.values()) {
        for (const { el } of entries) showEl(el)
      }
      currentStep = totalSteps
      syncStore()
    },

    dispose() {
      const gsap = getGsap()
      for (const entries of stepMap.values()) {
        if (gsap) gsap.killTweensOf(entries.map(e => e.el))
      }
      currentStep = 0
      totalSteps  = 0
      stepMap.clear()
      syncStore()
    },

  }

  return ctrl
}
