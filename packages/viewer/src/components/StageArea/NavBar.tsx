import { ChevronLeft, ChevronRight, Play } from 'lucide-react'
import { useSlideStore } from '../../store/slideStore'
import { useUiStore } from '../../store/uiStore'
import { useAnimStore } from '../../store/animStore'
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
  const { currentStep, totalSteps } = useAnimStore()

  // 演示模式 + 当前页有步骤动画时才显示步骤点
  const showStepDots  = mode === 'present' && totalSteps > 0
  // 编辑模式 + 当前页有步骤动画时显示步骤数标签
  const showStepCount = mode === 'edit' && totalSteps > 0

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

      {showStepDots && (
        <div className={styles.stepDots} title={`${currentStep} / ${totalSteps} 步`}>
          {Array.from({ length: totalSteps }, (_, i) => (
            <span
              key={i}
              className={`${styles.stepDot} ${i < currentStep ? styles.stepDotDone : ''}`}
            />
          ))}
        </div>
      )}

      {showStepCount && (
        <span className={styles.stepCount} title={`当前页有 ${totalSteps} 个步骤动画`}>
          {totalSteps} 步
        </span>
      )}

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
