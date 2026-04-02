import { useState, useRef } from 'react'
import { useStyleApply } from '../../../../hooks/useStyleApply'
import panelStyles from '../../RightPanel.module.css'
import s from './FillSection.module.css'

interface Props { el: Element }

type FillMode = 'solid' | 'gradient' | 'none'

/** rgba(r,g,b,a) 或 rgb(r,g,b) → { hex: '#rrggbb', alpha: 0~100 } */
function parseColor(raw: string): { hex: string; alpha: number } {
  const rgba = raw.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/)
  if (!rgba) return { hex: '#000000', alpha: 100 }
  const hex = '#' + [rgba[1], rgba[2], rgba[3]]
    .map(n => parseInt(n).toString(16).padStart(2, '0')).join('')
  const alpha = rgba[4] != null ? Math.round(parseFloat(rgba[4]) * 100) : 100
  return { hex, alpha }
}

/** hex + alpha(0~100) → rgba(...) */
function toRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  const a = (alpha / 100).toFixed(2)
  return `rgba(${r},${g},${b},${a})`
}

/** 从 computed background-image 提取线性渐变的两个颜色和角度（简单解析） */
function parseLinearGradient(bgImage: string): { from: string; to: string; angle: number } | null {
  const m = bgImage.match(/linear-gradient\((\d+)deg,\s*(#[0-9a-fA-F]{3,8}|rgb[^)]+\)),?\s*(#[0-9a-fA-F]{3,8}|rgb[^)]+\))/)
  if (!m) return null
  return { angle: parseInt(m[1]), from: m[2], to: m[3] }
}

/** 简单检测当前是否是渐变填充 */
function detectFillMode(cs: CSSStyleDeclaration): FillMode {
  const bg = cs.backgroundColor
  const bgImg = cs.backgroundImage
  if (bgImg && bgImg.includes('linear-gradient')) return 'gradient'
  if (!bg || bg === 'transparent' || bg === 'rgba(0, 0, 0, 0)') return 'none'
  return 'solid'
}

export function FillSection({ el }: Props) {
  const { applyStyle } = useStyleApply()
  const cs = window.getComputedStyle(el)

  const initMode = detectFillMode(cs)
  const [mode, setMode] = useState<FillMode>(initMode)

  const { hex: initHex, alpha: initAlpha } = parseColor(cs.backgroundColor)
  const hexRef   = useRef(initHex)
  const alphaRef = useRef(initAlpha)

  const grad = parseLinearGradient(cs.backgroundImage)
  const fromRef  = useRef(grad?.from ?? '#3b82f6')
  const toRef    = useRef(grad?.to ?? '#8b5cf6')
  const angleRef = useRef(grad?.angle ?? 135)

  function applyBg(hex: string, alpha: number) {
    hexRef.current   = hex
    alphaRef.current = alpha
    applyStyle(el, 'background-color', toRgba(hex, alpha))
  }

  function applyGradient(from?: string, to?: string, angle?: number) {
    const f = from  ?? fromRef.current
    const t = to    ?? toRef.current
    const a = angle ?? angleRef.current
    fromRef.current  = f
    toRef.current    = t
    angleRef.current = a
    applyStyle(el, 'background-image', `linear-gradient(${a}deg, ${f}, ${t})`)
  }

  function switchMode(m: FillMode) {
    setMode(m)
    if (m === 'none') {
      applyStyle(el, 'background-color', 'transparent')
      applyStyle(el, 'background-image', 'none')
    } else if (m === 'solid') {
      applyStyle(el, 'background-image', 'none')
      applyBg(hexRef.current, alphaRef.current)
    } else {
      applyStyle(el, 'background-color', 'transparent')
      applyGradient()
    }
  }

  return (
    <div className={panelStyles.section}>
      <div className={panelStyles.sectionTitle}>填充</div>

      {/* 模式切换 */}
      <div className={s.modeTabs}>
        {(['solid', 'gradient', 'none'] as FillMode[]).map(m => (
          <button
            key={m}
            className={`${s.modeTab} ${mode === m ? s.modeActive : ''}`}
            onClick={() => switchMode(m)}
          >
            {{ solid: '纯色', gradient: '渐变', none: '无' }[m]}
          </button>
        ))}
      </div>

      {/* 纯色模式 */}
      {mode === 'solid' && (
        <div>
          <div className={panelStyles.row}>
            <span className={panelStyles.label}>颜色</span>
            <div className={panelStyles.colorRow}>
              <div className={panelStyles.swatch}>
                <input type="color" className={panelStyles.swatchInput}
                  defaultValue={hexRef.current}
                  onChange={e => applyBg(e.target.value, alphaRef.current)}
                />
              </div>
              <input type="text" className={panelStyles.hexInput}
                defaultValue={hexRef.current.toUpperCase()}
                placeholder="#000000"
                onBlur={e => { const v = e.target.value.trim(); if (/^#[0-9a-fA-F]{6}$/.test(v)) applyBg(v, alphaRef.current) }}
              />
            </div>
          </div>
          <div className={panelStyles.row}>
            <span className={panelStyles.label}>Alpha</span>
            <div className={panelStyles.rangeWrap}>
              <input type="range" className={panelStyles.range}
                min={0} max={100} defaultValue={alphaRef.current}
                onInput={e => {
                  const v = parseInt((e.target as HTMLInputElement).value)
                  alphaRef.current = v
                  applyBg(hexRef.current, v)
                  const num = (e.target as HTMLInputElement).parentElement?.querySelector<HTMLInputElement>('input[type=number]')
                  if (num) num.value = String(v)
                }}
              />
              <input type="number" className={panelStyles.numInput}
                defaultValue={alphaRef.current} min={0} max={100}
                style={{ width: '52px' }}
                onBlur={e => { const v = parseInt(e.target.value); applyBg(hexRef.current, v) }}
              />
              <span className={panelStyles.unit}>%</span>
            </div>
          </div>
        </div>
      )}

      {/* 渐变模式 */}
      {mode === 'gradient' && (
        <div>
          <div className={panelStyles.row}>
            <span className={panelStyles.label}>起始色</span>
            <div className={panelStyles.colorRow}>
              <div className={panelStyles.swatch}>
                <input type="color" className={panelStyles.swatchInput}
                  defaultValue={fromRef.current.startsWith('#') ? fromRef.current : '#3b82f6'}
                  onChange={e => applyGradient(e.target.value, undefined, undefined)}
                />
              </div>
            </div>
          </div>
          <div className={panelStyles.row}>
            <span className={panelStyles.label}>结束色</span>
            <div className={panelStyles.colorRow}>
              <div className={panelStyles.swatch}>
                <input type="color" className={panelStyles.swatchInput}
                  defaultValue={toRef.current.startsWith('#') ? toRef.current : '#8b5cf6'}
                  onChange={e => applyGradient(undefined, e.target.value, undefined)}
                />
              </div>
            </div>
          </div>
          <div className={panelStyles.row}>
            <span className={panelStyles.label}>角度</span>
            <div className={panelStyles.rangeWrap}>
              {/* 渐变预览条 */}
              <div
                className={s.gradPreview}
                style={{ background: `linear-gradient(${angleRef.current}deg, ${fromRef.current}, ${toRef.current})` }}
              />
              <input type="range" className={panelStyles.range}
                min={0} max={360} defaultValue={angleRef.current}
                onInput={e => {
                  const v = parseInt((e.target as HTMLInputElement).value)
                  applyGradient(undefined, undefined, v)
                  const num = (e.target as HTMLInputElement).parentElement?.querySelector<HTMLInputElement>('input[type=number]')
                  if (num) num.value = String(v)
                  // 更新预览条
                  const preview = (e.target as HTMLInputElement).parentElement?.querySelector<HTMLDivElement>(`.${s.gradPreview}`)
                  if (preview) preview.style.background = `linear-gradient(${v}deg, ${fromRef.current}, ${toRef.current})`
                }}
              />
              <input type="number" className={panelStyles.numInput}
                defaultValue={angleRef.current} min={0} max={360}
                style={{ width: '52px' }}
                onBlur={e => applyGradient(undefined, undefined, parseInt(e.target.value))}
              />
              <span className={panelStyles.unit}>°</span>
            </div>
          </div>
        </div>
      )}

      {mode === 'none' && (
        <p className={s.noneHint}>背景透明</p>
      )}
    </div>
  )
}
