import { useEffect, useRef } from 'react'
import { useUiStore } from '../../store/uiStore'
import styles from './Toast.module.css'

export function Toast() {
  const { toastMsg, toastType, hideToast } = useUiStore()
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  useEffect(() => {
    if (!toastMsg) return
    clearTimeout(timerRef.current)
    timerRef.current = setTimeout(hideToast, 2800)
    return () => clearTimeout(timerRef.current)
  }, [toastMsg, hideToast])

  if (!toastMsg) return null

  return (
    <div className={`${styles.toast} ${styles[toastType]}`}>
      {toastMsg}
    </div>
  )
}
