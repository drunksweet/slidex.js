import { useState, useEffect, useCallback } from 'react'
import {
  injectLiquidGlass,
  ejectLiquidGlass,
  hasLiquidGlass,
  getSavedParams,
  LG_ATTR,
  type LiquidGlassParams,
} from '../../../../utils/liquidGlassManager'
import panelStyles from '../../RightPanel.module.css'
import s from './LiquidGlassPreview.module.css'

interface Props {
  el: Element
  onClose?: () => void
}

const DEFAULT_PARAMS: LiquidGlassParams = {
  displacementScale:   70,
  blurAmount:          0.06,
  saturation:          140,
  aberrationIntensity: 2,
  elasticity:          0.15,
  cornerRadius:        16,
  overLight:           false,
  mode:                'standard',
}

/** 通过 tang:apply-style 把 data-liquid-glass 属性保存到 HTML 文件 */
function persistAttr(el: Element, params: LiquidGlassParams) {
  document.dispatchEvent(new CustomEvent('tang:apply-style', {
    detail: { el, prop: LG_ATTR, val: JSON.stringify(params) },
  }))
}

/** 清除保存的属性 */
function clearAttr(el: Element) {
  document.dispatchEvent(new CustomEvent('tang:apply-style', {
    detail: { el, prop: LG_ATTR, val: '' },
  }))
}

export function LiquidGlassPreview({ el, onClose }: Props) {
  // 优先读已保存参数，没有则用默认值
  const [params, setParams] = useState<LiquidGlassParams>(
    () => getSavedParams(el) ?? { ...DEFAULT_PARAMS }
  )
  const [active, setActive] = useState(() => hasLiquidGlass(el))

  // 挂载时如果已注入则激活（保持参数）
  useEffect(() => {
    if (hasLiquidGlass(el)) {
      setActive(true)
      injectLiquidGlass(el, getSavedParams(el) ?? params)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const doInject = useCallback((p: LiquidGlassParams) => {
    injectLiquidGlass(el, p)
    persistAttr(el, p)   // ← 同步保存属性到 HTML
  }, [el])

  function update<K extends keyof LiquidGlassParams>(key: K, val: LiquidGlassParams[K]) {
    const next = { ...params, [key]: val }
    setParams(next)
    if (active) doInject(next)
  }

  function toggle(on: boolean) {
    setActive(on)
    if (on) doInject(params)
    else {
      ejectLiquidGlass(el)
      clearAttr(el)
    }
  }

  function handleClear() {
    ejectLiquidGlass(el)
    clearAttr(el)
    setActive(false)
    onClose?.()
  }

  return (
    <div className={s.wrap}>
      {/* ── 标题行 + 开关 ── */}
      <div className={s.header}>
        <div className={s.headerLeft}>
          <div className={s.glassIcon} />
          <div>
            <div className={s.title}>液态玻璃</div>
            <div className={s.subtitle}>实时注入 · 调参即生效</div>
          </div>
        </div>
        <label className={s.toggle}>
          <input type="checkbox" checked={active} onChange={e => toggle(e.target.checked)} />
          <span className={s.track}><span className={s.thumb} /></span>
        </label>
      </div>

      {/* ── 参数（仅激活时显示） ── */}
      {active && (
        <div className={s.body}>
          {/* 折射强度 */}
          <SliderRow label="折射强度" min={0}   max={150} step={1}
            value={params.displacementScale}
            onChange={v => update('displacementScale', v)} />

          {/* 模糊 */}
          <SliderRow label="模糊度" min={0}    max={0.5}  step={0.01}
            value={params.blurAmount} decimals={2}
            onChange={v => update('blurAmount', v)} />

          {/* 饱和度 */}
          <SliderRow label="饱和度" min={80}   max={220}  step={5}
            value={params.saturation}
            onChange={v => update('saturation', v)} />

          {/* 色差 */}
          <SliderRow label="色差"   min={0}    max={6}    step={0.5}
            value={params.aberrationIntensity} decimals={1}
            onChange={v => update('aberrationIntensity', v)} />

          {/* 弹性 */}
          <SliderRow label="弹性"   min={0}    max={0.6}  step={0.05}
            value={params.elasticity} decimals={2}
            onChange={v => update('elasticity', v)} />

          {/* 圆角 */}
          <SliderRow label="圆角"   min={0}    max={80}   step={1}
            value={params.cornerRadius} unit="px"
            onChange={v => update('cornerRadius', v)} />

          {/* 折射模式 */}
          <div className={s.row}>
            <span className={s.rowLabel}>折射模式</span>
            <select className={panelStyles.select}
              value={params.mode}
              onChange={e => update('mode', e.target.value as LiquidGlassParams['mode'])}
            >
              <option value="standard">标准 (standard)</option>
              <option value="polar">极坐标 (polar)</option>
              <option value="prominent">凸显 (prominent)</option>
              <option value="shader">着色器 (shader)</option>
            </select>
          </div>

          {/* 亮色模式 */}
          <label className={s.checkRow}>
            <input type="checkbox" checked={params.overLight}
              onChange={e => update('overLight', e.target.checked)}
            />
            <span>亮色背景模式</span>
          </label>
        </div>
      )}

      {/* ── 按钮 ── */}
      <div className={s.footer}>
        <button className={s.btnClear} onClick={handleClear}>
          <span>✕</span> 清除
        </button>
        {onClose && (
          <button className={s.btnDone} onClick={onClose}>
            完成
          </button>
        )}
      </div>
    </div>
  )
}

// ── 通用滑块行 ─────────────────────────────────────────────────────────────────

function SliderRow({ label, min, max, step, value, unit, decimals = 0, onChange }: {
  label: string; min: number; max: number; step: number
  value: number; unit?: string; decimals?: number
  onChange: (v: number) => void
}) {
  const fmt = (n: number) => decimals > 0 ? n.toFixed(decimals) : String(Math.round(n))
  const pct = ((value - min) / (max - min)) * 100

  return (
    <div className={s.row}>
      <div className={s.rowHeader}>
        <span className={s.rowLabel}>{label}</span>
        <span className={s.rowVal}>{fmt(value)}{unit ?? ''}</span>
      </div>
      <input
        type="range"
        className={s.slider}
        min={min} max={max} step={step}
        value={value}
        style={{ '--pct': `${pct}%` } as React.CSSProperties}
        onChange={e => onChange(Math.min(max, Math.max(min, parseFloat(e.target.value))))}
      />
    </div>
  )
}
