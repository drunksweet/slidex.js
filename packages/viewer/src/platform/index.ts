import type { WysiwygPatch } from '@tang-slidex/editor'

export interface TangConfig {
  totalSlides: number
  title: string
  slidesDir: string
}

/** 平台无关的 API 接口 — Web/PWA 和 Electron 共用同一套 React 组件，差异仅在此层 */
export interface PlatformAPI {
  readSlide(index: number): Promise<string>
  savePatches(slideIndex: number, patches: WysiwygPatch[]): Promise<void>
  undo(slideIndex: number): Promise<void>
  getConfig(): Promise<TangConfig>
}

function pad(n: number) {
  return String(n + 1).padStart(3, '0')
}

/** Web / PWA 实现（Vite dev server API + fetch） */
export const webPlatform: PlatformAPI = {
  async readSlide(i) {
    const res = await fetch(`./slides/slide-${pad(i)}.html?t=${Date.now()}`)
    if (!res.ok) throw new Error(`加载页面失败: slide-${pad(i)}.html (${res.status})`)
    return res.text()
  },

  async savePatches(index, patches) {
    const res = await fetch('/api/save-slide', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ slideIndex: index, patches }),
    })
    if (!res.ok) throw new Error('保存失败')
  },

  async undo(index) {
    await fetch('/api/undo', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ slideIndex: index }),
    })
  },

  async getConfig() {
    // 由 Vite inject 或从 HTML meta 读取
    const w = window as any
    if (w.__TANG_CONFIG__) return w.__TANG_CONFIG__
    // fallback：读取 tang-slidex 字段
    return { totalSlides: 16, title: 'tang-slidex', slidesDir: './slides' }
  },
}

/** Electron 平台（预留） */
export const electronPlatform: PlatformAPI = {
  async readSlide(i)               { return (window as any).electronAPI.readSlide(i) },
  async savePatches(index, patches){ return (window as any).electronAPI.savePatches(index, patches) },
  async undo(index)                { return (window as any).electronAPI.undo(index) },
  async getConfig()                { return (window as any).electronAPI.getConfig() },
}

/** 自动检测平台 */
export const platform: PlatformAPI =
  typeof (window as any).electronAPI !== 'undefined' ? electronPlatform : webPlatform
