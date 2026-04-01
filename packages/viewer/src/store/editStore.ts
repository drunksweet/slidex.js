import { create } from 'zustand'

interface EditState {
  isActive:   boolean
  selectedEl: Element | null
  isDirty:    boolean
}

interface EditActions {
  setActive:     (b: boolean) => void
  setSelectedEl: (el: Element | null) => void
  setDirty:      (b: boolean) => void
}

export const useEditStore = create<EditState & EditActions>((set) => ({
  isActive:   false,
  selectedEl: null,
  isDirty:    false,

  setActive:     (b)  => set({ isActive: b }),
  setSelectedEl: (el) => set({ selectedEl: el }),
  setDirty:      (b)  => set({ isDirty: b }),
}))
