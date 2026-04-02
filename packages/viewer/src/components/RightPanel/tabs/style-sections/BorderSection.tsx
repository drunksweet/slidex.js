import { useState, useRef } from 'react'
import { useStyleApply } from '../../../../hooks/useStyleApply'
import panelStyles from '../../RightPanel.module.css'
import s from './BorderSection.module.css'

interface Props { el: Element }

/** 解析 border shorthand: "2px solid #3b82f6" → parts */
function parseBorder(cs: CSSStyleDeclaration) {
  const width = parseInt(cs.borderTopWidth) || 1
  const style = cs.borderTopStyle || 'solid'
  const colorRaw = cs.borderTopColor || '#3b82f6'
  // rgb → hex
  const m = colorRaw.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/)
  const hex = m
    ? '#' + [m[1], m[2], m[3]].map(n => parseInt(n).toString(16).padStart(2, '0')).join('')
    : colorRaw
  const enabled = cs.borderTopStyle !== 'none' && parseInt(cs.borderTopWidth) > 0
  return { width, style, hex, enabled }
}

const BORDER_STYLES = ['solid', 'dashed', 'dotted', 'double', 'groove', 'ridge']

export function BorderSection({ el }: Props) {
  const { applyStyle } = useStyleApply()
  const cs = window.getComputedStyle(el)
  const init = parseBorder(cs)
  const radius = parseInt(cs.borderRadius) || 0

  const [enabled, setEnabled] = useState(init.enabled)
  const widthRef = useRef(init.width)
  const styleRef = useRef(init.style)
  const hexRef   = useRef(init.hex)

  function applyBorder(w?: number, st?: string, hex?: string) {
    const bw = w   ?? widthRef.current
    const bs = st  ?? styleRef.current
    const bc = hex ?? hexRef.current
    widthRef.current = bw
    styleRef.current = bs
    hexRef.current   = bc
    applyStyle(el, 'border', `${bw}px ${bs} ${bc}`)
  }

  function toggle(on: boolean) {
    setEnabled(on)
    if (!on) {
      applyStyle(el, 'border', 'none')
    } else {
      applyBorder()
    }
  }

  return (
    <div className={panelStyles.section}>
      {/* 标题 + 开关 */}
      <div className={s.header}>
        <span className={panelStyles.sectionTitle} style={{ marginBottom: 0 }}>边框</span>
        <label className={s.toggle}>
          <input type="checkbox" checked={enabled} onChange={e => toggle(e.target.checked)} />
          <span className={s.toggleTrack}>
            <span className={s.toggleThumb} />
          </span>
        </label>
      </div>

      {/* 展开控件 */}
      {enabled && (
        <div className={s.body}>
          {/* 颜色 */}
          <div className={panelStyles.row}>
            <span className={panelStyles.label}>颜色</span>
            <div className={panelStyles.colorRow}>
              <div className={panelStyles.swatch}>
                <input type="color" className={panelStyles.swatchInput}
                  defaultValue={hexRef.current}
                  onChange={e => applyBorder(undefined, undefined, e.target.value)}
                />
              </div>
              <input type="text" className={panelStyles.hexInput}
                defaultValue={hexRef.current.toUpperCase()}
                onBlur={e => { const v = e.target.value.trim(); if (/^#[0-9a-fA-F]{6}$/.test(v)) applyBorder(undefined, undefined, v) }}
              />
            </div>
          </div>

          {/* 宽度 */}
          <div className={panelStyles.row}>
            <span className={panelStyles.label}>宽度</span>
            <div className={panelStyles.rangeWrap}>
              <input type="range" className={panelStyles.range}
                min={1} max={20} defaultValue={widthRef.current}
                onInput={e => {
                  const v = parseInt((e.target as HTMLInputElement).value)
                  applyBorder(v)
                  const num = (e.target as HTMLInputElement).parentElement?.querySelector<HTMLInputElement>('input[type=number]')
                  if (num) num.value = String(v)
                }}
              />
              <input type="number" className={panelStyles.numInput}
                defaultValue={widthRef.current} min={1} max={50}
                style={{ width: '52px' }}
                onBlur={e => applyBorder(parseInt(e.target.value))}
              />
              <span className={panelStyles.unit}>px</span>
            </div>
          </div>

          {/* 样式 */}
          <div className={panelStyles.row}>
            <span className={panelStyles.label}>样式</span>
            <select className={panelStyles.select}
              defaultValue={styleRef.current}
              onChange={e => applyBorder(undefined, e.target.value)}
            >
              {BORDER_STYLES.map(st => (
                <option key={st} value={st}>{st}</option>
              ))}
            </select>
          </div>

          {/* 圆角（移入边框区块） */}
          <div className={panelStyles.row}>
            <span className={panelStyles.label}>圆角</span>
            <div className={panelStyles.rangeWrap}>
              <input type="range" className={panelStyles.range}
                min={0} max={80} defaultValue={Math.min(radius, 80)}
                onInput={e => {
                  const v = (e.target as HTMLInputElement).value
                  applyStyle(el, 'border-radius', `${v}px`)
                  const num = (e.target as HTMLInputElement).parentElement?.querySelector<HTMLInputElement>('input[type=number]')
                  if (num) num.value = v
                }}
              />
              <input type="number" className={panelStyles.numInput}
                defaultValue={radius} min={0} max={999}
                style={{ width: '52px' }}
                onBlur={e => applyStyle(el, 'border-radius', `${e.target.value}px`)}
              />
              <span className={panelStyles.unit}>px</span>
            </div>
          </div>
        </div>
      )}

      {/* 关闭时也保留圆角控件（常用） */}
      {!enabled && (
        <div className={panelStyles.row} style={{ marginTop: 8 }}>
          <span className={panelStyles.label}>圆角</span>
          <div className={panelStyles.rangeWrap}>
            <input type="range" className={panelStyles.range}
              min={0} max={80} defaultValue={Math.min(radius, 80)}
              onInput={e => {
                const v = (e.target as HTMLInputElement).value
                applyStyle(el, 'border-radius', `${v}px`)
                const num = (e.target as HTMLInputElement).parentElement?.querySelector<HTMLInputElement>('input[type=number]')
                if (num) num.value = v
              }}
            />
            <input type="number" className={panelStyles.numInput}
              defaultValue={radius} min={0} max={999}
              style={{ width: '52px' }}
              onBlur={e => applyStyle(el, 'border-radius', `${e.target.value}px`)}
            />
            <span className={panelStyles.unit}>px</span>
          </div>
        </div>
      )}
    </div>
  )
}
