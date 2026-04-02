import { useRef } from 'react'
import { useStyleApply } from '../../../../hooks/useStyleApply'
import { parseFullTransform, buildFullTransform } from '../../../../utils/transformUtils'
import panelStyles from '../../RightPanel.module.css'
import s from './TransformSection.module.css'

interface Props { el: Element }

export function TransformSection({ el }: Props) {
  const { applyStyle } = useStyleApply()
  const hel = el as HTMLElement

  // 初始化解析当前 transform
  const initParts = parseFullTransform(hel.style.transform || '')
  const partsRef  = useRef({ ...initParts })

  function applyTransform(patch: Partial<typeof initParts>) {
    Object.assign(partsRef.current, patch)
    applyStyle(el, 'transform', buildFullTransform(partsRef.current))
  }

  const { sx, sy, flipX, flipY } = partsRef.current

  return (
    <div className={panelStyles.section}>
      <div className={panelStyles.sectionTitle}>变换</div>

      {/* ── 缩放 ── */}
      <div className={panelStyles.row}>
        <span className={panelStyles.label}>缩放 X</span>
        <div className={panelStyles.rangeWrap}>
          <input type="range" className={panelStyles.range}
            min={10} max={300} defaultValue={sx}
            onInput={e => {
              const v = parseInt((e.target as HTMLInputElement).value)
              applyTransform({ sx: v })
              const num = (e.target as HTMLInputElement).parentElement?.querySelector<HTMLInputElement>('input[type=number]')
              if (num) num.value = String(v)
            }}
          />
          <input type="number" className={panelStyles.numInput}
            defaultValue={sx} min={10} max={300}
            style={{ width: '52px' }}
            onBlur={e => applyTransform({ sx: parseInt(e.target.value) || 100 })}
          />
          <span className={panelStyles.unit}>%</span>
        </div>
      </div>

      <div className={panelStyles.row}>
        <span className={panelStyles.label}>缩放 Y</span>
        <div className={panelStyles.rangeWrap}>
          <input type="range" className={panelStyles.range}
            min={10} max={300} defaultValue={sy}
            onInput={e => {
              const v = parseInt((e.target as HTMLInputElement).value)
              applyTransform({ sy: v })
              const num = (e.target as HTMLInputElement).parentElement?.querySelector<HTMLInputElement>('input[type=number]')
              if (num) num.value = String(v)
            }}
          />
          <input type="number" className={panelStyles.numInput}
            defaultValue={sy} min={10} max={300}
            style={{ width: '52px' }}
            onBlur={e => applyTransform({ sy: parseInt(e.target.value) || 100 })}
          />
          <span className={panelStyles.unit}>%</span>
        </div>
      </div>

      <div className={panelStyles.rowDivider} style={{ margin: '6px 0' }} />

      {/* ── 翻转 ── */}
      <div className={panelStyles.row}>
        <span className={panelStyles.label}>翻转</span>
        <div className={s.flipBtns}>
          <button
            className={`${s.flipBtn} ${flipX ? s.flipActive : ''}`}
            title="水平翻转"
            onClick={() => applyTransform({ flipX: !partsRef.current.flipX })}
          >↔ 水平</button>
          <button
            className={`${s.flipBtn} ${flipY ? s.flipActive : ''}`}
            title="垂直翻转"
            onClick={() => applyTransform({ flipY: !partsRef.current.flipY })}
          >↕ 垂直</button>
        </div>
      </div>
    </div>
  )
}
