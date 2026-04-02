import { useRef, useState, useEffect } from 'react'
import {
  Monitor, Edit3, Undo2, Redo2,
  Bold, Italic, Underline, Strikethrough, Save,
  Maximize2, AlignLeft, AlignCenter, AlignRight, AlignJustify,
  Minus, Plus, Eraser, Highlighter,
} from 'lucide-react'
import { useUiStore } from '../../store/uiStore'
import { useEditStore } from '../../store/editStore'
import { useStyleApply } from '../../hooks/useStyleApply'
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

      {/* 右区：保存 / 放弃 / 全屏 */}
      <div className={styles.right}>
        {isEdit && (
          <>
            <button
              className={`${styles.actionBtn} ${isDirty ? styles.dirty : ''}`}
              title="保存 (Ctrl+S)"
              onClick={() => document.dispatchEvent(new CustomEvent('tang:save'))}
            >
              <Save size={14} />
              {isDirty ? '保存 ●' : '已保存'}
            </button>
            <button
              className={styles.discardBtn}
              title="放弃修改"
              onClick={() => document.dispatchEvent(new CustomEvent('tang:discard'))}
            >
              ✕ 放弃
            </button>
          </>
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

// ─── 文字样式工具组 ─────────────────────────────────────────────────────────────

const ALIGN_OPTIONS = [
  { value: 'left',    icon: AlignLeft,    title: '左对齐' },
  { value: 'center',  icon: AlignCenter,  title: '居中对齐' },
  { value: 'right',   icon: AlignRight,   title: '右对齐' },
  { value: 'justify', icon: AlignJustify, title: '两端对齐' },
] as const

// 高亮预设色
const HIGHLIGHT_PRESETS = [
  { label: '黄', color: 'rgba(255,230,0,0.55)'  },
  { label: '绿', color: 'rgba(0,230,100,0.45)'  },
  { label: '青', color: 'rgba(0,200,255,0.45)'  },
  { label: '粉', color: 'rgba(255,100,180,0.45)' },
  { label: '橙', color: 'rgba(255,160,0,0.50)'  },
]

function ToolGroup() {
  const { leafEl } = useEditStore()
  const { applyStyle, applyStyles } = useStyleApply()
  const [hlOpen, setHlOpen] = useState(false)
  const hlRef = useRef<HTMLDivElement>(null)

  // 点击浮层外关闭
  useEffect(() => {
    if (!hlOpen) return
    const handler = (e: MouseEvent) => {
      if (hlRef.current && !hlRef.current.contains(e.target as Node)) setHlOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [hlOpen])

  // 目标元素：优先 leafEl（子级样式），无则禁用所有按钮
  const target = leafEl as HTMLElement | null
  const cs = target ? window.getComputedStyle(target) : null
  const disabled = !target

  const apply = (prop: string, val: string) => {
    if (!target) return
    applyStyle(target, prop, val)
  }

  const applyMulti = (props: Record<string, string>) => {
    if (!target) return
    applyStyles(target, props)
  }

  // 状态读取
  const isBold      = cs ? parseInt(cs.fontWeight) >= 600 : false
  const isItalic    = cs?.fontStyle === 'italic'
  const hasUnder    = cs?.textDecoration?.includes('underline') ?? false
  const hasStrike   = cs?.textDecoration?.includes('line-through') ?? false
  const currentAlign = cs?.textAlign ?? 'left'
  const fontSize    = cs ? Math.round(parseFloat(cs.fontSize)) : 16

  // 上标 / 下标状态
  const isSuperscript = cs?.verticalAlign === 'super'
  const isSubscript   = cs?.verticalAlign === 'sub'

  // 字号微调
  function adjustFontSize(delta: number) {
    if (!target || !cs) return
    const cur = Math.round(parseFloat(cs.fontSize)) || 16
    const next = Math.max(8, Math.min(200, cur + delta))
    apply('font-size', `${next}px`)
  }

  // text-decoration toggle（合并 underline + line-through）
  function toggleDecoration(type: 'underline' | 'line-through') {
    if (!cs) return
    const has = cs.textDecoration.includes(type)
    const other = type === 'underline' ? 'line-through' : 'underline'
    const hasOther = cs.textDecoration.includes(other)
    if (has) {
      apply('text-decoration', hasOther ? other : 'none')
    } else {
      apply('text-decoration', hasOther ? `${other} ${type}` : type)
    }
  }

  // 上标 / 下标 toggle
  function toggleScript(type: 'super' | 'sub') {
    if (!target || !cs) return
    const isActive = cs.verticalAlign === type
    if (isActive) {
      applyMulti({ 'vertical-align': 'baseline', 'font-size': 'inherit' })
    } else {
      applyMulti({ 'vertical-align': type, 'font-size': '0.75em' })
    }
  }

  // 清除格式
  function clearFormat() {
    if (!target) return
    document.dispatchEvent(new CustomEvent('tang:clear-style', { detail: { el: target } }))
  }

  // 高亮色
  function applyHighlight(color: string) {
    if (!target) return
    apply('background-color', color)
    setHlOpen(false)
  }

  function clearHighlight() {
    if (!target) return
    apply('background-color', '')
    setHlOpen(false)
  }

  return (
    <div className={styles.toolbarWrap}>
      {/* ── 格式装饰：B I U S ── */}
      <div className={styles.toolGroup}>
        <button
          className={`${styles.toolBtn} ${isBold ? styles.toolActive : ''}`}
          title="粗体 (Ctrl+B)" disabled={disabled}
          onClick={() => apply('font-weight', isBold ? 'normal' : 'bold')}
        ><Bold size={14} /></button>
        <button
          className={`${styles.toolBtn} ${isItalic ? styles.toolActive : ''}`}
          title="斜体 (Ctrl+I)" disabled={disabled}
          onClick={() => apply('font-style', isItalic ? 'normal' : 'italic')}
        ><Italic size={14} /></button>
        <button
          className={`${styles.toolBtn} ${hasUnder ? styles.toolActive : ''}`}
          title="下划线" disabled={disabled}
          onClick={() => toggleDecoration('underline')}
        ><Underline size={14} /></button>
        <button
          className={`${styles.toolBtn} ${hasStrike ? styles.toolActive : ''}`}
          title="删除线" disabled={disabled}
          onClick={() => toggleDecoration('line-through')}
        ><Strikethrough size={14} /></button>
      </div>

      <div className={styles.toolSep} />

      {/* ── 上标 / 下标 ── */}
      <div className={styles.toolGroup}>
        <button
          className={`${styles.toolBtn} ${isSuperscript ? styles.toolActive : ''}`}
          title="上标" disabled={disabled}
          onClick={() => toggleScript('super')}
        >
          <span className={styles.scriptBtn}>X<sup>²</sup></span>
        </button>
        <button
          className={`${styles.toolBtn} ${isSubscript ? styles.toolActive : ''}`}
          title="下标" disabled={disabled}
          onClick={() => toggleScript('sub')}
        >
          <span className={styles.scriptBtn}>X<sub>₂</sub></span>
        </button>
      </div>

      <div className={styles.toolSep} />

      {/* ── 高亮色 + 清除格式 ── */}
      <div className={styles.toolGroup}>
        {/* 高亮色按钮 */}
        <div className={styles.hlWrap} ref={hlRef}>
          <button
            className={`${styles.toolBtn} ${styles.hlBtn}`}
            title="文字高亮色" disabled={disabled}
            onClick={() => setHlOpen(v => !v)}
          >
            <Highlighter size={13} />
            <span className={styles.hlArrow}>▾</span>
          </button>
          {hlOpen && (
            <div className={styles.hlPopover}>
              {HIGHLIGHT_PRESETS.map(p => (
                <button
                  key={p.color}
                  className={styles.hlSwatch}
                  style={{ background: p.color }}
                  title={p.label}
                  onClick={() => applyHighlight(p.color)}
                />
              ))}
              <div className={styles.hlDivider} />
              <label className={styles.hlCustom} title="自定义颜色">
                <input type="color" style={{ opacity: 0, position: 'absolute', width: 0 }}
                  onChange={e => applyHighlight(e.target.value)}
                />
                🎨
              </label>
              <button className={styles.hlClearBtn} onClick={clearHighlight} title="清除高亮">✕</button>
            </div>
          )}
        </div>

        {/* 清除格式 */}
        <button
          className={styles.toolBtn}
          title="清除格式" disabled={disabled}
          onClick={clearFormat}
        ><Eraser size={13} /></button>
      </div>

      <div className={styles.toolSep} />

      {/* ── 文字对齐 × 4 ── */}
      <div className={styles.toolGroup}>
        {ALIGN_OPTIONS.map(({ value, icon: Icon, title }) => (
          <button
            key={value}
            className={`${styles.toolBtn} ${currentAlign === value ? styles.toolActive : ''}`}
            title={title} disabled={disabled}
            onClick={() => apply('text-align', value)}
          ><Icon size={14} /></button>
        ))}
      </div>

      <div className={styles.toolSep} />

      {/* ── 字号微调 ── */}
      <div className={styles.toolGroup}>
        <button
          className={styles.toolBtn}
          title="缩小字号 (-2px)" disabled={disabled}
          onClick={() => adjustFontSize(-2)}
        ><Minus size={12} /></button>
        <span className={`${styles.fontSizeDisplay} ${disabled ? styles.fontSizeDisabled : ''}`}>
          {fontSize}
        </span>
        <button
          className={styles.toolBtn}
          title="放大字号 (+2px)" disabled={disabled}
          onClick={() => adjustFontSize(2)}
        ><Plus size={12} /></button>
      </div>

      <div className={styles.toolSep} />

      {/* ── 撤销 / 重做 ── */}
      <div className={styles.toolGroup}>
        <button className={styles.toolBtn} title="撤销 (Ctrl+Z)"
          onClick={() => document.dispatchEvent(new CustomEvent('tang:undo'))}
        ><Undo2 size={14} /></button>
        <button className={styles.toolBtn} title="重做 (Ctrl+Y)" disabled>
          <Redo2 size={14} />
        </button>
      </div>
    </div>
  )
}
