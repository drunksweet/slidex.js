import { useSlideStore } from '../../../store/slideStore'
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

function applyStyle(el: Element, prop: string, val: string) {
  document.dispatchEvent(new CustomEvent('tang:apply-style', { detail: { el, prop, val } }))
}

function applyMove(el: Element, x: number, y: number) {
  applyStyle(el, 'transform', `translate(${x}px, ${y}px)`)
}

function alignEl(el: Element, dir: string, scale: number) {
  const slideHost = document.getElementById('slide-host')
  const slide = slideHost?.querySelector('.slide') as HTMLElement
  if (!slide) return

  const sr = slide.getBoundingClientRect()
  const er = el.getBoundingClientRect()
  const { x: bx, y: by } = getTranslate(el)

  let nx = bx, ny = by
  switch (dir) {
    case 'left':    nx = bx + (sr.left - er.left) / scale;                           break
    case 'hcenter': nx = bx + (sr.left + sr.width / 2 - er.left - er.width / 2) / scale; break
    case 'right':   nx = bx + (sr.right - er.right) / scale;                         break
    case 'top':     ny = by + (sr.top - er.top) / scale;                             break
    case 'vcenter': ny = by + (sr.top + sr.height / 2 - er.top - er.height / 2) / scale; break
    case 'bottom':  ny = by + (sr.bottom - er.bottom) / scale;                       break
  }
  applyMove(el, Math.round(nx), Math.round(ny))
}

export function LayoutTab({ el }: Props) {
  const { scale } = useSlideStore()
  const { x, y } = getTranslate(el)

  return (
    <div>
      {/* 位置 */}
      <div className={panelStyles.section}>
        <div className={panelStyles.sectionTitle}>位置</div>
        <div className={panelStyles.row}>
          <span className={panelStyles.label}>X</span>
          <input
            type="number"
            className={panelStyles.numInput}
            defaultValue={x}
            onBlur={(e) => {
              const nx = parseInt(e.target.value) || 0
              const { y: cy } = getTranslate(el)
              applyMove(el, nx, cy)
            }}
          />
          <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', marginLeft: 2 }}>px</span>
        </div>
        <div className={panelStyles.row}>
          <span className={panelStyles.label}>Y</span>
          <input
            type="number"
            className={panelStyles.numInput}
            defaultValue={y}
            onBlur={(e) => {
              const ny = parseInt(e.target.value) || 0
              const { x: cx } = getTranslate(el)
              applyMove(el, cx, ny)
            }}
          />
          <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', marginLeft: 2 }}>px</span>
        </div>
      </div>

      <div className={panelStyles.divider} />

      {/* 对齐 */}
      <div className={panelStyles.section}>
        <div className={panelStyles.sectionTitle}>对齐（相对幻灯片）</div>
        <div style={{ marginBottom: 6 }}>
          <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.25)', marginBottom: 5 }}>水平</div>
          <div className={panelStyles.alignBtns}>
            <button className={panelStyles.alignBtn} onClick={() => alignEl(el, 'left',    scale)} title="左对齐">⇤ 左</button>
            <button className={panelStyles.alignBtn} onClick={() => alignEl(el, 'hcenter', scale)} title="水平居中">↔ 中</button>
            <button className={panelStyles.alignBtn} onClick={() => alignEl(el, 'right',   scale)} title="右对齐">⇥ 右</button>
          </div>
        </div>
        <div>
          <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.25)', marginBottom: 5 }}>垂直</div>
          <div className={panelStyles.alignBtns}>
            <button className={panelStyles.alignBtn} onClick={() => alignEl(el, 'top',     scale)} title="顶对齐">⇡ 顶</button>
            <button className={panelStyles.alignBtn} onClick={() => alignEl(el, 'vcenter', scale)} title="垂直居中">↕ 中</button>
            <button className={panelStyles.alignBtn} onClick={() => alignEl(el, 'bottom',  scale)} title="底对齐">⇣ 底</button>
          </div>
        </div>
      </div>

      <div className={panelStyles.divider} />

      {/* 层级 */}
      <div className={panelStyles.section}>
        <div className={panelStyles.sectionTitle}>层级</div>
        <div className={panelStyles.alignBtns}>
          <button
            className={panelStyles.alignBtn}
            style={{ gridColumn: 'span 3' }}
            onClick={() => {
              const cs = window.getComputedStyle(el)
              const cur = parseInt(cs.zIndex) || 0
              applyStyle(el, 'z-index', String(cur + 10))
            }}
          >
            ↑ 置于顶层 (+10)
          </button>
        </div>
      </div>
    </div>
  )
}
