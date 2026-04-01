import { useEffect, RefObject } from 'react'

type SizeCallback = (entry: { width: number; height: number }) => void

/** 监听元素尺寸变化，替代 window.resize（三栏布局下舞台宽度 ≠ window 宽度） */
export function useResizeObserver(ref: RefObject<Element | null>, callback: SizeCallback) {
  useEffect(() => {
    if (!ref.current) return
    const el = ref.current

    const ro = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (!entry) return
      const { width, height } = entry.contentRect
      callback({ width, height })
    })

    ro.observe(el)
    // 立即触发一次（初始化缩放）
    const rect = el.getBoundingClientRect()
    callback({ width: rect.width, height: rect.height })

    return () => ro.disconnect()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ref])
}
