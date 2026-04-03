import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import path from 'node:path'
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'

// tang-slidex editor Vite 插件（行号注入 + 行级写回）
import { slideInspectorPlugin } from './packages/editor/src/vite-plugins/slideInspectorPlugin.ts'
import { slideSavePlugin, slideUndoPlugin } from './packages/editor/src/vite-plugins/slideSavePlugin.ts'

// vite.config.ts 在项目根目录
// Vite 以 ESM 模式加载 config 文件，import.meta.url 指向 config 文件自身路径，可安全使用
const PROJECT_ROOT = path.dirname(fileURLToPath(import.meta.url))
const VIEWER_ROOT  = path.resolve(PROJECT_ROOT, 'packages/viewer')
const SLIDES_ROOT  = path.resolve(PROJECT_ROOT, 'examples/tech-intro/slides')

// ── Slide HMR 插件 + 保存时自动 Prettier 格式化 ──────────────────────────────
// slide HTML 不在 Vite module graph 中，handleHotUpdate 不会被触发。
// 通过 server.watcher.add() 把 slidesRoot 加入 Vite 的 watcher，
// 再在 configureServer 监听 change 事件触发格式化。
// 完全不依赖编辑器插件，对任何工具链透明。
function slideHmrPlugin(slidesRoot: string) {
  const pending         = new Map<string, ReturnType<typeof setTimeout>>()
  const writtenByPlugin = new Set<string>()

  return {
    name: 'tang-slidex-slide-hmr',

    configureServer(server: any) {
      // 把 slidesRoot 加入 watcher（vite root 是 packages/viewer，slides/ 在其外）
      server.watcher.add(slidesRoot)

      server.watcher.on('change', async (file: string) => {
        if (!/slide-\d+\.html$/.test(file)) return

        if (writtenByPlugin.has(file)) {
          writtenByPlugin.delete(file)
          return
        }

        if (pending.has(file)) clearTimeout(pending.get(file)!)
        pending.set(file, setTimeout(async () => {
          pending.delete(file)

          try {
            const prettier = await import('prettier')
            const original = fs.readFileSync(file, 'utf-8')
            const formatted = await prettier.format(original, {
              parser: 'html',
              printWidth: 100000,
              htmlWhitespaceSensitivity: 'ignore',
              bracketSameLine: true,
              singleAttributePerLine: false,
              tabWidth: 2,
            })
            if (formatted !== original) {
              writtenByPlugin.add(file)
              fs.writeFileSync(file, formatted, 'utf-8')
              console.log(`[tang-slidex] auto-formatted: ${path.basename(file)}`)
            }
          } catch (err) {
            console.warn(`[tang-slidex] prettier format failed for ${file}:`, err)
          }

          const rel = path.relative(PROJECT_ROOT, file).replace(/\\/g, '/')
          server.ws.send({ type: 'custom', event: 'tang-slide-update', data: { file: rel } })
        }, 80))
      })
    },
  }
}

// ── Slides 代理：将 /slides 请求转发到 examples/tech-intro/slides ──────────────
function slidesProxyPlugin(slidesRoot: string) {
  return {
    name: 'tang-slidex-slides-proxy',
    configureServer(server: any) {
      server.middlewares.use('/slides', (req: any, res: any, next: () => void) => {
        const pathname = (req.url ?? '').split('?')[0]
        const filePath = path.join(slidesRoot, pathname)
        if (fs.existsSync(filePath)) {
          res.setHeader('Content-Type', 'text/html; charset=utf-8')
          res.end(fs.readFileSync(filePath, 'utf-8'))
        } else {
          next()
        }
      })
    },
  }
}

// ── 注入 __TANG_CONFIG__ 到 HTML ───────────────────────────────────────────────
function injectConfigPlugin(config: Record<string, unknown>) {
  return {
    name: 'tang-slidex-inject-config',
    transformIndexHtml(html: string) {
      const script = `<script>window.__TANG_CONFIG__ = ${JSON.stringify(config)};</script>`
      return html.replace('</head>', `${script}\n</head>`)
    },
  }
}

// 读取 tech-intro 的 package.json 获取 tang-slidex 配置
const examplePkg = JSON.parse(
  fs.readFileSync(path.resolve(PROJECT_ROOT, 'examples/tech-intro/package.json'), 'utf-8'),
)
const tangConfig = {
  totalSlides: examplePkg['tang-slidex']?.totalSlides ?? 16,
  title:       examplePkg['tang-slidex']?.title ?? 'tang-slidex',
  theme:       examplePkg['tang-slidex']?.theme ?? 'dark-tech',
  slidesDir:   './slides',
}

// ── Vite 主配置 ────────────────────────────────────────────────────────────────
export default defineConfig({
  // root 指向 viewer 包：Vite 从这里找 index.html 和 public/
  root: VIEWER_ROOT,
  resolve: {
    alias: {
      '@': path.resolve(VIEWER_ROOT, 'src'),
      // 开发模式直接引用 TS 源码，无需先 build
      '@tang-slidex/core':   path.resolve(PROJECT_ROOT, 'packages/core/src/index.ts'),
      '@tang-slidex/editor': path.resolve(PROJECT_ROOT, 'packages/editor/src/index.ts'),
    },
  },
  server: {
    port: 3000,
    fs: { allow: [PROJECT_ROOT] },
  },
  plugins: [
    react(),
    slideHmrPlugin(SLIDES_ROOT),
    // ⚠️ inspector 必须在 proxy 之前：先注入行号再返回，不能让 proxy 先截获
    slideInspectorPlugin({ slidesRoot: SLIDES_ROOT }),
    slideSavePlugin({ slidesRoot: SLIDES_ROOT }),
    slideUndoPlugin({ slidesRoot: SLIDES_ROOT }),
    slidesProxyPlugin(SLIDES_ROOT),
    injectConfigPlugin(tangConfig),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: false,
      workbox: {
        globPatterns: ['**/*.{js,css,html,woff2,png,svg,ico}'],
        runtimeCaching: [
          {
            urlPattern: /\/slides\/slide-\d+\.html/,
            handler: 'NetworkFirst' as const,
            options: {
              cacheName: 'slides-cache',
              expiration: { maxEntries: 60, maxAgeSeconds: 7 * 24 * 60 * 60 },
            },
          },
          {
            urlPattern: /^https:\/\/(cdn\.jsdelivr\.net|cdnjs\.cloudflare\.com)/,
            handler: 'CacheFirst' as const,
            options: {
              cacheName: 'cdn-cache',
              expiration: { maxEntries: 30, maxAgeSeconds: 30 * 24 * 60 * 60 },
            },
          },
        ],
      },
    }),
  ],
  build: {
    outDir: path.resolve(VIEWER_ROOT, 'dist'),
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom'],
          'zustand':      ['zustand'],
          'dnd-kit':      ['@dnd-kit/core', '@dnd-kit/sortable', '@dnd-kit/utilities'],
        },
      },
    },
  },
})
