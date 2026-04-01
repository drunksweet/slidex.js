/**
 * @tang-slidex/editor — patchHelpers
 *
 * 浏览器端工具函数：
 *   - getAnchor：从 DOM 元素读取 data-tang-line 行号锚点
 *   - cleanInjectAttrs：移除 data-tang-* 属性（用于提交给服务端或 Agent）
 *   - decodeHtmlEntities：将 HTML entities 还原为原始字符
 */

import type { Anchor, LineAnchor } from './types.js'

/**
 * 从 DOM 元素提取行号锚点（依赖 Vite slideInspectorPlugin 注入的 data-tang-* 属性）
 * 如果没有行号信息，退回到 nth-child selector。
 */
export function getAnchor(el: Element, root: Element): Anchor {
  const line = (el as HTMLElement).dataset['tangLine']
  const file = (el as HTMLElement).dataset['tangFile']
  if (line && file) {
    return { type: 'line', file, line: parseInt(line, 10) }
  }
  // fallback：nth-child 路径（无行号信息时使用）
  return { type: 'selector', selector: getNthChildSelector(el, root) }
}

/**
 * 生成 nth-child 路径（fallback，尽量不用）
 */
function getNthChildSelector(el: Element, root: Element): string {
  const parts: string[] = []
  let node: Element | null = el
  while (node && node !== root) {
    const parent = node.parentElement
    if (!parent) break
    const idx = Array.from(parent.children).indexOf(node) + 1
    parts.unshift(`:nth-child(${idx})`)
    node = parent
  }
  return parts.join(' > ')
}

/**
 * 移除 data-tang-line 和 data-tang-file 属性
 * 用于提交给服务端（避免污染源文件）或序列化给 Agent
 */
export function cleanInjectAttrs(html: string): string {
  return html
    .replace(/\s+data-tang-line="\d+"/g, '')
    .replace(/\s+data-tang-file="[^"]*"/g, '')
}

/**
 * 将 HTML entities 还原为原始字符
 * 例：&lt;h1&gt; → <h1>
 */
export function decodeHtmlEntities(str: string): string {
  const ta = document.createElement('textarea')
  ta.innerHTML = str
  return ta.value
}

/**
 * 将 LineAnchor 断言为 LineAnchor（如果是 SelectorAnchor 则返回 null）
 */
export function asLineAnchor(anchor: Anchor): LineAnchor | null {
  return anchor.type === 'line' ? anchor : null
}
