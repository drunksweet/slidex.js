/**
 * @tang-slidex/editor — 类型定义
 *
 * 编辑操作的三层模型：
 *   第一层：改属性值（确定性，行号 + 字符串替换）
 *   第二层：改代码块（AI，有精确上下文约束）
 *   第三层：生成新内容（AI，自由生成）
 */

// ─── 行号锚点（精确定位） ────────────────────────────────────────────────────

export interface LineAnchor {
  type: 'line'
  /** 相对于项目根的文件路径，如 "slides/slide-001.html" */
  file: string
  /** 1-based 行号 */
  line: number
}

export interface SelectorAnchor {
  type: 'selector'
  selector: string
}

export type Anchor = LineAnchor | SelectorAnchor

// ─── 第一层 Patch 类型（WYSIWYG 确定性操作） ──────────────────────────────────

/** 修改文本内容（纯文字，不含 HTML 标签） */
export interface TextPatch {
  type: 'text'
  anchor: LineAnchor
  value: string
  /** 原始值，用于冲突检测 */
  original?: string
}

/** 拖拽移动（translate 偏移量） */
export interface MovePatch {
  type: 'move'
  anchor: LineAnchor
  dx: number
  dy: number
}

/** resize 拖拽尺寸 */
export interface ResizePatch {
  type: 'resize'
  anchor: LineAnchor
  width: number
  height: number
}

/** 旋转角度（单位：deg，正顺时针） */
export interface RotatePatch {
  type: 'rotate'
  anchor: LineAnchor
  deg: number
}

/** 修改单个内联 style 属性 */
export interface StylePropPatch {
  type: 'style-prop'
  anchor: LineAnchor
  property: string
  value: string
}

/** 添加 class */
export interface ClassAddPatch {
  type: 'class-add'
  anchor: LineAnchor
  className: string
}

/** 移除 class */
export interface ClassRemovePatch {
  type: 'class-remove'
  anchor: LineAnchor
  className: string
}

/** 设置 HTML 属性（如 src、href、alt） */
export interface AttrSetPatch {
  type: 'attr-set'
  anchor: LineAnchor
  attr: string
  value: string
}

/** 删除整个元素 */
export interface DeletePatch {
  type: 'delete'
  anchor: LineAnchor
}

/** 第一层所有 Patch 的联合类型 */
export type WysiwygPatch =
  | TextPatch
  | MovePatch
  | ResizePatch
  | RotatePatch
  | StylePropPatch
  | ClassAddPatch
  | ClassRemovePatch
  | AttrSetPatch
  | DeletePatch

// ─── Agent 上下文（第二、三层） ───────────────────────────────────────────────

export interface FragmentContext {
  tagName: string
  classList: string
  line: number | null
  file: string | null
  /** 去除 data-tang-* 属性后的 outerHTML */
  html: string
  textContent: string
}

export interface AgentEditContext {
  slideFile: string
  slideIndex: number
  selectionMode: 'element' | 'range' | 'none'
  selectedCount: number
  fragments: FragmentContext[]
  /** 完整 slide HTML（去除 data-tang-* 注入属性） */
  fullSlideHtml: string
}

// ─── Agent 响应（第二、三层） ─────────────────────────────────────────────────

export interface AgentPatchItem {
  line: number
  file: string
  action: 'replace-text' | 'replace-line' | 'insert-after' | 'delete-line'
  value?: string
}

export interface AgentElementReplacement {
  line: number
  file: string
  newHtml: string
}

export interface AgentInsertion {
  /** 在此行之后插入 */
  afterLine: number
  file: string
  newHtml: string
}

export type AgentEditResponse =
  | {
      editType: 'patch'
      patches: AgentPatchItem[]
      explanation: string
    }
  | {
      editType: 'replace-element'
      elementReplacements: AgentElementReplacement[]
      explanation: string
    }
  | {
      editType: 'insert-after'
      insertions: AgentInsertion[]
      explanation: string
    }
  | {
      editType: 'replace-slide'
      newSlideHtml: string
      explanation: string
    }

// ─── 保存请求（前端 → Vite DevServer） ───────────────────────────────────────

export interface SaveSlideRequest {
  slideIndex: number
  patches: WysiwygPatch[]
}

export interface SaveSlideResponse {
  ok: boolean
  error?: string
}

// ─── 选区事件 ─────────────────────────────────────────────────────────────────

export interface SelectionChangeDetail {
  context: AgentEditContext
}
