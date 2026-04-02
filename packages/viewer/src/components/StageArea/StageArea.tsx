import { useRef, useEffect } from 'react'
import { useSlideStore } from '../../store/slideStore'
import { useEditStore } from '../../store/editStore'
import { useUiStore } from '../../store/uiStore'
import { useSlideRunner } from '../../hooks/useSlideRunner'
import { useEditManager } from '../../hooks/useEditManager'
import { useResizeObserver } from '../../hooks/useResizeObserver'
import { useAnimationController } from '../../hooks/useAnimationController'
import { AnimCtrlContext } from './AnimCtrlContext'
import { NavBar } from './NavBar'
import { SelectionBox } from './SelectionBox'
import type { SelectionBoxHandle } from './SelectionBox'
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

  const selBoxRef  = useRef<SelectionBoxHandle>(null)
  const alignHRef  = useRef<HTMLDivElement>(null)
  const alignVRef  = useRef<HTMLDivElement>(null)

  const { total, setScale } = useSlideStore()
  const { mode, setMode, showToast } = useUiStore()

  // 动画控制器（稳定引用，不随重渲染变化）
  const animCtrl   = useAnimationController()
  const runner     = useSlideRunner(hostRef, animCtrl)
  const managerRef = useEditManager(hostRef, selBoxRef, alignHRef, alignVRef)

  // ── 自适应缩放：containerRef 是 stageCanvas，其高度已经不含 NavBar ─────────
  const didInitRef = useRef(false)

  useResizeObserver(containerRef, ({ width, height }) => {
    const s       = Math.min(width / SLIDE_W, height / SLIDE_H)
    const clamped = Math.max(0.1, s)
    setScale(clamped)

    const host = hostRef.current
    if (!host) return

    // CSS transform 缩放：以中心点为原点，配合 CSS margin:auto 实现完美居中
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

  // ── 演示模式：点击 / 键盘 / 触摸 → 步骤动画或翻页 ──────────────────────────
  // 点击：挂在 document（不是 host），避免 hostRef 时机问题
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (useUiStore.getState().mode !== 'present') return
      const host = hostRef.current
      if (!host || !host.contains(e.target as Node)) return
      if (isInteractiveTarget(e.target)) return
      // 先尝试推进步骤，步骤全完成后再翻页
      if (animCtrl.advance() === 'done') runner.next()
    }
    document.addEventListener('click', onClick)
    return () => document.removeEventListener('click', onClick)
  // animCtrl 和 runner 都是稳定引用
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── 全局事件桥 ────────────────────────────────────────────────────────────
  useEffect(() => {
    const onNavigate = (e: Event) =>
      runner.navigateTo((e as CustomEvent<{ index: number }>).detail.index)

    const onSave = async () => {
      const mgr = managerRef.current
      if (!mgr) return
      try {
        await mgr.save()
        useEditStore.getState().setDirty(mgr.patches.length > 0)
      }
      catch (err: unknown) { showToast('❌ 保存失败: ' + (err as Error).message, 'error') }
    }
    const onUndo = async () => {
      const mgr = managerRef.current
      if (!mgr) return
      try { await mgr.undo() }
      catch { showToast('❌ 撤销失败', 'error') }
    }
    const onDiscard = () => {
      const mgr = managerRef.current
      if (!mgr) return
      // disable → 还原 DOM 快照 → 立即 enable 重新进入编辑态（留在编辑模式，只是丢弃改动）
      mgr.disable()
      mgr.enable()
      useEditStore.getState().setDirty(false)
      showToast('↩️ 已放弃改动', 'info')
    }
    const onReloadSlide = (e: Event) => {
      // undo 后重新加载当前 slide（文件已被还原）
      const idx = (e as CustomEvent<{ index: number }>).detail?.index
        ?? runner.currentRef.current
      runner.navigateTo(idx, { instant: true })
    }
    const onApplyStyle = (e: Event) => {
      const { el, prop, val } = (e as CustomEvent).detail
      const mgr = managerRef.current
      if (!mgr) return
      if (!mgr.active) mgr.enable()
      // data-* 属性走 attr-set patch；CSS 属性走 style-prop patch
      if (prop.startsWith('data-')) {
        mgr.applyAttr(el, prop, val)
      } else {
        mgr.applyStyleProp(el, prop, val)
      }
      useEditStore.getState().setDirty(mgr.patches.length > 0)
    }

    const onClearStyle = (e: Event) => {
      const { el } = (e as CustomEvent).detail
      const mgr = managerRef.current
      if (!mgr) return
      if (!mgr.active) mgr.enable()
      mgr.clearStyle(el)
      useEditStore.getState().setDirty(mgr.patches.length > 0)
    }

    document.addEventListener('tang:navigate',     onNavigate)
    document.addEventListener('tang:save',          onSave)
    document.addEventListener('tang:undo',          onUndo)
    document.addEventListener('tang:discard',       onDiscard)
    document.addEventListener('tang:reload-slide',  onReloadSlide)
    document.addEventListener('tang:apply-style',   onApplyStyle)
    document.addEventListener('tang:clear-style',   onClearStyle)
    return () => {
      document.removeEventListener('tang:navigate',     onNavigate)
      document.removeEventListener('tang:save',          onSave)
      document.removeEventListener('tang:undo',          onUndo)
      document.removeEventListener('tang:discard',       onDiscard)
      document.removeEventListener('tang:reload-slide',  onReloadSlide)
      document.removeEventListener('tang:apply-style',   onApplyStyle)
      document.removeEventListener('tang:clear-style',   onClearStyle)
    }
  }, [runner, managerRef, showToast])

  // ── 键盘快捷键 ────────────────────────────────────────────────────────────
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mgr = managerRef.current
      if (mgr?.active) {
        // 编辑模式内：Escape → 放弃改动并留在编辑模式
        if (e.key === 'Escape') {
          const mgr2 = managerRef.current
          if (mgr2) { mgr2.disable(); mgr2.enable(); useEditStore.getState().setDirty(false) }
          return
        }
        if ((e.ctrlKey || e.metaKey) && e.key === 's') { e.preventDefault(); document.dispatchEvent(new CustomEvent('tang:save')); return }
        if ((e.ctrlKey || e.metaKey) && e.key === 'z') { e.preventDefault(); document.dispatchEvent(new CustomEvent('tang:undo')); return }
        return
      }
      // 演示模式：→/Space 推进步骤，← 回退步骤
      if (e.key === 'ArrowRight' || e.key === ' ') {
        e.preventDefault()
        if (animCtrl.advance() === 'done') runner.next()
      }
      if (e.key === 'ArrowLeft') {
        e.preventDefault()
        if (animCtrl.retreat() === 'at-start') runner.prev()
      }
      if (e.key === 'Home') runner.navigateTo(0)
      if (e.key === 'End')  runner.navigateTo(total - 1)
      if (e.key === 'e' || e.key === 'E') setMode(useUiStore.getState().mode === 'edit' ? 'present' : 'edit')
      if (e.key === 'f' || e.key === 'F') document.documentElement.requestFullscreen?.()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runner, managerRef, total, setMode])

  // ── 触摸翻页 ──────────────────────────────────────────────────────────────
  useEffect(() => {
    let sx = 0
    const onStart = (e: TouchEvent) => { sx = e.touches[0]?.clientX ?? 0 }
    const onEnd   = (e: TouchEvent) => {
      if (managerRef.current?.active) return
      if (useUiStore.getState().mode !== 'present') return
      const dx = sx - (e.changedTouches[0]?.clientX ?? 0)
      if (Math.abs(dx) > 50) {
        if (dx > 0) {
          if (animCtrl.advance() === 'done') runner.next()
        } else {
          if (animCtrl.retreat() === 'at-start') runner.prev()
        }
      }
    }
    document.addEventListener('touchstart', onStart, { passive: true })
    document.addEventListener('touchend',   onEnd)
    return () => {
      document.removeEventListener('touchstart', onStart)
      document.removeEventListener('touchend',   onEnd)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runner, managerRef])

  // ── Vite HMR ──────────────────────────────────────────────────────────────
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

  // ── 编辑/演示 模式切换 ────────────────────────────────────────────────────
  // mode 是唯一真相源，只在这里 enable/disable mgr
  useEffect(() => {
    const mgr = managerRef.current
    if (!mgr) return

    if (mode === 'edit') {
      if (!mgr.active) mgr.enable()
      // 编辑模式：立即显示所有步骤元素（让用户可以选中并配置）
      animCtrl.revealAll()
    } else {
      // 退出编辑：先 disable mgr（还原 DOM 快照）
      if (mgr.active) mgr.disable()
      // 等 DOM 还原完成后，重新初始化步骤动画（从 step=0 开始）
      setTimeout(() => {
        const host    = hostRef.current
        const slideEl = host?.querySelector<HTMLElement>('.slide')
        animCtrl.dispose()
        animCtrl.init(slideEl ?? null)
      }, 0)
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, managerRef, setScale])

  return (
    <AnimCtrlContext.Provider value={animCtrl}>
      <div className={styles.stageArea}>
        {/* stageCanvas = 去掉 NavBar 后的可用区域，slide-host 在其中绝对定位居中 */}
        <div ref={containerRef} className={styles.stageCanvas}>
          <div ref={hostRef} id="slide-host" />
        </div>

        <SelectionBox
          ref={selBoxRef}
          managerRef={managerRef}
          onDragMove={(el) => {
            // 同步更新辅助线
            const stageEl = hostRef.current
            if (!stageEl || !alignHRef.current || !alignVRef.current) return
            const rect     = el.getBoundingClientRect()
            const hostRect = stageEl.getBoundingClientRect()
            const cx = rect.left + rect.width  / 2
            const cy = rect.top  + rect.height / 2
            const hx = hostRect.left + hostRect.width  / 2
            const hy = hostRect.top  + hostRect.height / 2
            const snap = 10 / useSlideStore.getState().scale
            if (Math.abs(cy - hy) < snap) {
              alignHRef.current.style.cssText = `display:block;top:${hy}px;`
            } else {
              alignHRef.current.style.display = 'none'
            }
            if (Math.abs(cx - hx) < snap) {
              alignVRef.current.style.cssText = `display:block;left:${hx}px;`
            } else {
              alignVRef.current.style.display = 'none'
            }
          }}
          onDragEnd={() => {
            if (alignHRef.current) alignHRef.current.style.display = 'none'
            if (alignVRef.current) alignVRef.current.style.display = 'none'
          }}
        />
        <div ref={alignHRef} id="align-h" className={`${styles.alignGuide} ${styles.alignH}`} />
        <div ref={alignVRef} id="align-v" className={`${styles.alignGuide} ${styles.alignV}`} />

        <NavBar runner={runner} />
      </div>
    </AnimCtrlContext.Provider>
  )
}
