 import { useCallback } from 'react'

/**
 * useStyleApply — 统一的样式应用 Hook
 *
 * 封装 tang:apply-style CustomEvent dispatch。
 * 所有 Section 子组件通过此 Hook 操作样式，不直接 dispatch 事件。
 */
export function useStyleApply() {
  /** 设置单条 CSS 属性 */
  const applyStyle = useCallback((el: Element, prop: string, val: string) => {
    document.dispatchEvent(
      new CustomEvent('tang:apply-style', { detail: { el, prop, val } })
    )
  }, [])

  /** 批量设置多条 CSS 属性（如毛玻璃需要同时写多个属性） */
  const applyStyles = useCallback((el: Element, styles: Record<string, string>) => {
    Object.entries(styles).forEach(([prop, val]) => {
      document.dispatchEvent(
        new CustomEvent('tang:apply-style', { detail: { el, prop, val } })
      )
    })
  }, [])

  return { applyStyle, applyStyles }
}
