import { useEffect, useRef } from 'react'
import { EditManager } from '@tang-slidex/editor'
import { useSlideStore } from '../store/slideStore'
import { useEditStore } from '../store/editStore'
import { useUiStore } from '../store/uiStore'
import { resolveElementCapabilities } from '../utils/elementCapabilities'
import type { SelectionBoxHandle } from '../components/StageArea/SelectionBox'

type AlignRef = React.RefObject<HTMLDivElement | null>

export function useEditManager(
  stageRef:   React.RefObject<HTMLDivElement | null>,
  selBoxRef:  React.RefObject<SelectionBoxHandle | null>,
  alignHRef:  AlignRef,
  alignVRef:  AlignRef,
) {
  const managerRef    = useRef<EditManager | null>(null)
  /** 当前 block 级元素（.slide 直接子元素），ref 避免闭包陈旧 */
  const blockElRef    = useRef<HTMLElement | null>(null)
  /** 当前 child/text 级操作目标元素 */
  const activeLeafRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    const stage = stageRef.current
    if (!stage) return

    // ── 工具函数 ──────────────────────────────────────────────────────────────

    function updateSelBox(el: HTMLElement, mode: 'normal' | 'text-editing' = 'normal') {
      selBoxRef.current?.update(el, mode)
    }

    function hideSelBox() {
      selBoxRef.current?.hide()
    }

    function hideGuides() {
      if (alignHRef.current) alignHRef.current.style.display = 'none'
      if (alignVRef.current) alignVRef.current.style.display = 'none'
    }

    /**
     * 解析 leafEl：用户真正「想编辑样式的最小元素」。
     *
     * 策略（优先级从高到低）：
     *   1. clickTarget 本身有 class 或 style → 直接用
     *   2. 向上找第一个有 class/style 的祖先（不越过 blockEl）
     *   3. 兜底：返回 blockEl
     *
     * 注意：data-tang-line 只用于「保存时定位源码行号」，
     * 不再用来决定「样式面板作用到哪个元素」，两者职责分离。
     */
    function resolveLeafEl(clickTarget: HTMLElement, blockEl: HTMLElement): HTMLElement {
      if (clickTarget.classList.length > 0 || clickTarget.getAttribute('style')) {
        return clickTarget
      }
      let el: HTMLElement | null = clickTarget.parentElement as HTMLElement | null
      while (el && el !== blockEl.parentElement) {
        if (el.classList.length > 0 || el.getAttribute('style')) return el
        el = el.parentElement as HTMLElement | null
      }
      return blockEl
    }

    // ── 状态机：三个状态转移函数 ───────────────────────────────────────────────

    /**
     * BLOCK_SELECTED：单击任意 slide 子元素
     * SelectionBox 框住 blockEl，可整体拖拽/resize/旋转。
     */
    function enterBlockSelected(blockEl: HTMLElement) {
      const { kind } = resolveElementCapabilities(blockEl)
      blockElRef.current    = blockEl
      activeLeafRef.current = blockEl   // block 级，leaf 同 block

      useEditStore.getState().setSelectedEl(blockEl)
      useEditStore.getState().setLeafEl(blockEl)
      useEditStore.getState().setSelectionLevel('block')
      useEditStore.getState().setElementKind(kind)

      updateSelBox(blockEl, 'normal')
    }

    /**
     * CHILD_SELECTED：双击进入块内，选中具体子元素（非文字）。
     * SelectionBox 框住 leafEl，可对子元素单独 resize/旋转。
     */
    function enterChildSelected(blockEl: HTMLElement, leafEl: HTMLElement) {
      activeLeafRef.current = leafEl

      useEditStore.getState().setSelectedEl(blockEl)
      useEditStore.getState().setLeafEl(leafEl)
      useEditStore.getState().setSelectionLevel('child')
      // elementKind 不变（仍是 blockEl 的类型）

      updateSelBox(leafEl, 'normal')
    }

    /**
     * TEXT_EDITING：双击文字元素，contenteditable 光标激活。
     * SelectionBox 显示细边框（标记位置），禁用拖拽/resize/旋转手柄交互。
     */
    function enterTextEditing(blockEl: HTMLElement, leafEl: HTMLElement) {
      activeLeafRef.current = leafEl

      useEditStore.getState().setSelectedEl(blockEl)
      useEditStore.getState().setLeafEl(leafEl)
      useEditStore.getState().setSelectionLevel('text-editing')

      // text-editing 模式：SelectionBox 显示细边框，不可拖拽
      updateSelBox(blockEl, 'text-editing')
    }

    /**
     * 退回上一级：
     *   text-editing / child → 回到 BLOCK_SELECTED
     *   block → 清空（回到 idle）
     */
    function stepBack() {
      const level = useEditStore.getState().selectionLevel
      const blockEl = blockElRef.current

      if ((level === 'text-editing' || level === 'child') && blockEl) {
        enterBlockSelected(blockEl)
      } else {
        clearSelection()
      }
    }

    function clearSelection() {
      blockElRef.current    = null
      activeLeafRef.current = null
      useEditStore.getState().setSelectedEl(null)
      useEditStore.getState().setLeafEl(null)
      useEditStore.getState().setSelectionLevel(null)
      useEditStore.getState().setElementKind(null)
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
        // EditManager 内部的 onElementClick 仅在 blockEl 级触发（旧回调），
        // 实际交互已由下方 mousedown/dblclick 接管，这里保留兜底
        enterBlockSelected(el)
      },

      onDragMove: (el) => {
        // 拖拽时更新 SelectionBox 位置（el 是正在被拖拽的元素）
        selBoxRef.current?.update(el, useEditStore.getState().selectionLevel === 'text-editing' ? 'text-editing' : 'normal')
      },

      onDragEnd: () => {},
    })

    managerRef.current = manager

    // ── mousedown：单击选中（BLOCK_SELECTED） ───────────────────────────────────
    const onMouseDown = (e: MouseEvent) => {
      if (!manager.active) return
      const target = e.target as HTMLElement | null
      if (!target) return

      requestAnimationFrame(() => {
        const slide = stage.querySelector<HTMLElement>('.slide')
        if (!slide) return

        // 向上找 .slide 的直接子元素（blockEl）
        let el: HTMLElement | null = target
        while (el && el.parentElement !== slide) {
          el = el.parentElement as HTMLElement | null
          if (!el || el === stage) {
            // 点到 slide 外（如背景空白）→ 清空
            clearSelection()
            return
          }
        }
        if (!el || el === slide) return

        const blockEl = el
        const currentLevel = useEditStore.getState().selectionLevel

        if (currentLevel === 'text-editing' || currentLevel === 'child') {
          // 已在子级编辑状态
          const currentBlock = blockElRef.current
          if (blockEl !== currentBlock) {
            // 点击了另一个 blockEl → 退出子级，选中新 block
            enterBlockSelected(blockEl)
          }
          // 点击同一 block 内部 → 保持状态，让浏览器处理文字光标
        } else {
          // idle 或 block 状态 → 切换到（或留在）BLOCK_SELECTED
          if (blockEl !== blockElRef.current) {
            enterBlockSelected(blockEl)
          }
          // 点击已选中的同一 blockEl → 不做任何改变（等双击）
        }
      })
    }

    // ── dblclick：双击进入子级（CHILD_SELECTED 或 TEXT_EDITING） ─────────────────
    const onDblClick = (e: MouseEvent) => {
      if (!manager.active) return
      const target = e.target as HTMLElement | null
      if (!target) return

      const slide = stage.querySelector<HTMLElement>('.slide')
      if (!slide) return

      // 找 blockEl
      let el: HTMLElement | null = target
      while (el && el.parentElement !== slide) {
        el = el.parentElement as HTMLElement | null
        if (!el || el === stage) return
      }
      if (!el || el === slide) return

      const blockEl = el
      const leafEl = resolveLeafEl(target, blockEl)

      // 判断 leafEl 是否是文字可编辑元素
      const isTextEditable = leafEl.classList.contains('tang-editable') ||
        (leafEl as HTMLElement).contentEditable === 'true'

      if (isTextEditable) {
        enterTextEditing(blockEl, leafEl)
        // 确保 focus 给到 leafEl（contenteditable）
        ;(leafEl as HTMLElement).focus()
      } else {
        enterChildSelected(blockEl, leafEl)
      }
    }

    // ── 点击 slide-host 外部（UI 面板）保留选中；点击 body/html 清空 ─────────────
    const onDocMouseDown = (e: MouseEvent) => {
      if (!manager.active) return
      const target = e.target as HTMLElement | null
      if (!target) return

      if (stage.contains(target)) return  // slide 内部由 onMouseDown 处理

      // 点到 UI 面板（TopBar / RightPanel 等）→ 保留选中
      if (target !== document.body && target !== document.documentElement) return

      clearSelection()
    }

    // ── Escape：退回上一级 ────────────────────────────────────────────────────
    const onKeyDown = (e: KeyboardEvent) => {
      if (!manager.active) return
      if (e.key !== 'Escape') return
      // 阻止 StageArea 里的全局 Escape 处理（那里是退出编辑模式）
      e.stopPropagation()
      stepBack()
    }

    stage.addEventListener('mousedown', onMouseDown)
    stage.addEventListener('dblclick',  onDblClick)
    document.addEventListener('mousedown', onDocMouseDown)
    // capture=true 让这个 Escape 先于 StageArea 的 keydown 处理
    document.addEventListener('keydown', onKeyDown, true)

    // ── 换页后重置 ─────────────────────────────────────────────────────────────
    const onSlideLoaded = () => {
      const mgr = managerRef.current
      if (!mgr) return

      clearSelection()
      hideGuides()

      if (mgr.active) {
        requestAnimationFrame(() => {
          requestAnimationFrame(() => { mgr.rebind() })
        })
      }
    }

    document.addEventListener('tang:slide-loaded', onSlideLoaded)

    return () => {
      stage.removeEventListener('mousedown', onMouseDown)
      stage.removeEventListener('dblclick',  onDblClick)
      document.removeEventListener('mousedown', onDocMouseDown)
      document.removeEventListener('keydown', onKeyDown, true)
      document.removeEventListener('tang:slide-loaded', onSlideLoaded)
      if (managerRef.current?.active) managerRef.current.disable()
      managerRef.current = null
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return managerRef
}
