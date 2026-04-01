import { useRef, useEffect } from 'react'
import { useSlideStore } from '../../store/slideStore'
import { useEditStore } from '../../store/editStore'
import { useUiStore } from '../../store/uiStore'
import { useSlideRunner } from '../../hooks/useSlideRunner'
import { useEditManager } from '../../hooks/useEditManager'
import { useResizeObserver } from '../../hooks/useResizeObserver'
import { NavBar } from './NavBar'
import styles from './StageArea.module.css'

const SLIDE_W = 1280
const SLIDE_H = 720

// 判断点击目标是否是"交互元素"，是的话不触发翻页
function isInteractiveTarget(el: EventTarget | null): boolean {
  if (!el || !(el instanceof Element)) return false
  // 向上遍历，看是否命中交互容器或交互标签
  let cur: Element | null = el
  while (cur && cur.id !== 'slide-host') {
    const tag = cur.tagName.toUpperCase()
    // 表格、输入、按钮、链接、codebox、canvas、视频、可滚动容器
    if (
      tag === 'A' || tag === 'BUTTON' || tag === 'INPUT' ||
      tag === 'SELECT' || tag === 'TEXTAREA' || tag === 'VIDEO' ||
      tag === 'CANVAS' || tag === 'DETAILS' || tag === 'SUMMARY' ||
      (cur as HTMLElement).contentEditable === 'true' ||
      cur.getAttribute('data-codebox') != null ||
      cur.closest('table') != null ||
      (cur as HTMLElement).style?.overflow === 'auto' ||
      (cur as HTMLElement).style?.overflow === 'scroll'
    ) {
      return true
    }
    cur = cur.parentElement
  }
  return false
}

export function StageArea() {
  const containerRef = useRef<HTMLDivElement>(null) // stageCanvas
  const hostRef      = useRef<HTMLDivElement>(null)

  const overlayRef = useRef<HTMLDivElement>(null)
  const alignHRef  = useRef<HTMLDivElement>(null)
  const alignVRef  = useRef<HTMLDivElement>(null)

  const { total, setScale } = useSlideStore()
  const { mode, setMode, showToast } = useUiStore()

  const runner     = useSlideRunner(hostRef)
  const managerRef = useEditManager(hostRef, overlayRef, alignHRef, alignVRef)

  // ── 自适应缩放：containerRef 是 stageCanvas，其高度已经不含 NavBar ───────────
  const didInitRef = useRef(false)

  useResizeObserver(containerRef, ({ width, height }) => {
    const s       = Math.min(width / SLIDE_W, height / SLIDE_H)
    const clamped = Math.max(0.1, s)
    setScale(clamped)

    const host = hostRef.current
    if (!host) return

    // CSS transform 缩放：以中心点为原点，配合 CSS margin:auto 实现完美居中
    // 不用 top/left 手动计算，避免偏移
    host.style.transform       = `scale(${clamped})`
    host.style.transformOrigin = 'center center'
    host.style.left            = ''
    host.style.top             = ''

    // 第一次 resize 时初始化 runner（此时 DOM 已挂载）
    if (!didInitRef.current) {
      didInitRef.current = true
      const cfg = (window as any).__TANG_CONFIG__ ?? { totalSlides: 16, slidesDir: './slides' }
      runner.init(cfg)
    }
  })

  // ── 展示模式：点击 slide 空白区域 → 下一页 ───────────────────────────────────
  useEffect(() => {
    const host = hostRef.current
    if (!host) return

    const onClick = (e: MouseEvent) => {
      // 编辑模式下不处理
      if (useUiStore.getState().mode !== 'present') return
      // 点击交互元素（表格/codebox/按钮等）不翻页
      if (isInteractiveTarget(e.target)) return
      runner.next()
    }

    host.addEventListener('click', onClick)
    return () => host.removeEventListener('click', onClick)
  // hostRef 不会变，runner 是稳定引用
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runner])

  // ── 全局事件桥 ─────────────────────────────────────────────────────────────
  useEffect(() => {
    const onNavigate = (e: Event) =>
      runner.navigateTo((e as CustomEvent<{ index: number }>).detail.index)

    const onSave = async () => {
      const mgr = managerRef.current
      if (!mgr) return
      try { await mgr.save() }
      catch (err: unknown) { showToast('❌ 保存失败: ' + (err as Error).message, 'error') }
    }
    const onUndo = async () => {
      const mgr = managerRef.current
      if (!mgr) return
      try { await mgr.undo() }
      catch { showToast('❌ 撤销失败', 'error') }
    }
    const onApplyStyle = (e: Event) => {
      const { el, prop, val } = (e as CustomEvent).detail
      const mgr = managerRef.current
      if (!mgr) return
      if (!mgr.active) mgr.enable()
      mgr.applyStyleProp(el, prop, val)
      useEditStore.getState().setDirty(mgr.patches.length > 0)
    }

    document.addEventListener('tang:navigate',   onNavigate)
    document.addEventListener('tang:save',        onSave)
    document.addEventListener('tang:undo',        onUndo)
    document.addEventListener('tang:apply-style', onApplyStyle)
    return () => {
      document.removeEventListener('tang:navigate',   onNavigate)
      document.removeEventListener('tang:save',        onSave)
      document.removeEventListener('tang:undo',        onUndo)
      document.removeEventListener('tang:apply-style', onApplyStyle)
    }
  }, [runner, managerRef, showToast])

  // ── 键盘快捷键 ─────────────────────────────────────────────────────────────
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mgr = managerRef.current
      if (mgr?.active) {
        if (e.key === 'Escape') { mgr.disable(); return }
        if ((e.ctrlKey || e.metaKey) && e.key === 's') { e.preventDefault(); document.dispatchEvent(new CustomEvent('tang:save')); return }
        if ((e.ctrlKey || e.metaKey) && e.key === 'z') { e.preventDefault(); document.dispatchEvent(new CustomEvent('tang:undo')); return }
        return
      }
      if (e.key === 'ArrowRight' || e.key === ' ') { e.preventDefault(); runner.next() }
      if (e.key === 'ArrowLeft')  { e.preventDefault(); runner.prev() }
      if (e.key === 'Home')        runner.navigateTo(0)
      if (e.key === 'End')         runner.navigateTo(total - 1)
      if (e.key === 'e' || e.key === 'E') setMode(useUiStore.getState().mode === 'edit' ? 'present' : 'edit')
      if (e.key === 'f' || e.key === 'F') document.documentElement.requestFullscreen?.()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [runner, managerRef, total, setMode])

  // ── 触摸翻页 ───────────────────────────────────────────────────────────────
  useEffect(() => {
    let sx = 0
    const onStart = (e: TouchEvent) => { sx = e.touches[0]?.clientX ?? 0 }
    const onEnd   = (e: TouchEvent) => {
      if (managerRef.current?.active) return
      if (useUiStore.getState().mode !== 'present') return
      const dx = sx - (e.changedTouches[0]?.clientX ?? 0)
      if (Math.abs(dx) > 50) dx > 0 ? runner.next() : runner.prev()
    }
    document.addEventListener('touchstart', onStart, { passive: true })
    document.addEventListener('touchend',   onEnd)
    return () => { document.removeEventListener('touchstart', onStart); document.removeEventListener('touchend', onEnd) }
  }, [runner, managerRef])

  // ── Vite HMR ───────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!import.meta.hot) return
    import.meta.hot.on('tang-slide-update', ({ file }: { file: string }) => {
      const m = file.match(/slide-(\d+)\.html$/)
      if (!m) return
      const idx = parseInt(m[1], 10) - 1
      if (idx === runner.currentRef.current) {
        runner.navigateTo(idx, { instant: true }).then(() => showToast('🔥 已热更新', 'info'))
      }
    })
  }, [runner, showToast])

  // ── 编辑模式切换（mode 变化时重新算缩放）
  useEffect(() => {
    const mgr = managerRef.current
    if (!mgr) return
    if (mode === 'edit') {
      if (!mgr.active) mgr.enable()
    } else {
      if (mgr.active) mgr.disable()
    }

    // mode 切换时重新算缩放
    const canvas = containerRef.current
    const host   = hostRef.current
    if (!canvas || !host) return
    const width  = canvas.offsetWidth
    const height = canvas.offsetHeight
    if (!width || !height) return
    const clamped = Math.max(0.1, Math.min(width / SLIDE_W, height / SLIDE_H))
    setScale(clamped)
    host.style.transform       = `scale(${clamped})`
    host.style.transformOrigin = 'center center'
    host.style.left            = ''
    host.style.top             = ''
  }, [mode, managerRef, setScale])

  return (
    <div className={styles.stageArea}>
      {/* stageCanvas = 去掉 NavBar 后的可用区域，slide-host 在其中绝对定位居中 */}
      <div ref={containerRef} className={styles.stageCanvas}>
        <div ref={hostRef} id="slide-host" />
      </div>

      <div ref={overlayRef} id="selection-overlay" data-label="" className={styles.selectionOverlay} />
      <div ref={alignHRef} id="align-h" className={`${styles.alignGuide} ${styles.alignH}`} />
      <div ref={alignVRef} id="align-v" className={`${styles.alignGuide} ${styles.alignV}`} />

      <NavBar runner={runner} />
    </div>
  )
}
