/**
 * elementCapabilities — 元素能力分组
 *
 * 核心思路：编辑模式下每个元素是多种「能力」的组合。
 * 识别结果驱动：
 *   - SelectionBox 是否显示（所有元素始终显示）
 *   - RightPanel 显示哪些 Tab / Section
 *   - 双击行为（文本内联编辑 / 代码编辑器 / 图表配置...）
 *
 * 能力枚举：
 *   layout   — 拖拽移动 / resize / 旋转 / 位置对齐（所有元素都有）
 *   text     — contenteditable 内联文字编辑（含 Style 面板文字区块）
 *   code     — textarea 浮层代码编辑（pre/code 代码块）
 *   chart    — ECharts 图表数据/类型配置（包含 canvas 的图表容器）
 *   image    — 图片 src 替换 / 滤镜（img 或 background-image 容器）
 *   table    — 表格单元格编辑
 *   video    — 视频播放控制（video 元素）
 */

// ─── 能力枚举 ─────────────────────────────────────────────────────────────────

export type ElementCapability =
  | 'layout'   // 所有元素
  | 'text'     // 含文字
  | 'code'     // 代码块
  | 'chart'    // 图表
  | 'image'    // 图片
  | 'table'    // 表格
  | 'video'    // 视频

/** 元素类型标签（给 RightPanel / SelectionBox label 用） */
export type ElementKind =
  | 'generic'  // 纯布局块
  | 'text'
  | 'code'
  | 'chart'
  | 'image'
  | 'table'
  | 'video'

export interface ElementCapabilityInfo {
  /** 能力集合 */
  capabilities: Set<ElementCapability>
  /** 主类型（用于面板标题 / 标签展示） */
  kind: ElementKind
}

// ─── 识别逻辑 ─────────────────────────────────────────────────────────────────

/**
 * 识别一个 .slide 直接子元素（blockEl）的能力组合。
 *
 * 注意：blockEl 是 .slide 的直接子元素，不是用户实际点击的 leafEl。
 * 这里做的是整块元素的能力识别，leafEl 的精细区分由调用方处理。
 */
export function resolveElementCapabilities(blockEl: HTMLElement): ElementCapabilityInfo {
  const caps = new Set<ElementCapability>(['layout'])

  // ── 图表（ECharts：含 canvas 子元素，或有 data-chart 标记）
  if (
    blockEl.querySelector('canvas') !== null ||
    blockEl.dataset['chart'] != null ||
    blockEl.dataset['echartsInit'] != null ||
    blockEl.classList.contains('chart') ||
    blockEl.classList.contains('echarts')
  ) {
    caps.add('chart')
    return { capabilities: caps, kind: 'chart' }
  }

  // ── 视频
  if (
    blockEl.tagName === 'VIDEO' ||
    blockEl.querySelector('video') !== null
  ) {
    caps.add('video')
    return { capabilities: caps, kind: 'video' }
  }

  // ── 代码块（pre > code，或有 data-codebox 标记）
  if (
    blockEl.tagName === 'PRE' ||
    blockEl.querySelector('pre code') !== null ||
    blockEl.dataset['codebox'] != null
  ) {
    caps.add('code')
    // 代码块通常也有文字（注释等），但编辑方式是 textarea 浮层，不走 contenteditable
    return { capabilities: caps, kind: 'code' }
  }

  // ── 表格
  if (
    blockEl.tagName === 'TABLE' ||
    blockEl.querySelector('table') !== null
  ) {
    caps.add('table')
    caps.add('text') // 单元格内文字可编辑
    return { capabilities: caps, kind: 'table' }
  }

  // ── 图片（img 标签，或 background-image 非空）
  if (blockEl.tagName === 'IMG') {
    caps.add('image')
    return { capabilities: caps, kind: 'image' }
  }
  if (blockEl.querySelector('img') !== null) {
    caps.add('image')
    // 如果同时有文字（如图文卡片），也加 text
    if (_hasDirectText(blockEl)) caps.add('text')
    return { capabilities: caps, kind: 'image' }
  }
  const bgImage = window.getComputedStyle(blockEl).backgroundImage
  if (bgImage && bgImage !== 'none') {
    caps.add('image')
    if (_hasDirectText(blockEl)) caps.add('text')
    return { capabilities: caps, kind: 'image' }
  }

  // ── 纯文本块（有直接或后代文本内容，且没有上述特殊子元素）
  if (_hasAnyText(blockEl)) {
    caps.add('text')
    return { capabilities: caps, kind: 'text' }
  }

  // ── 兜底：纯布局块（装饰性 div、分隔线等）
  return { capabilities: caps, kind: 'generic' }
}

// ─── 工具函数 ─────────────────────────────────────────────────────────────────

/** 元素自身或直接子节点是否有非空文本 */
function _hasDirectText(el: HTMLElement): boolean {
  return Array.from(el.childNodes).some(
    n => n.nodeType === Node.TEXT_NODE && (n.textContent?.trim().length ?? 0) > 0
  )
}

/** 元素子树内是否存在任何非空文本（含后代） */
function _hasAnyText(el: HTMLElement): boolean {
  return (el.textContent?.trim().length ?? 0) > 0
}
