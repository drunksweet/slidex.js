/**
 * @tang-slidex/editor — slideSavePlugin + slideUndoPlugin
 *
 * slideSavePlugin：接收前端 POST /api/save-slide，行级写回 HTML 文件。
 *   - 彻底废弃 JSDOM 序列化方案
 *   - 行级字符串替换：仅修改目标行，注释/缩进/格式零损耗
 *
 * slideUndoPlugin：接收前端 POST /api/undo，还原上一次保存前的文件内容。
 */

import fs from 'node:fs'
import path from 'node:path'
import type { Plugin, Connect } from 'vite'
import type { ServerResponse } from 'node:http'
import type { WysiwygPatch, SaveSlideRequest } from '../types.js'

// ─── 历史栈（文件写回前保存快照） ────────────────────────────────────────────

const editHistory = new Map<string, string[]>()
const MAX_HISTORY = 30

function saveWithHistory(filePath: string, newHtml: string): void {
  if (!editHistory.has(filePath)) editHistory.set(filePath, [])
  const history = editHistory.get(filePath)!
  history.push(fs.readFileSync(filePath, 'utf8'))  // 当前版本入栈
  if (history.length > MAX_HISTORY) history.shift()
  fs.writeFileSync(filePath, newHtml, 'utf8')
}

// ─── 行级写回引擎 ──────────────────────────────────────────────────────────────

/**
 * 移除 data-tang-* 注入属性（避免污染源文件）
 */
function cleanInjectAttrs(html: string): string {
  return html
    .replace(/\s+data-tang-line="\d+"/g, '')
    .replace(/\s+data-tang-file="[^"]*"/g, '')
}

/**
 * 设置内联 style 的单个属性
 * 如果已有该属性则替换，否则追加；如果没有 style 属性则新增
 */
function setInlineStyleProp(line: string, prop: string, value: string): string {
  const styleMatch = line.match(/style="([^"]*)"/)
  if (styleMatch) {
    const existing = styleMatch[1]!
    const propRe = new RegExp(`${escapeRegExp(prop)}\\s*:[^;]*(;|$)`, 'gi')
    const updated = propRe.test(existing)
      ? existing.replace(propRe, `${prop}: ${value};`)
      : `${existing.trimEnd().replace(/;$/, '')}; ${prop}: ${value};`
    return line.replace(/style="[^"]*"/, `style="${updated.replace(/;\s*$/, '')}"`)
  }
  // 没有 style 属性：新增（在第一个 > 前插入）
  return line.replace(/(\/?>)/, ` style="${prop}: ${value}"$1`)
}

/**
 * 找到第 startIdx 行（0-based）开标签对应的闭合行（标签栈法）
 */
function findClosingLine(lines: string[], startIdx: number): number {
  const tagMatch = lines[startIdx]?.match(/<([a-zA-Z][a-zA-Z0-9]*)/)
  if (!tagMatch) return startIdx
  const tag = tagMatch[1]!
  const openRe  = new RegExp(`<${tag}[\\s>]`, 'g')
  const closeRe = new RegExp(`</${tag}>`, 'g')
  let depth = 0
  for (let i = startIdx; i < lines.length; i++) {
    depth += (lines[i]!.match(openRe)  || []).length
    depth -= (lines[i]!.match(closeRe) || []).length
    if (depth === 0) return i
  }
  return startIdx
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * 对 HTML 字符串应用 WysiwygPatch[] — 行级操作，保留所有格式
 */
export function applyPatchesByLine(html: string, patches: WysiwygPatch[]): string {
  const lines = html.split('\n')

  for (const patch of patches) {
    // 本引擎只处理 line anchor
    if (patch.anchor.type !== 'line') {
      console.warn('[applyPatchesByLine] skipping non-line anchor patch:', patch.type)
      continue
    }

    const i = patch.anchor.line - 1  // 转为 0-based
    if (i < 0 || i >= lines.length) {
      console.warn(`[applyPatchesByLine] line ${patch.anchor.line} out of range`)
      continue
    }

    const line = lines[i]!

    switch (patch.type) {
      case 'text': {
        // 替换标签内文本内容（>content</tag>）
        // 只替换最后一个 > 到第一个 </ 之间的内容
        const escaped = escapeHtml(patch.value)
        lines[i] = line.replace(/(>[^<]*)(<\/)/, `>${escaped}$2`)
        break
      }

      case 'move': {
        // 合并已有的 rotate（如果有的话），只替换 translate 部分
        const existing = _parseTransformStr(line)
        const newT = `translate(${patch.dx}px, ${patch.dy}px)`
        const composed = existing.rotate
          ? `${newT} ${existing.rotate}`
          : newT
        lines[i] = setInlineStyleProp(line, 'transform', composed)
        break
      }

      case 'rotate': {
        // 合并已有的 translate（如果有的话），只替换 rotate 部分
        const existing = _parseTransformStr(line)
        const newR = `rotate(${patch.deg}deg)`
        const composed = existing.translate
          ? `${existing.translate} ${newR}`
          : newR
        lines[i] = setInlineStyleProp(line, 'transform', composed)
        break
      }

      case 'resize': {
        let l = setInlineStyleProp(line, 'width',  `${patch.width}px`)
        l = setInlineStyleProp(l, 'height', `${patch.height}px`)
        lines[i] = l
        break
      }

      case 'style-prop': {
        lines[i] = setInlineStyleProp(line, patch.property, patch.value)
        break
      }

      case 'class-add': {
        if (line.match(/class="([^"]*)"/)) {
          lines[i] = line.replace(/class="([^"]*)"/, (_, cls: string) =>
            `class="${cls.trim()} ${patch.className}"`
          )
        } else {
          lines[i] = line.replace(/(\/?>)/, ` class="${patch.className}"$1`)
        }
        break
      }

      case 'class-remove': {
        lines[i] = line.replace(/class="([^"]*)"/, (_, cls: string) => {
          const updated = cls.split(/\s+/).filter((c: string) => c !== patch.className).join(' ')
          return `class="${updated}"`
        })
        break
      }

      case 'attr-set': {
        const attrRe = new RegExp(`${escapeRegExp(patch.attr)}="[^"]*"`)
        if (attrRe.test(line)) {
          lines[i] = line.replace(attrRe, `${patch.attr}="${escapeAttr(patch.value)}"`)
        } else {
          lines[i] = line.replace(/(\/?>)/, ` ${patch.attr}="${escapeAttr(patch.value)}"$1`)
        }
        break
      }

      case 'delete': {
        // 注释掉整个元素块（开标签行 → 闭合行）
        const endIdx = findClosingLine(lines, i)
        const block = lines.slice(i, endIdx + 1).join('\n')
        lines.splice(i, endIdx - i + 1, `<!-- [tang-deleted]\n${block}\n-->`)
        break
      }
    }
  }

  return cleanInjectAttrs(lines.join('\n'))
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

function escapeAttr(str: string): string {
  return str.replace(/"/g, '&quot;')
}

/**
 * 从 CSS transform 字符串中提取 translate/rotate 子串（用于 move/rotate patch 合并）
 */
function _parseTransformStr(line: string): { translate: string; rotate: string } {
  const styleMatch = line.match(/transform:\s*([^;}"]+)/)
  const val = styleMatch ? styleMatch[1]!.trim() : ''
  const tMatch = val.match(/translate\([^)]+\)/)
  const rMatch = val.match(/rotate\([^)]+\)/)
  return {
    translate: tMatch ? tMatch[0]! : '',
    rotate:    rMatch ? rMatch[0]! : '',
  }
}

// ─── Vite 插件 ─────────────────────────────────────────────────────────────────

function readBody(req: Connect.IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let body = ''
    req.on('data', (chunk: Buffer) => { body += chunk.toString() })
    req.on('end', () => resolve(body))
    req.on('error', reject)
  })
}

function jsonResponse(res: ServerResponse, status: number, data: object): void {
  res.writeHead(status, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify(data))
}

export interface SlideSaveOptions {
  /** slides 目录的绝对路径，默认为 process.cwd()/slides */
  slidesRoot?: string
}

/**
 * slideSavePlugin：POST /api/save-slide
 * 接收 { slideIndex, patches } → 行级写回 HTML 文件
 */
export function slideSavePlugin(options: SlideSaveOptions = {}): Plugin {
  return {
    name: 'tang-slidex-save',
    configureServer(server) {
      const slidesRoot = options.slidesRoot ?? path.join(process.cwd(), 'slides')

      server.middlewares.use('/api/save-slide', async (req, res, next) => {
        if (req.method !== 'POST') { next(); return }

        try {
          const body = await readBody(req)
          const { slideIndex, patches }: SaveSlideRequest = JSON.parse(body)

          const num      = String(slideIndex + 1).padStart(3, '0')
          const filePath = path.join(slidesRoot, `slide-${num}.html`)

          if (!fs.existsSync(filePath)) {
            return jsonResponse(res, 404, { ok: false, error: `slide-${num}.html not found (slidesRoot: ${slidesRoot})` })
          }

          const html    = fs.readFileSync(filePath, 'utf8')
          const updated = applyPatchesByLine(html, patches)
          saveWithHistory(filePath, updated)

          console.log(`[tang-slidex:save] slide-${num}.html saved (${patches.length} patches)`)
          jsonResponse(res, 200, { ok: true })
        } catch (err) {
          console.error('[tang-slidex:save] error:', err)
          jsonResponse(res, 500, { ok: false, error: String(err) })
        }
      })
    },
  }
}

/**
 * slideUndoPlugin：POST /api/undo
 * 接收 { file } → 还原上一次写回前的文件内容
 */
export function slideUndoPlugin(options: SlideSaveOptions = {}): Plugin {
  return {
    name: 'tang-slidex-undo',
    configureServer(server) {
      const slidesRoot = options.slidesRoot ?? path.join(process.cwd(), 'slides')

      server.middlewares.use('/api/undo', async (req, res, next) => {
        if (req.method !== 'POST') { next(); return }

        try {
          const body = await readBody(req)
          const { file }: { file: string } = JSON.parse(body)
          // file 格式为 "slides/slide-001.html"，取文件名后拼 slidesRoot
          const fileName = path.basename(file)
          const filePath = path.join(slidesRoot, fileName)

          const history = editHistory.get(filePath)
          if (!history?.length) {
            return jsonResponse(res, 200, { ok: false, message: '没有更多撤销历史' })
          }

          const prev = history.pop()!
          fs.writeFileSync(filePath, prev, 'utf8')
          console.log(`[tang-slidex:undo] ${file} restored`)
          jsonResponse(res, 200, { ok: true })
        } catch (err) {
          console.error('[tang-slidex:undo] error:', err)
          jsonResponse(res, 500, { ok: false, error: String(err) })
        }
      })
    },
  }
}
