import { useEffect, useRef } from 'react'
import { EditManager } from '@tang-slidex/editor'
import { useSlideStore } from '../store/slideStore'
import { useEditStore } from '../store/editStore'
import { useUiStore } from '../store/uiStore'

type OverlayRef = React.RefObject<HTMLDivElement | null>

export function useEditManager(
  stageRef:  React.RefObject<HTMLDivElement | null>,
  overlayRef: OverlayRef,
  alignHRef:  OverlayRef,
  alignVRef:  OverlayRef,
) {
  const managerRef = useRef<EditManager | null>(null)
  // 用 ref 持有当前选中元素，避免闭包陈旧
  const selectedElRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    const stage = stageRef.current
    if (!stage) return

    // ── 工具函数 ──────────────────────────────────────────────────────────────

    function updateOverlay(el: HTMLElement) {
      const overlay = overlayRef.current
      if (!overlay) return
      const rect = el.getBoundingClientRect()
      overlay.style.display = 'block'
      overlay.style.left    = `${rect.left   - 2}px`
      overlay.style.top     = `${rect.top    - 2}px`
      overlay.style.width   = `${rect.width  + 4}px`
      overlay.style.height  = `${rect.height + 4}px`

      const tag = el.tagName.toLowerCase()
      const cls = el.className?.split?.(' ').find((c: string) => c && !c.startsWith('tang-')) ?? ''
      overlay.dataset.label = cls ? `${tag}.${cls}` : tag
    }

    function hideOverlay() {
      if (overlayRef.current) overlayRef.current.style.display = 'none'
    }

    function showGuides(el: HTMLElement) {
      const stageEl = stageRef.current
      if (!stageEl || !alignHRef.current || !alignVRef.current) return
      const rect     = el.getBoundingClientRect()
      const hostRect = stageEl.getBoundingClientRect()
      const cx = rect.left + rect.width  / 2
      const cy = rect.top  + rect.height / 2
      const hx = hostRect.left + hostRect.width  / 2
      const hy = hostRect.top  + hostRect.height / 2
      const snap = 10 / useSlideStore.getState().scale

      if (Math.abs(cy - hy) < snap) {
        alignHRef.current.style.cssText = `display:block;top:${hy}px;`
      } else {
        alignHRef.current.style.display = 'none'
      }
      if (Math.abs(cx - hx) < snap) {
        alignVRef.current.style.cssText = `display:block;left:${hx}px;`
      } else {
        alignVRef.current.style.display = 'none'
      }
    }

    function hideGuides() {
      if (alignHRef.current) alignHRef.current.style.display = 'none'
      if (alignVRef.current) alignVRef.current.style.display = 'none'
    }

    function selectElement(el: HTMLElement) {
      selectedElRef.current = el
      useEditStore.getState().setSelectedEl(el)
      updateOverlay(el)
    }

    function clearSelection() {
      selectedElRef.current = null
      useEditStore.getState().setSelectedEl(null)
      hideOverlay()
    }

    // ── 创建 EditManager ───────────────────────────────────────────────────────
    const manager = new EditManager({
      slideStage:      stage,
      getCurrentIndex: () => useSlideStore.getState().current,
      getCurrentScale: () => useSlideStore.getState().scale,
      showToast:       (msg, type) => useUiStore.getState().showToast(msg, type),

      onStateChange: (active) => {
        useEditStore.getState().setActive(active)
        if (!active) {
          clearSelection()
          useEditStore.getState().setDirty(false)
          hideGuides()
        }
      },

      // EditManager 在拖拽时回调（不负责选中，选中由 mousedown 处理）
      onElementClick: (el) => {
        selectElement(el)
      },

      onDragMove: (el) => {
        updateOverlay(el)
        showGuides(el)
      },

      onDragEnd: () => hideGuides(),
    })

    managerRef.current = manager

    // ── 在 slide-host 上监听 mousedown：选中 .slide 的直接子元素 ────────────────
    // 这与 tech-intro/index.html 中 EditUI 的逻辑完全对应
    const onMouseDown = (e: MouseEvent) => {
      if (!manager.active) return
      const target = e.target as HTMLElement | null
      if (!target) return

      requestAnimationFrame(() => {
        const slide = stage.querySelector<HTMLElement>('.slide')
        if (!slide) return

        let el: HTMLElement | null = target
        // 向上找到 .slide 的直接子元素
        while (el && el.parentElement !== slide) {
          el = el.parentElement as HTMLElement | null
          if (!el || el === stage) {
            clearSelection()
            return
          }
        }
        if (el && el !== slide) selectElement(el)
      })
    }

    // 点击 slide-host 外部 → 取消选中
    const onDocMouseDown = (e: MouseEvent) => {
      if (!manager.active) return
      if (!stage.contains(e.target as Node)) {
        clearSelection()
      }
    }

    stage.addEventListener('mousedown', onMouseDown)
    document.addEventListener('mousedown', onDocMouseDown)

    // ── 换页后重新绑定 EditManager（保持编辑模式） ─────────────────────────────
    const onSlideLoaded = () => {
      const mgr = managerRef.current
      if (!mgr) return

      clearSelection()
      hideGuides()

      if (mgr.active) {
        // 稍等脚本执行完再 rebind（脚本也在 rAF 里执行）
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            mgr.rebind()
          })
        })
      }
    }

    document.addEventListener('tang:slide-loaded', onSlideLoaded)

    return () => {
      stage.removeEventListener('mousedown', onMouseDown)
      document.removeEventListener('mousedown', onDocMouseDown)
      document.removeEventListener('tang:slide-loaded', onSlideLoaded)
      if (managerRef.current?.active) managerRef.current.disable()
      managerRef.current = null
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return managerRef
}
