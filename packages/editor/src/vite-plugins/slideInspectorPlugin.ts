/**
 * @tang-slidex/editor — slideInspectorPlugin
 *
 * Vite 开发服务器中间件：拦截 GET /slides/slide-NNN.html 请求，
 * 给每个 HTML 元素注入 data-tang-line 和 data-tang-file 属性。
 *
 * 原理（借鉴 code-inspector）：
 *   1. 拦截 slides HTML 请求（中间件方式，比 transform 更可靠）
 *   2. 从磁盘读取原始 HTML，注入行号元数据
 *   3. 返回注入后的内容（仅在内存，不写回源文件）
 *   4. 浏览器端 EditManager / SelectionManager 读取行号作为锚点
 */

import path from 'node:path'
import fs from 'node:fs'
import type { Plugin } from 'vite'

// 跳过注入的标签（不可编辑/非内容标签）
const SKIP_TAGS = new Set([
  'style', 'script', 'meta', 'link', 'head', 'html', 'body',
  'br', 'hr', 'img', 'input', 'area', 'base', 'col', 'embed',
  'param', 'source', 'track', 'wbr',
])

/**
 * 给 HTML 字符串的每个开标签注入 data-tang-line 和 data-tang-file
 * 使用逐行正则处理，保留原始格式（注释、缩进、空白）
 */
export function injectLineNumbers(html: string, relPath: string): string {
  const lines = html.split('\n')

  const result = lines.map((line, i) => {
    return line.replace(
      /<([a-zA-Z][a-zA-Z0-9]*)(\s[^>]*)?(>)/g,
      (match, tag: string, attrs: string = '', close: string) => {
        if (SKIP_TAGS.has(tag.toLowerCase())) return match
        // 已经有行号注入的（避免重复）
        if (attrs.includes('data-tang-line')) return match
        return `<${tag}${attrs} data-tang-line="${i + 1}" data-tang-file="${relPath}"${close}`
      }
    )
  })

  return result.join('\n')
}

export function slideInspectorPlugin(): Plugin {
  return {
    name: 'tang-slidex-inspector',
    apply: 'serve',  // 仅开发模式

    configureServer(server) {
      // 在所有其他中间件之前，拦截 slides HTML 请求
      server.middlewares.use((req, res, next) => {
        const url = req.url ?? ''
        // 匹配 /slides/slide-NNN.html（忽略 query string）
        const urlPath = url.split('?')[0]!
        if (!/^\/slides\/slide-\d+\.html$/.test(urlPath)) {
          return next()
        }

        try {
          const filePath = path.join(process.cwd(), urlPath)
          if (!fs.existsSync(filePath)) return next()

          const html    = fs.readFileSync(filePath, 'utf8')
          const relPath = urlPath.replace(/^\//, '')  // "slides/slide-001.html"
          const injected = injectLineNumbers(html, relPath)

          res.writeHead(200, {
            'Content-Type': 'text/html; charset=utf-8',
            'Cache-Control': 'no-cache',
          })
          res.end(injected)
        } catch (err) {
          console.error('[tang-slidex:inspector] error:', err)
          next()
        }
      })
    },
  }
}
