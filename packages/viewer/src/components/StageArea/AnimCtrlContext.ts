/**
 * AnimCtrlContext — 动画控制器 React Context
 * 单独文件以兼容 Vite Fast Refresh（避免混合导出 context + component 的警告）
 */
import { createContext, useContext } from 'react'
import type { AnimationController } from '../../hooks/useAnimationController'

export const AnimCtrlContext = createContext<AnimationController | null>(null)
export function useAnimCtrl() { return useContext(AnimCtrlContext) }
