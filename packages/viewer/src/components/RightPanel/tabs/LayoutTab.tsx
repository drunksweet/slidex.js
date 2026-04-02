import { useSlideStore } from '../../../store/slideStore'
import { useStyleApply } from '../../../hooks/useStyleApply'
import { TransformSection } from './style-sections/TransformSection'
import panelStyles from '../RightPanel.module.css'

interface Props { el: Element }

function getTranslate(el: Element) {
  const t = (el as HTMLElement).style.transform || ''
  const m = t.match(/translate\(([^,]+),\s*([^)]+)\)/)
  return {
    x: m ? Math.round(parseFloat(m[1])) : 0,
    y: m ? Math.round(parseFloat(m[2])) : 0,
  }
}

function alignEl(el: Element, dir: string, scale: number) {
  const slide = document.getElementById('slide-host')?.querySelector('.slide') as HTMLElement
  if (!slide) return
  const sr = slide.getBoundingClientRect()
  const er = el.getBoundingClientRect()
  const { x: bx, y: by } = getTranslate(el)
  let nx = bx, ny = by
  switch (dir) {
    case 'left':    nx = bx + (sr.left - er.left) / scale;                                break
    case 'hcenter': nx = bx + (sr.left + sr.width / 2 - er.left - er.width / 2) / scale; break
    case 'right':   nx = bx + (sr.right - er.right) / scale;                              break
    case 'top':     ny = by + (sr.top - er.top) / scale;                                  break
    case 'vcenter': ny = by + (sr.top + sr.height / 2 - er.top - er.height / 2) / scale;  break
    case 'bottom':  ny = by + (sr.bottom - er.bottom) / scale;                            break
  }
  document.dispatchEvent(new CustomEvent('tang:apply-style', {
    detail: { el, prop: 'transform', val: `translate(${Math.round(nx)}px, ${Math.round(ny)}px)` },
  }))
}

export function LayoutTab({ el }: Props) {
  const { scale } = useSlideStore()
  const { applyStyle } = useStyleApply()
  const { x, y } = getTranslate(el)

  const w = Math.round((el as HTMLElement).offsetWidth)
  const h = Math.round((el as HTMLElement).offsetHeight)
  const cs = window.getComputedStyle(el)
  const curZ = parseInt(cs.zIndex) || 0

  return (
    <div>
      {/* ── 尺寸 W / H ── */}
      <div className={panelStyles.section}>
        <div className={panelStyles.sectionTitle}>尺寸</div>
        <div className={panelStyles.row}>
          <span className={panelStyles.label}>W</span>
          <input
            type="number"
            className={panelStyles.numInput}
            defaultValue={w}
            min={1}
            onBlur={e => { const v = parseInt(e.target.value); if (v > 0) applyStyle(el, 'width', `${v}px`) }}
            onKeyDown={e => { if (e.key === 'Enter') { const v = parseInt((e.target as HTMLInputElement).value); if (v > 0) applyStyle(el, 'width', `${v}px`) } }}
          />
          <span className={panelStyles.unit}>px</span>
          <span className={panelStyles.label} style={{ marginLeft: 8 }}>H</span>
          <input
            type="number"
            className={panelStyles.numInput}
            defaultValue={h}
            min={1}
            onBlur={e => { const v = parseInt(e.target.value); if (v > 0) applyStyle(el, 'height', `${v}px`) }}
            onKeyDown={e => { if (e.key === 'Enter') { const v = parseInt((e.target as HTMLInputElement).value); if (v > 0) applyStyle(el, 'height', `${v}px`) } }}
          />
          <span className={panelStyles.unit}>px</span>
        </div>
      </div>

      <div className={panelStyles.divider} />

      {/* ── 位置 X / Y ── */}
      <div className={panelStyles.section}>
        <div className={panelStyles.sectionTitle}>位置</div>
        <div className={panelStyles.row}>
          <span className={panelStyles.label}>X</span>
          <input
            type="number"
            className={panelStyles.numInput}
            defaultValue={x}
            onBlur={e => {
              const nx = parseInt(e.target.value) || 0
              const { y: cy } = getTranslate(el)
              applyStyle(el, 'transform', `translate(${nx}px, ${cy}px)`)
            }}
          />
          <span className={panelStyles.unit}>px</span>
        </div>
        <div className={panelStyles.row}>
          <span className={panelStyles.label}>Y</span>
          <input
            type="number"
            className={panelStyles.numInput}
            defaultValue={y}
            onBlur={e => {
              const ny = parseInt(e.target.value) || 0
              const { x: cx } = getTranslate(el)
              applyStyle(el, 'transform', `translate(${cx}px, ${ny}px)`)
            }}
          />
          <span className={panelStyles.unit}>px</span>
        </div>
      </div>

      <div className={panelStyles.divider} />

      {/* ── 对齐 ── */}
      <div className={panelStyles.section}>
        <div className={panelStyles.sectionTitle}>对齐（相对幻灯片）</div>
        <div style={{ marginBottom: 6 }}>
          <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.25)', marginBottom: 5 }}>水平</div>
          <div className={panelStyles.alignBtns}>
            <button className={panelStyles.alignBtn} onClick={() => alignEl(el, 'left', scale)} title="左对齐">⇤ 左</button>
            <button className={panelStyles.alignBtn} onClick={() => alignEl(el, 'hcenter', scale)} title="水平居中">↔ 中</button>
            <button className={panelStyles.alignBtn} onClick={() => alignEl(el, 'right', scale)} title="右对齐">⇥ 右</button>
          </div>
        </div>
        <div>
          <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.25)', marginBottom: 5 }}>垂直</div>
          <div className={panelStyles.alignBtns}>
            <button className={panelStyles.alignBtn} onClick={() => alignEl(el, 'top', scale)} title="顶对齐">⇡ 顶</button>
            <button className={panelStyles.alignBtn} onClick={() => alignEl(el, 'vcenter', scale)} title="垂直居中">↕ 中</button>
            <button className={panelStyles.alignBtn} onClick={() => alignEl(el, 'bottom', scale)} title="底对齐">⇣ 底</button>
          </div>
        </div>
      </div>

      <div className={panelStyles.divider} />

      {/* ── 层级 ── */}
      <div className={panelStyles.section}>
        <div className={panelStyles.sectionTitle}>层级</div>
        <div className={panelStyles.alignBtns}>
          <button
            className={panelStyles.alignBtn}
            style={{ gridColumn: 'span 3' }}
            onClick={() => applyStyle(el, 'z-index', String(curZ + 10))}
          >
            ↑ 置于顶层 (+10)
          </button>
          <button
            className={panelStyles.alignBtn}
            style={{ gridColumn: 'span 3' }}
            onClick={() => applyStyle(el, 'z-index', String(Math.max(0, curZ - 10)))}
          >
            ↓ 置于底层 (-10)
          </button>
        </div>
        <div className={panelStyles.row} style={{ marginTop: 8 }}>
          <span className={panelStyles.label}>层级值</span>
          <input
            type="number"
            className={panelStyles.numInput}
            defaultValue={curZ}
            min={0}
            max={9999}
            onBlur={e => applyStyle(el, 'z-index', e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') applyStyle(el, 'z-index', (e.target as HTMLInputElement).value) }}
          />
        </div>
      </div>

      <div className={panelStyles.divider} />

      {/* ── 变换：缩放 + 翻转 ── */}
      <TransformSection el={el} />
    </div>
  )
}
