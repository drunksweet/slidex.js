import { useUiStore, type RightTab } from '../../store/uiStore'
import { useEditStore } from '../../store/editStore'
import { StyleTab }  from './tabs/StyleTab'
import { LayoutTab } from './tabs/LayoutTab'
import styles from './RightPanel.module.css'

const TABS: { id: RightTab; label: string }[] = [
  { id: 'style',  label: '样式' },
  { id: 'layout', label: '排列' },
  { id: 'animate', label: '动画' },
  { id: 'ai',     label: 'AI 🤖' },
]

export function RightPanel() {
  const { rightTab, setRightTab } = useUiStore()
  const { selectedEl, leafEl } = useEditStore()

  return (
    <aside id="right-panel" className={styles.panel}>
      {/* Tab 切换 */}
      <div className={styles.tabs}>
        {TABS.map((t) => (
          <button
            key={t.id}
            className={`${styles.tab} ${rightTab === t.id ? styles.active : ''}`}
            onClick={() => setRightTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab 内容 */}
      <div className={styles.content}>
        {!selectedEl && (
          <p className={styles.noSel}>点击 PPT 中的元素以查看属性</p>
        )}
        {/* StyleTab 用 leafEl（用户实际点击的节点），LayoutTab 用 selectedEl（块级元素） */}
        {selectedEl && rightTab === 'style'  && <StyleTab  key={(leafEl ?? selectedEl) as unknown as string} el={leafEl ?? selectedEl} />}
        {selectedEl && rightTab === 'layout' && <LayoutTab key={selectedEl as unknown as string} el={selectedEl} />}
        {(rightTab === 'animate' || rightTab === 'ai') && (
          <p className={styles.comingSoon}>即将推出 🚧</p>
        )}
      </div>
    </aside>
  )
}
