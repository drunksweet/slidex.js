import { useUiStore, type RightTab } from '../../store/uiStore'
import { useEditStore } from '../../store/editStore'
import { StyleTab }   from './tabs/StyleTab'
import { LayoutTab }  from './tabs/LayoutTab'
import { AnimateTab } from './tabs/AnimateTab'
import styles from './RightPanel.module.css'

/**
 * 各元素类型支持的 Tab 集合。
 * layout 是所有元素都有的基础能力，对应「排列」Tab。
 * 其余 Tab 按元素类型按需开放。
 */
const KIND_TABS: Record<string, { id: RightTab; label: string }[]> = {
  text:    [{ id: 'style', label: '样式' }, { id: 'layout', label: '排列' }, { id: 'animate', label: '动画' }, { id: 'ai', label: 'AI 🤖' }],
  generic: [{ id: 'style', label: '样式' }, { id: 'layout', label: '排列' }, { id: 'animate', label: '动画' }, { id: 'ai', label: 'AI 🤖' }],
  image:   [{ id: 'style', label: '样式' }, { id: 'layout', label: '排列' }, { id: 'animate', label: '动画' }, { id: 'ai', label: 'AI 🤖' }],
  code:    [                                 { id: 'layout', label: '排列' }, { id: 'animate', label: '动画' }, { id: 'ai', label: 'AI 🤖' }],
  chart:   [                                 { id: 'layout', label: '排列' }, { id: 'animate', label: '动画' }, { id: 'ai', label: 'AI 🤖' }],
  table:   [{ id: 'style', label: '样式' }, { id: 'layout', label: '排列' }, { id: 'animate', label: '动画' }, { id: 'ai', label: 'AI 🤖' }],
  video:   [                                 { id: 'layout', label: '排列' },                                   { id: 'ai', label: 'AI 🤖' }],
}
const DEFAULT_TABS: { id: RightTab; label: string }[] = [
  { id: 'style', label: '样式' }, { id: 'layout', label: '排列' },
  { id: 'animate', label: '动画' }, { id: 'ai', label: 'AI 🤖' },
]

/** 元素类型 → 面板顶部标签文字 */
const KIND_LABEL: Record<string, string> = {
  text: '文本', generic: '元素', image: '图片',
  code: '代码', chart: '图表', table: '表格', video: '视频',
}

export function RightPanel() {
  const { rightTab, setRightTab } = useUiStore()
  const { selectedEl, leafEl, elementKind } = useEditStore()

  const tabs = elementKind ? (KIND_TABS[elementKind] ?? DEFAULT_TABS) : DEFAULT_TABS

  // 当元素切换导致当前 Tab 在新类型中不存在时，自动跳到第一个可用 Tab
  const activeTab = tabs.find(t => t.id === rightTab) ? rightTab : tabs[0]?.id ?? 'layout'

  return (
    <aside id="right-panel" className={styles.panel}>
      {/* 元素类型标签（有选中时显示） */}
      {elementKind && (
        <div className={styles.kindBadge}>
          {KIND_LABEL[elementKind] ?? '元素'}
        </div>
      )}

      {/* Tab 切换 */}
      <div className={styles.tabs}>
        {tabs.map((t) => (
          <button
            key={t.id}
            className={`${styles.tab} ${activeTab === t.id ? styles.active : ''}`}
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
        {selectedEl && activeTab === 'style'   && <StyleTab  key={(leafEl ?? selectedEl) as unknown as string} el={leafEl ?? selectedEl} />}
        {selectedEl && activeTab === 'layout'  && <LayoutTab key={selectedEl as unknown as string} el={selectedEl} />}
        {            activeTab === 'animate'   && <AnimateTab />}
        {(activeTab === 'ai') && (
          <p className={styles.comingSoon}>即将推出 🚧</p>
        )}
      </div>
    </aside>
  )
}
