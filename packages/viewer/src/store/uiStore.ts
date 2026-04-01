import { create } from 'zustand'

export type ViewMode = 'present' | 'edit'
export type RightTab = 'style' | 'layout' | 'animate' | 'ai'

interface UiState {
  mode:          ViewMode
  leftPanelOpen: boolean
  rightTab:      RightTab
  toastMsg:      string | null
  toastType:     'success' | 'error' | 'info'
}

interface UiActions {
  setMode:         (m: ViewMode) => void
  toggleLeftPanel: () => void
  setRightTab:     (t: RightTab) => void
  showToast:       (msg: string, type?: 'success' | 'error' | 'info') => void
  hideToast:       () => void
}

export const useUiStore = create<UiState & UiActions>((set) => ({
  mode:          'present',
  leftPanelOpen: true,
  rightTab:      'style',
  toastMsg:      null,
  toastType:     'info',

  setMode:         (m) => set({ mode: m }),
  toggleLeftPanel: () => set((s) => ({ leftPanelOpen: !s.leftPanelOpen })),
  setRightTab:     (t) => set({ rightTab: t }),
  showToast:       (msg, type = 'info') => {
    set({ toastMsg: msg, toastType: type })
    setTimeout(() => set({ toastMsg: null }), 2800)
  },
  hideToast: () => set({ toastMsg: null }),
}))
