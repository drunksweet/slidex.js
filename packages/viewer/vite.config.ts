import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import path from 'node:path'
import fs from 'node:fs'

// tang-slidex editor Vite 插件（行号注入 + 行级写回）
import { slideInspectorPlugin } from '../editor/src/vite-plugins/slideInspectorPlugin.ts'
import { slideSavePlugin, slideUndoPlugin } from '../editor/src/vite-plugins/slideSavePlugin.ts'

// ── Slide HMR 插件 ────────────────────────────────────────────────────────────
function slideHmrPlugin() {
  return {
    name: 'tang-slidex-slide-hmr',
    handleHotUpdate({ file, server }: any) {
      // 匹配绝对路径中的 slide-xxx.html
      if (/slide-\d+\.html$/.test(file)) {
        const rel = path.relative(process.cwd(), file).replace(/\\/g, '/')
        server.ws.send({ type: 'custom', event: 'tang-slide-update', data: { file: rel } })
        return []
      }
    },
  }
}

// ── Slides 代理：将 /slides 请求转发到 examples/tech-intro/slides ──────────────
function slidesProxyPlugin(slidesRoot: string) {
  return {
    name: 'tang-slidex-slides-proxy',
    configureServer(server: any) {
      server.middlewares.use('/slides', (req: any, res: any, next: () => void) => {
        // 去掉 query string（如 ?t=xxx），再拼实际文件路径
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
  fs.readFileSync(path.resolve(__dirname, '../../examples/tech-intro/package.json'), 'utf-8'),
)
const tangConfig = {
  totalSlides: examplePkg['tang-slidex']?.totalSlides ?? 16,
  title:       examplePkg['tang-slidex']?.title ?? 'tang-slidex',
  theme:       examplePkg['tang-slidex']?.theme ?? 'dark-tech',
  slidesDir:   './slides',
}

// ── Vite 主配置 ────────────────────────────────────────────────────────────────
export default defineConfig({
  root: '.',
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
      // 开发模式直接引用 TS 源码，无需先 build
      '@tang-slidex/core':   path.resolve(__dirname, '../core/src/index.ts'),
      '@tang-slidex/editor': path.resolve(__dirname, '../editor/src/index.ts'),
    },
  },
  server: {
    port: 3000,
    fs: { allow: ['../..'] },
  },
  plugins: [
    react(),
    slideHmrPlugin(),
    // ⚠️ inspector 必须在 proxy 之前：先注入行号再返回，不能让 proxy 先截获
    slideInspectorPlugin({ slidesRoot: path.resolve(__dirname, '../../examples/tech-intro/slides') }),
    slideSavePlugin({ slidesRoot: path.resolve(__dirname, '../../examples/tech-intro/slides') }),
    slideUndoPlugin({ slidesRoot: path.resolve(__dirname, '../../examples/tech-intro/slides') }),
    slidesProxyPlugin(path.resolve(__dirname, '../../examples/tech-intro/slides')),
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
    outDir: 'dist',
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
