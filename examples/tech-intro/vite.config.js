import { defineConfig } from 'vite'
import path from 'node:path'
import fs from 'node:fs'

// ─── tang-slidex editor Vite 插件（行级写回方案）──────────────────────────────
// 行号注入 + 精确写回，彻底替换 JSDOM 方案
// 注：这里直接引用 TypeScript 源码，Vite 会在 dev 模式自动处理
import { slideInspectorPlugin } from '../../packages/editor/src/vite-plugins/slideInspectorPlugin.ts'
import { slideSavePlugin, slideUndoPlugin } from '../../packages/editor/src/vite-plugins/slideSavePlugin.ts'

// ─── Slide HMR 插件（监听 slide 文件变化，推送 tang-slide-update 事件）──────
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

export default defineConfig({
  root: '.',
  server: {
    port: 5173,
    watch: {
      include: ['slides/**', 'index.html'],
    },
  },
  plugins: [
    slideHmrPlugin(),
    slideInspectorPlugin(),   // ① 行号注入（开发模式，不修改源文件）
    slideSavePlugin(),         // ② 行级写回（替换 JSDOM 方案，零格式损耗）
    slideUndoPlugin(),         // ③ 撤销支持（内存历史栈，Ctrl+Z）
  ],
})
