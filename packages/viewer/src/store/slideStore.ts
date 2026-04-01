import { create } from 'zustand'

interface SlideState {
  current:   number
  total:     number
  isLoading: boolean
  scale:     number
}

interface SlideActions {
  setCurrent:  (i: number) => void
  setTotal:    (n: number) => void
  setLoading:  (b: boolean) => void
  setScale:    (s: number) => void
}

export const useSlideStore = create<SlideState & SlideActions>((set) => ({
  current:   0,
  total:     0,
  isLoading: true,
  scale:     1,

  setCurrent:  (i) => set({ current: i }),
  setTotal:    (n) => set({ total: n }),
  setLoading:  (b) => set({ isLoading: b }),
  setScale:    (s) => set({ scale: s }),
}))
