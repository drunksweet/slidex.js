import { useSlideStore } from '../../store/slideStore'
import { useEditStore } from '../../store/editStore'
import styles from './StatusBar.module.css'

export function StatusBar() {
  const { scale, current, total } = useSlideStore()
  const { isDirty } = useEditStore()

  return (
    <footer className={styles.bar}>
      <span>第 {current + 1} / {total} 页</span>
      <span className={styles.sep}>·</span>
      <span>缩放 {Math.round(scale * 100)}%</span>
      {isDirty && (
        <>
          <span className={styles.sep}>·</span>
          <span className={styles.dirty}>● 未保存修改</span>
        </>
      )}
      <div className={styles.spacer} />
      <span className={styles.hint}>Ctrl+S 保存 · Ctrl+Z 撤销 · E 编辑 · F 全屏</span>
    </footer>
  )
}
