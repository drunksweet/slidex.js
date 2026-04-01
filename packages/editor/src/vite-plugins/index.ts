/**
 * @tang-slidex/editor — Vite 插件
 *
 * slideInspectorPlugin  — 开发模式：给 slide HTML 注入行号 data-tang-* 属性
 * slideSavePlugin        — 接收前端 WysiwygPatch[]，行级写回 HTML 文件（替换 JSDOM 方案）
 * slideUndoPlugin        — 支持 POST /api/undo，基于内存历史栈
 *
 * 使用：
 *   import { slideInspectorPlugin, slideSavePlugin, slideUndoPlugin } from '@tang-slidex/editor/vite-plugins'
 *   // 在 vite.config.js 中引入这三个插件
 */

export { slideInspectorPlugin } from './slideInspectorPlugin.js'
export { slideSavePlugin, slideUndoPlugin } from './slideSavePlugin.js'
