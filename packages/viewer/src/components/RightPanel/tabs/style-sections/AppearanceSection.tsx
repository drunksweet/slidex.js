import { useState, useRef } from 'react'
import { useStyleApply } from '../../../../hooks/useStyleApply'
// import { LiquidGlassPreview } from './LiquidGlassPreview'  // TODO: 下次迭代再接入
import panelStyles from '../../RightPanel.module.css'
import s from './AppearanceSection.module.css'

interface Props { el: Element }

// ── 预设滤镜 ─────────────────────────────────────────────────────────────────

const FILTER_PRESETS = [
  { label: '正常', value: 'none' },
  { label: '模糊', value: 'blur(4px)' },
  { label: '黑白', value: 'grayscale(100%)' },
  { label: '高亮', value: 'brightness(130%) saturate(120%)' },
] as const

function matchPreset(filter: string): string {
  if (!filter || filter === 'none') return 'none'
  for (const p of FILTER_PRESETS) {
    if (p.value !== 'none' && filter === p.value) return p.value
  }
  return '__custom__'
}

function parseFilterParts(filter: string) {
  const bright   = filter.match(/brightness\(([\d.]+)%?\)/)
  const contrast = filter.match(/contrast\(([\d.]+)%?\)/)
  const saturate = filter.match(/saturate\(([\d.]+)%?\)/)
  return {
    brightness: bright   ? Math.round(parseFloat(bright[1]))   : 100,
    contrast:   contrast ? Math.round(parseFloat(contrast[1])) : 100,
    saturate:   saturate ? Math.round(parseFloat(saturate[1])) : 100,
  }
}

function hasImageContent(el: Element): boolean {
  if (el.tagName === 'IMG') return true
  if (el.querySelector('img')) return true
  const bg = window.getComputedStyle(el).backgroundImage
  return !!bg && bg !== 'none'
}

function SliderRow({
  label, min, max, defaultValue, unit = '%', onChange,
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

export function AppearanceSection({ el }: Props) {
  const { applyStyle } = useStyleApply()
  const cs = window.getComputedStyle(el)

  // 透明度
  const opacity = Math.round(parseFloat(cs.opacity ?? '1') * 100)

  // 滤镜
  const filterRaw      = cs.filter && cs.filter !== 'none' ? cs.filter : ''
  const initPreset     = matchPreset(filterRaw)
  const initParts      = parseFilterParts(filterRaw)
  const [filterPreset, setFilterPreset] = useState(initPreset)
  const filterRef      = useRef(initParts)
  const showFilter     = hasImageContent(el)

  function buildCustomFilter() {
    const { brightness, contrast, saturate } = filterRef.current
    const parts = []
    if (brightness !== 100) parts.push(`brightness(${brightness}%)`)
    if (contrast   !== 100) parts.push(`contrast(${contrast}%)`)
    if (saturate   !== 100) parts.push(`saturate(${saturate}%)`)
    return parts.length ? parts.join(' ') : 'none'
  }

  function selectPreset(val: string) {
    setFilterPreset(val)
    applyStyle(el, 'filter', val === '__custom__' ? buildCustomFilter() : val)
  }

  function updateCustomFilter(key: 'brightness' | 'contrast' | 'saturate', v: number) {
    filterRef.current[key] = v
    setFilterPreset('__custom__')
    applyStyle(el, 'filter', buildCustomFilter())
  }

  return (
    <div className={panelStyles.section}>
      <div className={panelStyles.sectionTitle}>外观</div>

      {/* 透明度 */}
      <SliderRow label="透明度" min={0} max={100} defaultValue={opacity}
        onChange={v => applyStyle(el, 'opacity', String(v / 100))}
      />

      <div className={panelStyles.rowDivider} style={{ margin: '8px 0' }} />

      {/* ── 液态玻璃（暂时隔离，下次迭代再接入） ── */}
      {/* <LiquidGlassPreview el={el} /> */}

      {/* ── 滤镜（仅图片元素显示） ── */}
      {showFilter && (
        <>
          <div className={panelStyles.rowDivider} style={{ margin: '8px 0' }} />
          <div className={s.filterLabel}>滤镜</div>

          <div className={s.presetBtns}>
            {FILTER_PRESETS.map(p => (
              <button
                key={p.value}
                className={`${s.presetBtn} ${filterPreset === p.value ? s.presetActive : ''}`}
                onClick={() => selectPreset(p.value)}
              >{p.label}</button>
            ))}
          </div>

          <div className={s.body} style={{ marginTop: 6 }}>
            <SliderRow label="亮度"   min={0} max={200} defaultValue={filterRef.current.brightness}
              onChange={v => updateCustomFilter('brightness', v)} />
            <SliderRow label="对比度" min={0} max={200} defaultValue={filterRef.current.contrast}
              onChange={v => updateCustomFilter('contrast', v)} />
            <SliderRow label="饱和度" min={0} max={200} defaultValue={filterRef.current.saturate}
              onChange={v => updateCustomFilter('saturate', v)} />
          </div>
        </>
      )}
    </div>
  )
}
