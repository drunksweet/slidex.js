import { ChevronLeft, ChevronRight, Play } from 'lucide-react'
import { useSlideStore } from '../../store/slideStore'
import { useUiStore } from '../../store/uiStore'
import styles from './StageArea.module.css'

interface Runner {
  next: () => void
  prev: () => void
  navigateTo: (index: number, opts?: { instant?: boolean }) => void
}

interface Props {
  runner: Runner
}

export function NavBar({ runner }: Props) {
  const { current, total } = useSlideStore()
  const { mode, setMode } = useUiStore()

  return (
    <div className={styles.navBar}>
      <button
        className={styles.navBtn}
        onClick={() => runner.prev()}
        disabled={current <= 0}
        title="上一页 (←)"
      >
        <ChevronLeft size={16} />
      </button>

      <span className={styles.pageInfo}>
        {current + 1} / {total || '…'}
      </span>

      <button
        className={styles.navBtn}
        onClick={() => runner.next()}
        disabled={current >= total - 1}
        title="下一页 (→)"
      >
        <ChevronRight size={16} />
      </button>

      <div className={styles.navSep} />

      {mode === 'edit' && (
        <button
          className={styles.presentBtn}
          onClick={() => setMode('present')}
          title="切换到演示模式"
        >
          <Play size={12} />
          演示
        </button>
      )}
      {mode === 'present' && (
        <button
          className={styles.editBtn}
          onClick={() => setMode('edit')}
          title="切换到编辑模式 (E)"
        >
          编辑
        </button>
      )}
    </div>
  )
}
