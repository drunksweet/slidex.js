import { defineConfig } from 'vite'
import path from 'path'
import fs from 'fs'
import { JSDOM } from 'jsdom'

export default defineConfig({
  root: '.',
  server: {
    port: 5173,
    watch: {
      include: ['slides/**', 'index.html'],
    },
  },
  plugins: [slideHmrPlugin(), slideSavePlugin()],
})

// ─── Plugin 1：监听 slide HTML 变化推送 HMR ───────────────────────────────────
function slideHmrPlugin() {
  return {
    name: 'tang-slidex-slide-hmr',
    handleHotUpdate({ file, server }) {
      const rel = path.relative(process.cwd(), file).replace(/\\/g, '/')
      if (/^slides\/slide-\d+\.html$/.test(rel)) {
        console.log(`[tang-slidex] slide changed: ${rel}`)
        server.ws.send({ type: 'custom', event: 'tang-slide-update', data: { file: rel } })
        return []
      }
    },
  }
}

// ─── Plugin 2：接收前端 patch，写回 slide HTML ────────────────────────────────
function slideSavePlugin() {
  return {
    name: 'tang-slidex-save',
    configureServer(server) {
      server.middlewares.use('/api/save-slide', (req, res) => {
        if (req.method !== 'POST') {
          res.writeHead(405)
          res.end('Method Not Allowed')
          return
        }

        let body = ''
        req.on('data', chunk => { body += chunk })
        req.on('end', () => {
          try {
            const { slideIndex, patches } = JSON.parse(body)
            const num  = String(slideIndex + 1).padStart(3, '0')
            const file = path.join(process.cwd(), 'slides', `slide-${num}.html`)

            if (!fs.existsSync(file)) {
              res.writeHead(404)
              res.end(JSON.stringify({ ok: false, error: 'slide not found' }))
              return
            }

            const html   = fs.readFileSync(file, 'utf8')
            const result = applyPatches(html, patches)
            fs.writeFileSync(file, result, 'utf8')

            console.log(`[tang-slidex:save] slide-${num}.html saved (${patches.length} patches)`)
            res.writeHead(200, { 'Content-Type': 'application/json' })
            res.end(JSON.stringify({ ok: true }))
          } catch (err) {
            console.error('[tang-slidex:save] error:', err)
            res.writeHead(500)
            res.end(JSON.stringify({ ok: false, error: String(err) }))
          }
        })
      })
    },
  }
}

/**
 * 用 JSDOM 解析 HTML，按 selector 应用 patch，返回修改后的 HTML 字符串
 * @param {string} html
 * @param {Array<{type,selector,value?,dx?,dy?,width?,height?}>} patches
 */
function applyPatches(html, patches) {
  const dom  = new JSDOM(html)
  const doc  = dom.window.document

  for (const patch of patches) {
    let el
    try {
      el = doc.querySelector(patch.selector)
    } catch {
      console.warn('[applyPatches] invalid selector:', patch.selector)
      continue
    }
    if (!el) {
      console.warn('[applyPatches] element not found:', patch.selector)
      continue
    }

    switch (patch.type) {
      case 'text':
        el.textContent = patch.value
        break

      case 'code': {
        // 更新 <code> 元素的文本内容（hljs 渲染前的原始代码）
        // 清除 data-highlighted 让下次重新高亮
        el.textContent = patch.value
        el.removeAttribute('data-highlighted')
        delete el.dataset.rawCode
        break
      }

      case 'move': {
        // 读取现有 translate 或 position，累加 delta
        const style = el.getAttribute('style') || ''
        // 解析已有 translateX/Y（data 属性存储累计偏移）
        const prevDx = parseFloat(el.dataset.editDx || '0')
        const prevDy = parseFloat(el.dataset.editDy || '0')
        const newDx  = prevDx + patch.dx
        const newDy  = prevDy + patch.dy
        el.dataset.editDx = String(newDx)
        el.dataset.editDy = String(newDy)
        // 注入/替换 transform
        const withoutTranslate = style.replace(/translate\([^)]*\)/g, '').trim()
        const newStyle = `${withoutTranslate}; transform: translate(${newDx}px, ${newDy}px)`
          .replace(/^;\s*/, '').replace(/\s+/g, ' ')
        el.setAttribute('style', newStyle)
        break
      }

      case 'resize': {
        const style = el.getAttribute('style') || ''
        const stripped = style
          .replace(/width\s*:[^;]*(;|$)/gi, '')
          .replace(/height\s*:[^;]*(;|$)/gi, '')
          .trim()
        el.setAttribute('style', `${stripped}; width: ${patch.width}px; height: ${patch.height}px`.replace(/^;\s*/, ''))
        break
      }

      case 'delete':
        el.parentNode?.removeChild(el)
        break
    }
  }

  return dom.serialize()
}
