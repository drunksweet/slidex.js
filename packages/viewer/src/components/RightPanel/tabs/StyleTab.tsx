import { TextSection }       from './style-sections/TextSection'
import { FillSection }       from './style-sections/FillSection'
import { BorderSection }     from './style-sections/BorderSection'
import { ShadowSection }     from './style-sections/ShadowSection'
import { AppearanceSection } from './style-sections/AppearanceSection'
import panelStyles from '../RightPanel.module.css'

interface Props { el: Element }

export function StyleTab({ el }: Props) {
  return (
    <div>
      {/* ── 文字 ── */}
      <TextSection el={el} />

      <div className={panelStyles.divider} />

      {/* ── 填充（纯色 + Alpha + 渐变） ── */}
      <FillSection el={el} />

      <div className={panelStyles.divider} />

      {/* ── 边框 + 圆角 ── */}
      <BorderSection el={el} />

      <div className={panelStyles.divider} />

      {/* ── 阴影 ── */}
      <ShadowSection el={el} />

      <div className={panelStyles.divider} />

      {/* ── 外观：透明度 + 毛玻璃 + 滤镜 ── */}
      <AppearanceSection el={el} />
    </div>
  )
}
