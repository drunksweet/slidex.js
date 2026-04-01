/**
 * @tang-slidex/editor — 浏览器端入口
 *
 * 导出：
 *   - EditManager    第一层 WYSIWYG 编辑管理器
 *   - SelectionManager  选区管理（AI 辅助编辑上下文）
 *   - patchHelpers   行号锚点工具函数
 *   - types          所有类型定义
 */

export { EditManager }      from './editManager.js'
export type { EditManagerOptions } from './editManager.js'

export { SelectionManager } from './selectionManager.js'
export type { SelectionManagerOptions } from './selectionManager.js'

export { getAnchor, cleanInjectAttrs, decodeHtmlEntities, asLineAnchor } from './patchHelpers.js'

export type {
  // Anchors
  LineAnchor,
  SelectorAnchor,
  Anchor,
  // WYSIWYG Patches
  WysiwygPatch,
  TextPatch,
  MovePatch,
  ResizePatch,
  StylePropPatch,
  ClassAddPatch,
  ClassRemovePatch,
  AttrSetPatch,
  DeletePatch,
  // Agent Context
  AgentEditContext,
  FragmentContext,
  AgentEditResponse,
  AgentPatchItem,
  AgentElementReplacement,
  AgentInsertion,
  // API
  SaveSlideRequest,
  SaveSlideResponse,
  SelectionChangeDetail,
} from './types.js'
