import {
  Monitor, Edit3, Undo2, Redo2,
  Bold, Italic, Underline, Save,
  Maximize2,
} from 'lucide-react'
import { useUiStore } from '../../store/uiStore'
import { useEditStore } from '../../store/editStore'
import styles from './TopBar.module.css'

export function TopBar() {
  const { mode, setMode } = useUiStore()
  const { isDirty } = useEditStore()

  const isEdit = mode === 'edit'

  return (
    <header className={styles.topbar} data-mode={mode}>
      {/* 左区：Logo + 模式切换 */}
      <div className={styles.left}>
        <div className={styles.logo}>
          <span className={styles.logoIcon}>🎞</span>
          <span className={styles.logoText}>tang-slidex</span>
        </div>

        <div className={styles.modeTabs}>
          <button
            className={`${styles.modeTab} ${mode === 'present' ? styles.active : ''}`}
            onClick={() => setMode('present')}
            title="演示模式 (P)"
          >
            <Monitor size={13} />
            演示
          </button>
          <button
            className={`${styles.modeTab} ${mode === 'edit' ? styles.active : ''}`}
            onClick={() => setMode('edit')}
            title="编辑模式 (E)"
          >
            <Edit3 size={13} />
            编辑
          </button>
        </div>
      </div>

      {/* 中区：编辑工具（仅编辑模式显示） */}
      {isEdit && (
        <div className={styles.center}>
          <ToolGroup />
        </div>
      )}

      {/* 右区：保存 / 全屏 */}
      <div className={styles.right}>
        {isEdit && (
          <button
            className={`${styles.actionBtn} ${isDirty ? styles.dirty : ''}`}
            title="保存 (Ctrl+S)"
            onClick={() => {
              // EditManager.save() 通过 editManager ref 调用（由 StageArea 管理）
              document.dispatchEvent(new CustomEvent('tang:save'))
            }}
          >
            <Save size={14} />
            {isDirty ? '保存 ●' : '已保存'}
          </button>
        )}
        <button
          className={styles.iconBtn}
          title="全屏 (F)"
          onClick={() => document.documentElement.requestFullscreen?.()}
        >
          <Maximize2 size={15} />
        </button>
      </div>
    </header>
  )
}

/** 文字样式工具组（编辑模式中间区） */
function ToolGroup() {
  const { selectedEl } = useEditStore()

  const applyStyle = (prop: string, val: string) => {
    if (!selectedEl) return
    document.dispatchEvent(new CustomEvent('tang:apply-style', { detail: { el: selectedEl, prop, val } }))
  }

  const cs = selectedEl ? window.getComputedStyle(selectedEl) : null

  return (
    <div className={styles.toolGroup}>
      <button
        className={`${styles.toolBtn} ${cs && parseInt(cs.fontWeight) >= 700 ? styles.toolActive : ''}`}
        title="粗体 (Ctrl+B)"
        onClick={() => applyStyle('font-weight', cs && parseInt(cs.fontWeight) >= 700 ? 'normal' : 'bold')}
        disabled={!selectedEl}
      >
        <Bold size={14} />
      </button>
      <button
        className={`${styles.toolBtn} ${cs?.fontStyle === 'italic' ? styles.toolActive : ''}`}
        title="斜体 (Ctrl+I)"
        onClick={() => applyStyle('font-style', cs?.fontStyle === 'italic' ? 'normal' : 'italic')}
        disabled={!selectedEl}
      >
        <Italic size={14} />
      </button>
      <button
        className={`${styles.toolBtn} ${cs?.textDecoration?.includes('underline') ? styles.toolActive : ''}`}
        title="下划线"
        onClick={() => applyStyle('text-decoration', cs?.textDecoration?.includes('underline') ? 'none' : 'underline')}
        disabled={!selectedEl}
      >
        <Underline size={14} />
      </button>

      <div className={styles.toolSep} />

      <button className={styles.toolBtn} title="撤销 (Ctrl+Z)" onClick={() => document.dispatchEvent(new CustomEvent('tang:undo'))}>
        <Undo2 size={14} />
      </button>
      <button className={styles.toolBtn} title="重做 (Ctrl+Y)" disabled>
        <Redo2 size={14} />
      </button>
    </div>
  )
}
