import panelStyles from '../RightPanel.module.css'

interface Props { el: Element }

function rgbToHex(rgb: string) {
  const m = rgb.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/)
  if (!m) return '#000000'
  return '#' + [m[1], m[2], m[3]].map((n) => parseInt(n).toString(16).padStart(2, '0')).join('')
}

function applyStyle(el: Element, prop: string, val: string) {
  document.dispatchEvent(new CustomEvent('tang:apply-style', { detail: { el, prop, val } }))
}

export function StyleTab({ el }: Props) {
  const cs = window.getComputedStyle(el)

  // 颜色
  const textColor = rgbToHex(cs.color || '#ffffff')
  const bgRaw     = cs.backgroundColor || 'transparent'
  const bgColor   = bgRaw.startsWith('rgb') ? rgbToHex(bgRaw) : '#0f172a'

  // 字号
  const fontSize = Math.round(parseFloat(cs.fontSize) || 16)
  const opacity  = Math.round(parseFloat(cs.opacity ?? '1') * 100)
  const radius   = parseInt(cs.borderRadius) || 0

  return (
    <div>
      {/* 文字颜色 */}
      <div className={panelStyles.section}>
        <div className={panelStyles.sectionTitle}>文字</div>
        <div className={panelStyles.row}>
          <span className={panelStyles.label}>颜色</span>
          <div className={panelStyles.colorRow}>
            <div className={panelStyles.swatch}>
              <input
                type="color"
                className={panelStyles.swatchInput}
                defaultValue={textColor}
                onChange={(e) => applyStyle(el, 'color', e.target.value)}
              />
            </div>
            <input
              type="text"
              className={panelStyles.hexInput}
              defaultValue={textColor.toUpperCase()}
              placeholder="#FFFFFF"
              onBlur={(e) => {
                const v = e.target.value.trim()
                if (/^#[0-9a-fA-F]{3,8}$/.test(v)) applyStyle(el, 'color', v)
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  const v = (e.target as HTMLInputElement).value.trim()
                  if (/^#[0-9a-fA-F]{3,8}$/.test(v)) applyStyle(el, 'color', v)
                }
              }}
            />
          </div>
        </div>
        <div className={panelStyles.row}>
          <span className={panelStyles.label}>字号</span>
          <input
            type="number"
            className={panelStyles.numInput}
            defaultValue={fontSize}
            min={8}
            max={200}
            onBlur={(e) => {
              const v = parseInt(e.target.value)
              if (v > 0) applyStyle(el, 'font-size', `${v}px`)
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                const v = parseInt((e.target as HTMLInputElement).value)
                if (v > 0) applyStyle(el, 'font-size', `${v}px`)
              }
            }}
          />
        </div>
      </div>

      <div className={panelStyles.divider} />

      {/* 背景色 */}
      <div className={panelStyles.section}>
        <div className={panelStyles.sectionTitle}>填充</div>
        <div className={panelStyles.row}>
          <span className={panelStyles.label}>背景</span>
          <div className={panelStyles.colorRow}>
            <div className={panelStyles.swatch}>
              <input
                type="color"
                className={panelStyles.swatchInput}
                defaultValue={bgColor}
                onChange={(e) => applyStyle(el, 'background-color', e.target.value)}
              />
            </div>
            <input
              type="text"
              className={panelStyles.hexInput}
              defaultValue={bgColor.toUpperCase()}
              placeholder="#000000"
              onBlur={(e) => {
                const v = e.target.value.trim()
                if (/^#[0-9a-fA-F]{3,8}$/.test(v)) applyStyle(el, 'background-color', v)
              }}
            />
          </div>
        </div>
      </div>

      <div className={panelStyles.divider} />

      {/* 圆角 */}
      <div className={panelStyles.section}>
        <div className={panelStyles.sectionTitle}>外观</div>
        <div className={panelStyles.row}>
          <span className={panelStyles.label}>圆角</span>
          <div className={panelStyles.rangeWrap}>
            <input
              type="range"
              className={panelStyles.range}
              min={0} max={80}
              defaultValue={Math.min(radius, 80)}
              onInput={(e) => {
                const v = (e.target as HTMLInputElement).value
                applyStyle(el, 'border-radius', `${v}px`)
                const num = (e.target as HTMLInputElement).closest('.row')?.querySelector<HTMLInputElement>('input[type=number]')
                if (num) num.value = v
              }}
            />
            <input
              type="number"
              className={panelStyles.numInput}
              defaultValue={radius}
              min={0} max={999}
              style={{ width: '48px' }}
              onBlur={(e) => applyStyle(el, 'border-radius', `${e.target.value}px`)}
            />
          </div>
        </div>

        {/* 不透明度 */}
        <div className={panelStyles.row}>
          <span className={panelStyles.label}>透明度</span>
          <div className={panelStyles.rangeWrap}>
            <input
              type="range"
              className={panelStyles.range}
              min={0} max={100}
              defaultValue={opacity}
              onInput={(e) => {
                const v = parseInt((e.target as HTMLInputElement).value) / 100
                applyStyle(el, 'opacity', String(v))
              }}
            />
            <input
              type="number"
              className={panelStyles.numInput}
              defaultValue={opacity}
              min={0} max={100}
              style={{ width: '48px' }}
              onBlur={(e) => applyStyle(el, 'opacity', String(parseInt(e.target.value) / 100))}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
