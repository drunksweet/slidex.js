/**
 * liquidGlassManager — 覆盖层方案
 *
 * LiquidGlass 组件内部渲染 5 个 Fragment 兄弟元素，全部使用
 *   position: relative(or absolute), top: 50%, left: 50%,
 *   transform: translate(-50%, -50%)
 * 因此它必须放在一个 position:relative、有明确尺寸的容器里，
 * 才能正确居中覆盖，而不是垂直排列撑开父元素。
 *
 * 正确结构：
 *   <div class="card" data-liquid-glass="...">   ← 原始元素，不动其内容
 *     <!-- 保持原始子节点 -->
 *     <div data-lg-host style="position:absolute;inset:0;pointer-events:none;overflow:hidden">
 *       <!-- React Root → <LiquidGlass> 5个覆盖层 -->
 *     </div>
 *   </div>
 *
 * 目标元素需要 position:relative（由我们设置，eject 时还原）
 * data-lg-host 是完全绝对定位的覆盖宿主，不影响布局
 */

import { createRoot, type Root } from 'react-dom/client'
import React from 'react'
import LiquidGlass from 'liquid-glass-react'

export interface LiquidGlassParams {
  displacementScale:   number
  blurAmount:          number
  saturation:          number
  aberrationIntensity: number
  elasticity:          number
  cornerRadius:        number
  overLight:           boolean
  mode: 'standard' | 'polar' | 'prominent' | 'shader'
}

export const LG_ATTR = 'data-liquid-glass'
const HOST_ATTR = 'data-lg-host'
const ORIG_POSITION_ATTR = 'data-lg-orig-position'

interface Entry {
  root: Root
  host: HTMLElement
}

const registry = new WeakMap<Element, Entry>()

// ── 内部渲染 ──────────────────────────────────────────────────────────────────

function renderInto(entry: Entry, params: LiquidGlassParams) {
  entry.root.render(
    React.createElement(LiquidGlass, {
      displacementScale:   params.displacementScale,
      blurAmount:          params.blurAmount,
      saturation:          params.saturation,
      aberrationIntensity: params.aberrationIntensity,
      elasticity:          params.elasticity,
      cornerRadius:        params.cornerRadius,
      overLight:           params.overLight,
      mode:                params.mode,
      // position:'absolute' → positionStyles.position = 'absolute'
      // 让 Fragment 内 5 个兄弟层全部脱离流，在宿主内不占空间
      // top/left 不传 → 默认 50%，配合 transform:translate(-50%,-50%) 居中铺满
      style: {
        position: 'absolute' as const,
        width:  '100%',
        height: '100%',
      },
      children: null,
    })
  )
}

// ── 公开 API ─────────────────────────────────────────────────────────────────

/** 注入（首次）或更新（已注入）液态玻璃 */
export function injectLiquidGlass(el: Element, params: LiquidGlassParams) {
  const hel = el as HTMLElement

  if (!registry.has(el)) {
    // 1. 给目标元素设置 position:relative（若尚未有定位）
    const computedPos = getComputedStyle(hel).position
    if (!computedPos || computedPos === 'static') {
      hel.setAttribute(ORIG_POSITION_ATTR, computedPos ?? '')
      hel.style.position = 'relative'
    }

    // 2. 创建覆盖宿主（absolute、inset:0、不遮挡点击）
    const host = document.createElement('div')
    host.setAttribute(HOST_ATTR, '1')
    host.style.cssText = [
      'position:absolute',
      'inset:0',
      'pointer-events:none',
      // overflow:hidden 会阻断 backdrop-filter 穿透，不要用
      'z-index:1',
    ].join(';')
    hel.appendChild(host)

    const root = createRoot(host)
    registry.set(el, { root, host })
  }

  // 保存参数到 data-liquid-glass 属性（持久化用）
  hel.setAttribute(LG_ATTR, JSON.stringify(params))

  renderInto(registry.get(el)!, params)
}

/** 移除液态玻璃，还原原始状态 */
export function ejectLiquidGlass(el: Element) {
  const entry = registry.get(el)
  if (!entry) return

  const hel = el as HTMLElement
  entry.root.unmount()
  entry.host.remove()

  // 还原 position
  const origPos = hel.getAttribute(ORIG_POSITION_ATTR)
  if (origPos !== null) {
    hel.style.position = origPos
    hel.removeAttribute(ORIG_POSITION_ATTR)
  }

  hel.removeAttribute(LG_ATTR)
  registry.delete(el)
}

/** 判断元素是否已注入 */
export function hasLiquidGlass(el: Element): boolean {
  return registry.has(el) || el.hasAttribute(LG_ATTR)
}

/** 读取已保存的参数（从 data-liquid-glass 属性） */
export function getSavedParams(el: Element): LiquidGlassParams | null {
  const raw = el.getAttribute(LG_ATTR)
  if (!raw) return null
  try { return JSON.parse(raw) as LiquidGlassParams }
  catch { return null }
}

/** 扫描 DOM 并重注入所有带 data-liquid-glass 的元素（页面刷新后调用） */
export function rehydrateAll(root: Element = document.body) {
  root.querySelectorAll<HTMLElement>(`[${LG_ATTR}]`).forEach(el => {
    // 跳过已经注入过的（registry 已有）
    if (registry.has(el)) return
    const params = getSavedParams(el)
    if (params) injectLiquidGlass(el, params)
  })
}
