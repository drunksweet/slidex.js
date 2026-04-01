import { useSlideStore } from '../../store/slideStore'
import { useUiStore } from '../../store/uiStore'
import { SlideThumbnail } from './SlideThumbnail'
import { PanelLeftClose, PanelLeftOpen, Plus } from 'lucide-react'
import styles from './SlidePanel.module.css'

export function SlidePanel() {
  const { total, current } = useSlideStore()
  const { leftPanelOpen, toggleLeftPanel } = useUiStore()

  return (
    <aside
      className={styles.panel}
      style={{ '--panel-w': leftPanelOpen ? '200px' : '40px' } as React.CSSProperties}
      data-open={leftPanelOpen}
    >
      {/* 折叠切换按钮 */}
      <div className={styles.header}>
        {leftPanelOpen && <span className={styles.title}>幻灯片</span>}
        <button className={styles.collapseBtn} onClick={toggleLeftPanel} title={leftPanelOpen ? '折叠' : '展开'}>
          {leftPanelOpen ? <PanelLeftClose size={14} /> : <PanelLeftOpen size={14} />}
        </button>
      </div>

      {leftPanelOpen && (
        <>
          {/* 缩略图列表 */}
          <div className={styles.list}>
            {Array.from({ length: total }, (_, i) => (
              <SlideThumbnail key={i} index={i} isCurrent={i === current} />
            ))}
          </div>

          {/* 新增页面（占位） */}
          <button className={styles.addBtn} title="新增幻灯片" disabled>
            <Plus size={14} />
            新增页面
          </button>
        </>
      )}
    </aside>
  )
}
