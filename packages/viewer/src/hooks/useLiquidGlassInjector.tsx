/**
 * useLiquidGlassInjector
 *
 * 把 LiquidGlass 组件动态注入到目标 DOM 元素上。
 *
 * 方案：
 *   1. 在目标 el 内部创建一个绝对定位的覆盖层容器 (.lg-host)
 *   2. 用 ReactDOM.createRoot 在覆盖层上挂载 <LiquidGlass>
 *   3. 覆盖层用 pointer-events:none 不干扰原始内容交互
 *   4. eject() 时 unmount 并移除覆盖层，还原原始状态
 *
 * 这样目标元素的原始内容、事件、样式完全不变，液态玻璃层叠加在上面。
 */

import { useRef, useCallback } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import LiquidGlass from 'liquid-glass-react'

export interface LiquidGlassParams {
  displacementScale:   number
  blurAmount:          number
  saturation:          number
  aberrationIntensity: number
  elasticity:          number
  cornerRadius:        number
  overLight:           boolean
  mode: 'standard' | 'polar' | 'prominent' | 'shader'
}

const HOST_ATTR = 'data-lg-host'

export function useLiquidGlassInjector(): {
  inject: (el: Element, params: LiquidGlassParams) => void
  eject: () => void
  isInjected: (el: Element) => boolean
} {
  const rootRef = useRef<Root | null>(null)
  const hostRef = useRef<HTMLElement | null>(null)

  /** 注入 / 更新液态玻璃层 */
  const inject = useCallback((el: Element, params: LiquidGlassParams) => {
    const hel = el as HTMLElement

    // 确保目标元素有 position（LiquidGlass 需要相对定位父容器）
    const pos = window.getComputedStyle(hel).position
    if (pos === 'static') hel.style.position = 'relative'

    // 找或创建覆盖层
    let host = hel.querySelector<HTMLElement>(`[${HOST_ATTR}]`)
    if (!host) {
      host = document.createElement('div')
      host.setAttribute(HOST_ATTR, '1')
      host.style.cssText = [
        'position:absolute',
        'inset:0',
        'pointer-events:none',  // 不遮挡原始内容点击
        'z-index:0',
        'overflow:hidden',
        'border-radius:inherit',
      ].join(';')
      hel.insertBefore(host, hel.firstChild)
    }
    hostRef.current = host

    // 如果 root 已存在直接 re-render，否则创建
    if (!rootRef.current) {
      rootRef.current = createRoot(host)
    }

    rootRef.current.render(
      <LiquidGlass
        displacementScale={params.displacementScale}
        blurAmount={params.blurAmount}
        saturation={params.saturation}
        aberrationIntensity={params.aberrationIntensity}
        elasticity={params.elasticity}
        cornerRadius={params.cornerRadius}
        overLight={params.overLight}
        mode={params.mode}
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
        }}
      >
        {/* LiquidGlass 需要 children，给空内容即可；实际内容在父元素原始 DOM 里 */}
        <span />
      </LiquidGlass>
    )
  }, [])

  /** 移除液态玻璃层，还原元素 */
  const eject = useCallback(() => {
    if (rootRef.current) {
      rootRef.current.unmount()
      rootRef.current = null
    }
    if (hostRef.current) {
      hostRef.current.remove()
      hostRef.current = null
    }
  }, [])

  /** 检查某个元素是否已注入 */
  const isInjected = useCallback((el: Element) => {
    return !!el.querySelector(`[${HOST_ATTR}]`)
  }, [])

  return { inject, eject, isInjected }
}
