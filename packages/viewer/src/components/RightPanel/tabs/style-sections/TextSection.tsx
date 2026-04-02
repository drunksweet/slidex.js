import panelStyles from '../../RightPanel.module.css'
import { useStyleApply } from '../../../../hooks/useStyleApply'

interface Props {
  el: Element
}

// 预设字体族
const FONT_FAMILIES = [
  { label: '默认', value: '' },
  // 中文
  { label: '思源黑体', value: '"Noto Sans SC", sans-serif' },
  { label: '苹方',     value: '"PingFang SC", "Apple SD Gothic Neo", sans-serif' },
  { label: '微软雅黑', value: '"Microsoft YaHei", sans-serif' },
  { label: '思源宋体', value: '"Noto Serif SC", serif' },
  // 英文无衬线
  { label: 'Inter',    value: 'Inter, sans-serif' },
  { label: 'Geist',    value: 'Geist, sans-serif' },
  { label: 'Arial',    value: 'Arial, sans-serif' },
  // 英文衬线
  { label: 'Georgia',  value: 'Georgia, serif' },
  { label: 'Times New Roman', value: '"Times New Roman", serif' },
  // 等宽
  { label: 'JetBrains Mono', value: '"JetBrains Mono", ui-monospace, monospace' },
  { label: '等宽系统字体',    value: 'ui-monospace, monospace' },
]

// 字重选项
const FONT_WEIGHTS = [
  { label: 'Thin 100',       value: '100' },
  { label: 'Light 300',      value: '300' },
  { label: 'Regular 400',    value: '400' },
  { label: 'Medium 500',     value: '500' },
  { label: 'SemiBold 600',   value: '600' },
  { label: 'Bold 700',       value: '700' },
  { label: 'ExtraBold 800',  value: '800' },
  { label: 'Black 900',      value: '900' },
]

// rgb(r, g, b) → #rrggbb
function rgbToHex(rgb: string) {
  const m = rgb.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/)
  if (!m) return '#000000'
  return '#' + [m[1], m[2], m[3]].map(n => parseInt(n).toString(16).padStart(2, '0')).join('')
}

// 当前 font-family 匹配预设
function matchFontFamily(computed: string): string {
  const lower = computed.toLowerCase()
  for (const f of FONT_FAMILIES) {
    if (!f.value) continue
    const first = f.value.split(',')[0].trim().replace(/['"]/g, '').toLowerCase()
    if (lower.includes(first)) return f.value
  }
  return ''
}

export function TextSection({ el }: Props) {
  const { applyStyle } = useStyleApply()
  const cs = window.getComputedStyle(el)

  const textColor  = rgbToHex(cs.color || '#ffffff')
  const fontSize   = Math.round(parseFloat(cs.fontSize) || 16)
  const fontWeight = cs.fontWeight || '400'
  const lineHeight = cs.lineHeight === 'normal'
    ? '1.5'
    : (parseFloat(cs.lineHeight) / parseFloat(cs.fontSize)).toFixed(1)
  const letterSpacing = Math.round(parseFloat(cs.letterSpacing) || 0)
  const currentFont   = matchFontFamily(cs.fontFamily)

  // 段落间距 / 首行缩进
  const marginTop    = Math.round(parseFloat(cs.marginTop)    || 0)
  const marginBottom = Math.round(parseFloat(cs.marginBottom) || 0)
  const textIndent   = parseFloat(cs.textIndent) > 0
    ? parseFloat((parseFloat(cs.textIndent) / parseFloat(cs.fontSize)).toFixed(1))
    : 0

  const apply = (prop: string, val: string) => applyStyle(el, prop, val)

  return (
    <div className={panelStyles.section}>
      <div className={panelStyles.sectionTitle}>文字</div>

      {/* 颜色 */}
      <div className={panelStyles.row}>
        <span className={panelStyles.label}>颜色</span>
        <div className={panelStyles.colorRow}>
          <div className={panelStyles.swatch}>
            <input type="color" className={panelStyles.swatchInput}
              defaultValue={textColor}
              onChange={e => apply('color', e.target.value)}
            />
          </div>
          <input type="text" className={panelStyles.hexInput}
            defaultValue={textColor.toUpperCase()}
            placeholder="#FFFFFF"
            onBlur={e => { const v = e.target.value.trim(); if (/^#[0-9a-fA-F]{3,8}$/.test(v)) apply('color', v) }}
            onKeyDown={e => { if (e.key === 'Enter') { const v = (e.target as HTMLInputElement).value.trim(); if (/^#[0-9a-fA-F]{3,8}$/.test(v)) apply('color', v) } }}
          />
        </div>
      </div>

      {/* 字号 */}
      <div className={panelStyles.row}>
        <span className={panelStyles.label}>字号</span>
        <input type="number" className={panelStyles.numInput}
          defaultValue={fontSize} min={8} max={200}
          onBlur={e => { const v = parseInt(e.target.value); if (v > 0) apply('font-size', `${v}px`) }}
          onKeyDown={e => { if (e.key === 'Enter') { const v = parseInt((e.target as HTMLInputElement).value); if (v > 0) apply('font-size', `${v}px`) } }}
        />
        <span className={panelStyles.unit}>px</span>
      </div>

      <div className={panelStyles.rowDivider} />

      {/* 字体族 */}
      <div className={panelStyles.row}>
        <span className={panelStyles.label}>字体</span>
        <select
          className={panelStyles.select}
          defaultValue={currentFont}
          onChange={e => { if (e.target.value) apply('font-family', e.target.value) }}
        >
          {FONT_FAMILIES.map(f => (
            <option key={f.value} value={f.value}>{f.label}</option>
          ))}
        </select>
      </div>

      {/* 字重 */}
      <div className={panelStyles.row}>
        <span className={panelStyles.label}>字重</span>
        <select
          className={panelStyles.select}
          defaultValue={fontWeight}
          onChange={e => apply('font-weight', e.target.value)}
        >
          {FONT_WEIGHTS.map(w => (
            <option key={w.value} value={w.value}>{w.label}</option>
          ))}
        </select>
      </div>

      <div className={panelStyles.rowDivider} />

      {/* 行高 */}
      <div className={panelStyles.row}>
        <span className={panelStyles.label}>行高</span>
        <div className={panelStyles.rangeWrap}>
          <input type="range" className={panelStyles.range}
            min={80} max={300} step={5}
            defaultValue={Math.round(parseFloat(lineHeight) * 100)}
            onInput={e => {
              const v = (parseInt((e.target as HTMLInputElement).value) / 100).toFixed(2)
              apply('line-height', v)
              const num = (e.target as HTMLInputElement).parentElement?.querySelector<HTMLInputElement>('input[type=number]')
              if (num) num.value = v
            }}
          />
          <input type="number" className={panelStyles.numInput}
            defaultValue={parseFloat(lineHeight)}
            min={0.8} max={3} step={0.1}
            style={{ width: '52px' }}
            onBlur={e => { const v = parseFloat(e.target.value); if (v > 0) apply('line-height', String(v)) }}
          />
        </div>
      </div>

      {/* 字间距 */}
      <div className={panelStyles.row}>
        <span className={panelStyles.label}>字间距</span>
        <div className={panelStyles.rangeWrap}>
          <input type="range" className={panelStyles.range}
            min={-5} max={20} step={1}
            defaultValue={letterSpacing}
            onInput={e => {
              const v = (e.target as HTMLInputElement).value
              apply('letter-spacing', `${v}px`)
              const num = (e.target as HTMLInputElement).parentElement?.querySelector<HTMLInputElement>('input[type=number]')
              if (num) num.value = v
            }}
          />
          <input type="number" className={panelStyles.numInput}
            defaultValue={letterSpacing}
            min={-5} max={20}
            style={{ width: '52px' }}
            onBlur={e => apply('letter-spacing', `${e.target.value}px`)}
          />
          <span className={panelStyles.unit}>px</span>
        </div>
      </div>

      <div className={panelStyles.rowDivider} />

      {/* 段前距 */}
      <div className={panelStyles.row}>
        <span className={panelStyles.label}>段前距</span>
        <div className={panelStyles.rangeWrap}>
          <input type="range" className={panelStyles.range}
            min={0} max={60} step={1}
            defaultValue={marginTop}
            onInput={e => {
              const v = (e.target as HTMLInputElement).value
              apply('margin-top', `${v}px`)
              const num = (e.target as HTMLInputElement).parentElement?.querySelector<HTMLInputElement>('input[type=number]')
              if (num) num.value = v
            }}
          />
          <input type="number" className={panelStyles.numInput}
            defaultValue={marginTop} min={0} max={60}
            style={{ width: '52px' }}
            onBlur={e => apply('margin-top', `${Math.max(0, parseInt(e.target.value) || 0)}px`)}
          />
          <span className={panelStyles.unit}>px</span>
        </div>
      </div>

      {/* 段后距 */}
      <div className={panelStyles.row}>
        <span className={panelStyles.label}>段后距</span>
        <div className={panelStyles.rangeWrap}>
          <input type="range" className={panelStyles.range}
            min={0} max={60} step={1}
            defaultValue={marginBottom}
            onInput={e => {
              const v = (e.target as HTMLInputElement).value
              apply('margin-bottom', `${v}px`)
              const num = (e.target as HTMLInputElement).parentElement?.querySelector<HTMLInputElement>('input[type=number]')
              if (num) num.value = v
            }}
          />
          <input type="number" className={panelStyles.numInput}
            defaultValue={marginBottom} min={0} max={60}
            style={{ width: '52px' }}
            onBlur={e => apply('margin-bottom', `${Math.max(0, parseInt(e.target.value) || 0)}px`)}
          />
          <span className={panelStyles.unit}>px</span>
        </div>
      </div>

      {/* 首行缩进 */}
      <div className={panelStyles.row}>
        <span className={panelStyles.label}>首行缩进</span>
        <div className={panelStyles.rangeWrap}>
          <input type="range" className={panelStyles.range}
            min={0} max={4} step={0.5}
            defaultValue={textIndent}
            onInput={e => {
              const v = parseFloat((e.target as HTMLInputElement).value)
              apply('text-indent', v > 0 ? `${v}em` : '0')
              const num = (e.target as HTMLInputElement).parentElement?.querySelector<HTMLInputElement>('input[type=number]')
              if (num) num.value = String(v)
            }}
          />
          <input type="number" className={panelStyles.numInput}
            defaultValue={textIndent} min={0} max={4} step={0.5}
            style={{ width: '52px' }}
            onBlur={e => {
              const v = parseFloat(e.target.value) || 0
              apply('text-indent', v > 0 ? `${v}em` : '0')
            }}
          />
          <span className={panelStyles.unit}>em</span>
        </div>
      </div>
    </div>
  )
}
