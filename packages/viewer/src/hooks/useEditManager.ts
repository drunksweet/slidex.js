import { useEffect, useRef } from 'react'
import { EditManager } from '@tang-slidex/editor'
import { useSlideStore } from '../store/slideStore'
import { useEditStore } from '../store/editStore'
import { useUiStore } from '../store/uiStore'
import type { SelectionBoxHandle } from '../components/StageArea/SelectionBox'

type AlignRef = React.RefObject<HTMLDivElement | null>

export function useEditManager(
  stageRef:   React.RefObject<HTMLDivElement | null>,
  selBoxRef:  React.RefObject<SelectionBoxHandle | null>,
  alignHRef:  AlignRef,
  alignVRef:  AlignRef,
) {
  const managerRef = useRef<EditManager | null>(null)
  // 用 ref 持有当前选中元素，避免闭包陈旧
  const selectedElRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    const stage = stageRef.current
    if (!stage) return

    // ── 工具函数 ──────────────────────────────────────────────────────────────

    function updateSelBox(el: HTMLElement) {
      selBoxRef.current?.update(el)
    }

    function hideSelBox() {
      selBoxRef.current?.hide()
    }

    function hideGuides() {
      if (alignHRef.current) alignHRef.current.style.display = 'none'
      if (alignVRef.current) alignVRef.current.style.display = 'none'
    }

    /**
     * 从点击目标向上找最近有 data-tang-line 的元素（即 leafEl），
     * 用于 StyleTab 精确作用到用户真正点击的节点。
     */
    function resolveLeafEl(clickTarget: HTMLElement, blockEl: HTMLElement): HTMLElement {
      let el: HTMLElement | null = clickTarget
      while (el && el !== blockEl.parentElement) {
        if (el.dataset?.tangLine) return el
        el = el.parentElement as HTMLElement | null
      }
      // 兜底：返回 blockEl 本身
      return blockEl
    }

    function selectElement(blockEl: HTMLElement, clickTarget?: HTMLElement) {
      selectedElRef.current = blockEl
      const leafEl = clickTarget ? resolveLeafEl(clickTarget, blockEl) : blockEl
      useEditStore.getState().setSelectedEl(blockEl)
      useEditStore.getState().setLeafEl(leafEl)
      updateSelBox(blockEl)
    }

    function clearSelection() {
      selectedElRef.current = null
      useEditStore.getState().setSelectedEl(null)
      useEditStore.getState().setLeafEl(null)
      hideSelBox()
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

      onElementClick: (el) => {
        selectElement(el)
      },

      onDragMove: (el) => {
        updateSelBox(el)
      },

      onDragEnd: () => {},
    })

    managerRef.current = manager

    // ── 在 slide-host 上监听 mousedown：选中 .slide 的直接子元素 ────────────────
    const onMouseDown = (e: MouseEvent) => {
      if (!manager.active) return
      const target = e.target as HTMLElement | null
      if (!target) return

      requestAnimationFrame(() => {
        const slide = stage.querySelector<HTMLElement>('.slide')
        if (!slide) return

        let el: HTMLElement | null = target
        // 向上找到 .slide 的直接子元素（blockEl，用于拖拽 / overlay）
        while (el && el.parentElement !== slide) {
          el = el.parentElement as HTMLElement | null
          if (!el || el === stage) {
            clearSelection()
            return
          }
        }
        // el = .slide 直接子元素；target = 实际点击元素
        if (el && el !== slide) selectElement(el, target)
      })
    }

    // 点击 slide-host 内的非元素空白 → 取消选中
    // 注意：点 UI 面板（TopBar / SlidePanel / RightPanel / StatusBar）时完全不处理
    const onDocMouseDown = (e: MouseEvent) => {
      if (!manager.active) return
      const target = e.target as HTMLElement | null
      if (!target) return

      // 点在 slide-host 内部
      if (stage.contains(target)) {
        // 点在 slide 里但不在任何 .slide 直接子元素上 → 清空选中
        // （这种情况由 onMouseDown 里 rAF 处理，这里不重复做，已经在那里 clearSelection 了）
        return
      }

      // 点在 slide-host 外：只要不是真正"意外点到页面空白"就保留选中
      // 策略：只要目标有任意祖先是 .app 内的 UI 元素（header/aside/footer/[data-panel]），就保留
      // 最简：只要在 document.body 内且 target 不是 body/html 本身，就保留（UI 总是有具体 target）
      if (target !== document.body && target !== document.documentElement) return

      clearSelection()
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
