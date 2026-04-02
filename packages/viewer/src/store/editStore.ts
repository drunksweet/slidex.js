import { create } from 'zustand'

interface EditState {
  isActive:   boolean
  /** .slide 直接子元素（用于拖拽、overlay、layout 对齐） */
  selectedEl: Element | null
  /** 实际被点击的、最近有 data-tang-line 的元素（用于 StyleTab 样式编辑） */
  leafEl:     Element | null
  isDirty:    boolean
}

interface EditActions {
  setActive:     (b: boolean) => void
  setSelectedEl: (el: Element | null) => void
  setLeafEl:     (el: Element | null) => void
  setDirty:      (b: boolean) => void
}

export const useEditStore = create<EditState & EditActions>((set) => ({
  isActive:   false,
  selectedEl: null,
  leafEl:     null,
  isDirty:    false,

  setActive:     (b)  => set({ isActive: b }),
  setSelectedEl: (el) => set({ selectedEl: el }),
  setLeafEl:     (el) => set({ leafEl: el }),
  setDirty:      (b)  => set({ isDirty: b }),
}))
