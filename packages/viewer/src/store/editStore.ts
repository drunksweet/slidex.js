import { create } from 'zustand'
import type { ElementKind } from '../utils/elementCapabilities'

/**
 * 两级选择状态机：
 *
 *   null          — 未选中任何元素
 *   'block'       — 单击：选中 .slide 直接子元素（blockEl）
 *                   SelectionBox 框住 blockEl，可整体拖拽/resize/旋转
 *   'child'       — 双击进入：选中块内子元素（leafEl）
 *                   SelectionBox 框住 leafEl，可对子元素单独操作
 *   'text-editing'— 双击文字进入：contenteditable 光标激活
 *                   SelectionBox 显示细边框（标记位置），禁用拖拽手柄
 */
export type SelectionLevel = 'block' | 'child' | 'text-editing'

interface EditState {
  isActive:       boolean
  /** .slide 直接子元素（始终代表"外层容器"，供 LayoutTab 对齐等使用） */
  selectedEl:     Element | null
  /** 当前实际操作的目标元素：block 级 = blockEl，child/text 级 = leafEl */
  leafEl:         Element | null
  /** 当前选中层级，驱动 SelectionBox 样式 + RightPanel 行为 */
  selectionLevel: SelectionLevel | null
  /**
   * 当前选中元素的类型，由 elementCapabilities 识别。
   * 驱动 RightPanel 显示哪些 Tab / Section。
   */
  elementKind:    ElementKind | null
  isDirty:        boolean
}

interface EditActions {
  setActive:         (b: boolean) => void
  setSelectedEl:     (el: Element | null) => void
  setLeafEl:         (el: Element | null) => void
  setSelectionLevel: (level: SelectionLevel | null) => void
  setElementKind:    (kind: ElementKind | null) => void
  setDirty:          (b: boolean) => void
}

export const useEditStore = create<EditState & EditActions>((set) => ({
  isActive:       false,
  selectedEl:     null,
  leafEl:         null,
  selectionLevel: null,
  elementKind:    null,
  isDirty:        false,

  setActive:         (b)     => set({ isActive: b }),
  setSelectedEl:     (el)    => set({ selectedEl: el }),
  setLeafEl:         (el)    => set({ leafEl: el }),
  setSelectionLevel: (level) => set({ selectionLevel: level }),
  setElementKind:    (kind)  => set({ elementKind: kind }),
  setDirty:          (b)     => set({ isDirty: b }),
}))
