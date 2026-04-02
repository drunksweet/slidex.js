import { useState, useRef } from 'react'
import { useStyleApply } from '../../../../hooks/useStyleApply'
import panelStyles from '../../RightPanel.module.css'
import s from './ShadowSection.module.css'

interface Props { el: Element }

interface BoxShadowState {
  enabled: boolean
  x: number; y: number; blur: number; spread: number
  hex: string; alpha: number
  inset: boolean
}

interface TextShadowState {
  enabled: boolean
  x: number; y: number; blur: number
  hex: string; alpha: number
}

/** rgb/rgba → { hex, alpha } */
function parseColorStr(raw: string): { hex: string; alpha: number } {
  const rgba = raw.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/)
  if (!rgba) return { hex: '#000000', alpha: 25 }
  const hex = '#' + [rgba[1], rgba[2], rgba[3]]
    .map(n => parseInt(n).toString(16).padStart(2, '0')).join('')
  const alpha = rgba[4] != null ? Math.round(parseFloat(rgba[4]) * 100) : 100
  return { hex, alpha }
}

function toRgba(hex: string, alpha: number) {
  const r = parseInt(hex.slice(1,3), 16)
  const g = parseInt(hex.slice(3,5), 16)
  const b = parseInt(hex.slice(5,7), 16)
  return `rgba(${r},${g},${b},${(alpha/100).toFixed(2)})`
}

/** 解析 box-shadow: "4px 8px 16px 0 rgba(...)" */
function parseBoxShadow(raw: string): Omit<BoxShadowState, 'enabled'> {
  if (!raw || raw === 'none') return { x: 4, y: 8, blur: 16, spread: 0, hex: '#000000', alpha: 25, inset: false }
  const inset = raw.includes('inset')
  const clean = raw.replace('inset', '').trim()
  const parts  = clean.split(/\s+/)
  const x      = parseInt(parts[0]) || 0
  const y      = parseInt(parts[1]) || 0
  const blur   = parseInt(parts[2]) || 0
  const spread = parseInt(parts[3]) || 0
  const colorRaw = parts.slice(4).join(' ').trim() || 'rgba(0,0,0,0.25)'
  const { hex, alpha } = parseColorStr(colorRaw)
  return { x, y, blur, spread, hex, alpha, inset }
}

/** 解析 text-shadow: "2px 2px 4px rgba(...)" */
function parseTextShadow(raw: string): Omit<TextShadowState, 'enabled'> {
  if (!raw || raw === 'none') return { x: 2, y: 2, blur: 4, hex: '#000000', alpha: 50 }
  const parts = raw.split(/\s+/)
  const x    = parseInt(parts[0]) || 0
  const y    = parseInt(parts[1]) || 0
  const blur = parseInt(parts[2]) || 0
  const colorRaw = parts.slice(3).join(' ').trim() || 'rgba(0,0,0,0.5)'
  const { hex, alpha } = parseColorStr(colorRaw)
  return { x, y, blur, hex, alpha }
}

// ── 通用 Toggle 头部 ─────────────────────────────────────────────────────────

function SectionToggle({
  label, enabled, onChange,
}: { label: string; enabled: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className={s.toggleRow}>
      <span className={s.toggleLabel}>{label}</span>
      <label className={s.toggle}>
        <input type="checkbox" checked={enabled} onChange={e => onChange(e.target.checked)} />
        <span className={s.toggleTrack}><span className={s.toggleThumb} /></span>
      </label>
    </div>
  )
}

// ── 数字滑块行 ────────────────────────────────────────────────────────────────

function SliderRow({
  label, min, max, defaultValue, unit = 'px', onChange,
}: { label: string; min: number; max: number; defaultValue: number; unit?: string; onChange: (v: number) => void }) {
  return (
    <div className={panelStyles.row}>
      <span className={panelStyles.label}>{label}</span>
      <div className={panelStyles.rangeWrap}>
        <input type="range" className={panelStyles.range}
          min={min} max={max} defaultValue={defaultValue}
          onInput={e => {
            const v = parseInt((e.target as HTMLInputElement).value)
            onChange(v)
            const num = (e.target as HTMLInputElement).parentElement?.querySelector<HTMLInputElement>('input[type=number]')
            if (num) num.value = String(v)
          }}
        />
        <input type="number" className={panelStyles.numInput}
          defaultValue={defaultValue} min={min} max={max}
          style={{ width: '52px' }}
          onBlur={e => onChange(parseInt(e.target.value))}
        />
        <span className={panelStyles.unit}>{unit}</span>
      </div>
    </div>
  )
}

// ── 主组件 ────────────────────────────────────────────────────────────────────

export function ShadowSection({ el }: Props) {
  const { applyStyle } = useStyleApply()
  const cs = window.getComputedStyle(el)

  const bsRaw = cs.boxShadow
  const tsRaw = cs.textShadow

  const initBS = parseBoxShadow(bsRaw !== 'none' ? bsRaw : '')
  const initTS = parseTextShadow(tsRaw !== 'none' ? tsRaw : '')

  const [boxEnabled,  setBoxEnabled]  = useState(bsRaw !== 'none' && bsRaw !== '')
  const [textEnabled, setTextEnabled] = useState(tsRaw !== 'none' && tsRaw !== '')

  const bsRef = useRef<Omit<BoxShadowState, 'enabled'>>(initBS)
  const tsRef = useRef<Omit<TextShadowState, 'enabled'>>(initTS)

  // 盒阴影写回
  function applyBoxShadow(patch?: Partial<Omit<BoxShadowState, 'enabled'>>) {
    Object.assign(bsRef.current, patch)
    const { x, y, blur, spread, hex, alpha, inset } = bsRef.current
    const insetStr = inset ? 'inset ' : ''
    applyStyle(el, 'box-shadow', `${insetStr}${x}px ${y}px ${blur}px ${spread}px ${toRgba(hex, alpha)}`)
  }

  // 文字阴影写回
  function applyTextShadow(patch?: Partial<Omit<TextShadowState, 'enabled'>>) {
    Object.assign(tsRef.current, patch)
    const { x, y, blur, hex, alpha } = tsRef.current
    applyStyle(el, 'text-shadow', `${x}px ${y}px ${blur}px ${toRgba(hex, alpha)}`)
  }

  function toggleBox(on: boolean) {
    setBoxEnabled(on)
    if (on) applyBoxShadow()
    else applyStyle(el, 'box-shadow', 'none')
  }

  function toggleText(on: boolean) {
    setTextEnabled(on)
    if (on) applyTextShadow()
    else applyStyle(el, 'text-shadow', 'none')
  }

  return (
    <div className={panelStyles.section}>
      <div className={panelStyles.sectionTitle}>阴影</div>

      {/* ── 盒阴影 ── */}
      <SectionToggle label="盒阴影" enabled={boxEnabled} onChange={toggleBox} />
      {boxEnabled && (
        <div className={s.shadowBody}>
          <SliderRow label="X"  min={-50} max={50}  defaultValue={bsRef.current.x}      onChange={v => applyBoxShadow({ x: v })} />
          <SliderRow label="Y"  min={-50} max={50}  defaultValue={bsRef.current.y}      onChange={v => applyBoxShadow({ y: v })} />
          <SliderRow label="模糊" min={0}  max={80}  defaultValue={bsRef.current.blur}   onChange={v => applyBoxShadow({ blur: v })} />
          <SliderRow label="扩散" min={-20} max={40} defaultValue={bsRef.current.spread} onChange={v => applyBoxShadow({ spread: v })} />

          {/* 颜色 + Alpha */}
          <div className={panelStyles.row}>
            <span className={panelStyles.label}>颜色</span>
            <div className={panelStyles.colorRow}>
              <div className={panelStyles.swatch}>
                <input type="color" className={panelStyles.swatchInput}
                  defaultValue={bsRef.current.hex}
                  onChange={e => applyBoxShadow({ hex: e.target.value })}
                />
              </div>
              <input type="number" className={panelStyles.numInput}
                defaultValue={bsRef.current.alpha} min={0} max={100}
                style={{ width: '52px' }} placeholder="Alpha%"
                onBlur={e => applyBoxShadow({ alpha: parseInt(e.target.value) })}
              />
              <span className={panelStyles.unit}>%</span>
            </div>
          </div>

          {/* 内阴影 */}
          <label className={s.insetRow}>
            <input type="checkbox"
              defaultChecked={bsRef.current.inset}
              onChange={e => applyBoxShadow({ inset: e.target.checked })}
            />
            <span>内阴影</span>
          </label>
        </div>
      )}

      <div className={panelStyles.rowDivider} style={{ margin: '10px 0' }} />

      {/* ── 文字阴影 ── */}
      <SectionToggle label="文字阴影" enabled={textEnabled} onChange={toggleText} />
      {textEnabled && (
        <div className={s.shadowBody}>
          <SliderRow label="X"   min={-20} max={20} defaultValue={tsRef.current.x}    onChange={v => applyTextShadow({ x: v })} />
          <SliderRow label="Y"   min={-20} max={20} defaultValue={tsRef.current.y}    onChange={v => applyTextShadow({ y: v })} />
          <SliderRow label="模糊" min={0}  max={40}  defaultValue={tsRef.current.blur} onChange={v => applyTextShadow({ blur: v })} />
          <div className={panelStyles.row}>
            <span className={panelStyles.label}>颜色</span>
            <div className={panelStyles.colorRow}>
              <div className={panelStyles.swatch}>
                <input type="color" className={panelStyles.swatchInput}
                  defaultValue={tsRef.current.hex}
                  onChange={e => applyTextShadow({ hex: e.target.value })}
                />
              </div>
              <input type="number" className={panelStyles.numInput}
                defaultValue={tsRef.current.alpha} min={0} max={100}
                style={{ width: '52px' }} placeholder="Alpha%"
                onBlur={e => applyTextShadow({ alpha: parseInt(e.target.value) })}
              />
              <span className={panelStyles.unit}>%</span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
