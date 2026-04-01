/**
 * @tang-slidex/core
 * 运行时引擎 + PPT 规范
 */

export { SLIDE_STANDARDS } from './standards/index.js'
export type { AspectRatio, SlideType, TransitionType } from './standards/index.js'

export { SlideRunner } from './runner/SlideRunner.js'
export type { SlideRunnerOptions, NavigateOptions } from './runner/SlideRunner.js'

export { themes, defaultTheme, injectTheme, getComputedTheme } from './theme/index.js'
export type { Theme } from './theme/index.js'
