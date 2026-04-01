import { memo } from 'react'
import { useSlideStore } from '../../store/slideStore'
import styles from './SlidePanel.module.css'

interface Props {
  index: number
  isCurrent: boolean
}

/** 单个幻灯片缩略图：iframe scale 方案 */
export const SlideThumbnail = memo(function SlideThumbnail({ index, isCurrent }: Props) {
  const setCurrent = useSlideStore((s) => s.setCurrent)

  const pad = (n: number) => String(n + 1).padStart(3, '0')
  const url = `./slides/slide-${pad(index)}.html`

  return (
    <div
      className={`${styles.thumb} ${isCurrent ? styles.current : ''}`}
      onClick={() => {
        setCurrent(index)
        document.dispatchEvent(new CustomEvent('tang:navigate', { detail: { index } }))
      }}
      title={`第 ${index + 1} 页`}
      data-index={index + 1}
    >
      <div className={styles.iframeWrap}>
        <iframe
          src={url}
          tabIndex={-1}
          scrolling="no"
          loading="lazy"
          style={{
            width: '1280px',
            height: '720px',
            transform: `scale(${160 / 1280})`,
            transformOrigin: 'top left',
            pointerEvents: 'none',
            border: 'none',
            background: '#0f172a',
          }}
        />
      </div>
      <span className={styles.pageNum}>{index + 1}</span>
    </div>
  )
})
