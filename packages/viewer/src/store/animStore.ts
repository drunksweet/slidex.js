/**
 * animStore — 动画状态 Zustand Store
 *
 * 驱动 NavBar 步骤点 UI 和 AnimateTab 步骤编号显示。
 * 只存当前页的步骤状态，换页时由 animCtrl.dispose() 调用 resetSteps() 清零。
 */
import { create } from 'zustand'

interface AnimState {
  /** 当前已完成的步骤数（0 = 全部隐藏） */
  currentStep: number
  /** 当前页总步骤数（0 = 无步骤动画） */
  totalSteps:  number
  /** 由 AnimationController 调用，同步步骤进度 */
  setStepState: (current: number, total: number) => void
  /** 便捷方法：重置为零 */
  resetSteps: () => void
}

export const useAnimStore = create<AnimState>()((set) => ({
  currentStep: 0,
  totalSteps:  0,
  setStepState: (current, total) => set({ currentStep: current, totalSteps: total }),
  resetSteps:   ()               => set({ currentStep: 0, totalSteps: 0 }),
}))
