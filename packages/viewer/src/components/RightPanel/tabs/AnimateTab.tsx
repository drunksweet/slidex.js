/**
 * AnimateTab — 动画配置面板（编辑模式右侧 Tab）
 *
 * UX 逻辑：
 *   - 无选中元素  → 显示"页面入场动画"配置（整页入场效果、时长、缓动、开关）
 *   - 有选中元素  → 显示"元素步骤动画"配置（data-step 系列属性）
 *
 * 页面动画类型存储在 .slide[data-load-animation] 上，
 * useSlideRunner 在 _runLoad 时如果检测到此属性会优先用预设效果，
 * 否则使用 tang.onLoad 脚本的自定义动画。
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { useEditStore } from '../../../store/editStore'
import { getPreset, parseAnimAttrs, parseAnimBindings, type AnimBinding } from '../../../utils/animPresets'
import panelStyles from '../RightPanel.module.css'
import styles from './AnimateTab.module.css'

// ── 常量 ──────────────────────────────────────────────────────────────────────

const ANIMATION_OPTIONS = [
  { value: 'none',        label: '无效果（直接显示）' },
  { value: 'fade',        label: '淡化' },
  { value: 'fade-up',     label: '向上淡化' },
  { value: 'fade-down',   label: '向下淡化' },
  { value: 'fade-left',   label: '淡化 ← 自右' },
  { value: 'fade-right',  label: '淡化 → 自左' },
  { value: 'zoom-in',     label: '缩放（由小变大）' },
  { value: 'zoom-out',    label: '放大（由大变小）' },
  { value: 'slide-up',    label: '滑动 ↑ 自下' },
  { value: 'slide-right', label: '滑动 → 自左' },
]

/** 出场动画选项（gsap.to 将元素往目标状态运动） */
const EXIT_ANIMATION_OPTIONS = [
  { value: 'none',        label: '无（直接隐藏）' },
  { value: 'fade',        label: '淡出' },
  { value: 'fade-up',     label: '向上淡出' },
  { value: 'fade-down',   label: '向下淡出' },
  { value: 'fade-left',   label: '淡出 ←' },
  { value: 'fade-right',  label: '淡出 →' },
  { value: 'zoom-in',     label: '缩小消失' },
  { value: 'zoom-out',    label: '放大消失' },
  { value: 'slide-up',    label: '向上滑出' },
  { value: 'slide-right', label: '向右滑出' },
]

const EASE_OPTIONS = [
  { value: 'power2.out',         label: 'Power2（推荐）' },
  { value: 'power1.out',         label: 'Power1（轻缓）' },
  { value: 'power3.out',         label: 'Power3（有力）' },
  { value: 'back.out(1.2)',       label: 'Back（弹性）' },
  { value: 'elastic.out(1,0.5)', label: 'Elastic（弹跳）' },
  { value: 'linear',             label: 'Linear（线性）' },
]

/** 派发 tang:apply-style 事件（走 mgr.applyAttr / applyStyleProp patch）*/
function applyAttr(el: Element, prop: string, val: string) {
  document.dispatchEvent(new CustomEvent('tang:apply-style', { detail: { el, prop, val } }))
}

/** 移除属性（传 '' 表示删除）*/
function removeAttr(el: Element, prop: string) {
  applyAttr(el, prop, '')
}

/** 获取当前 .slide 元素 */
function getSlideEl(): HTMLElement | null {
  return document.querySelector<HTMLElement>('#slide-host .slide')
}

/** 检测 tang.onLoad 是否注册了回调 */
function hasLoadAnim(): boolean {
  const tang = (window as any).tang
  if (!tang || typeof tang._hasLoadAnim !== 'function') return false
  return tang._hasLoadAnim()
}

/** 从 DOM 实时扫描当前页步骤结构（兼容新格式 data-step-N 和旧格式 data-step） */
interface StepEntry {
  step: number
  els: HTMLElement[]
}
function scanSteps(): StepEntry[] {
  const slideEl = getSlideEl()
  if (!slideEl) return []
  const map = new Map<number, HTMLElement[]>()

  const addEl = (el: HTMLElement, step: number) => {
    if (isNaN(step) || step <= 0) return
    if (!map.has(step)) map.set(step, [])
    // 同一元素可能有多个绑定，按步骤分别加入
    const arr = map.get(step)!
    if (!arr.includes(el)) arr.push(el)
  }

  // 旧格式：data-step
  slideEl.querySelectorAll<HTMLElement>('[data-step]').forEach(el => {
    addEl(el, parseInt(el.dataset.step ?? '0'))
  })
  // 新格式：data-step-1 .. data-step-9
  for (let i = 1; i <= 9; i++) {
    slideEl.querySelectorAll<HTMLElement>(`[data-step-${i}]`).forEach(el => {
      addEl(el, parseInt(el.dataset[`step-${i}`] ?? '0'))
    })
  }

  return Array.from(map.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([step, els]) => ({ step, els }))
}

/** 获取元素的可读标签（tag + class / id / data-name） */
function getElLabel(el: HTMLElement): string {
  const tag = el.tagName.toLowerCase()
  if (el.dataset.name) return `${tag}[${el.dataset.name}]`
  if (el.id) return `#${el.id}`
  const cls = [...el.classList].filter(c => !c.startsWith('tang-')).slice(0, 2).join('.')
  return cls ? `${tag}.${cls}` : tag
}

/**
 * 批量修改步骤编号（兼容新旧格式）
 * delta = +1 插入，-1 删除；affectedFrom = 从此步骤（含）开始重排
 */
function shiftSteps(affectedFrom: number, delta: number) {
  const slideEl = getSlideEl()
  if (!slideEl) return

  type Change = { el: HTMLElement; attr: string; newVal: string }
  const changes: Change[] = []

  // 旧格式
  slideEl.querySelectorAll<HTMLElement>('[data-step]').forEach(el => {
    const n = parseInt(el.dataset.step ?? '0')
    if (!isNaN(n) && n >= affectedFrom) {
      changes.push({ el, attr: 'data-step', newVal: String(n + delta) })
    }
  })
  // 新格式
  for (let i = 1; i <= 9; i++) {
    slideEl.querySelectorAll<HTMLElement>(`[data-step-${i}]`).forEach(el => {
      const n = parseInt(el.dataset[`step-${i}`] ?? '0')
      if (!isNaN(n) && n >= affectedFrom) {
        changes.push({ el, attr: `data-step-${i}`, newVal: String(n + delta) })
      }
    })
  }

  for (const { el, attr, newVal } of changes) {
    applyAttr(el, attr, newVal)
  }
}

// ── 工具：解析当前操作目标元素 ───────────────────────────────────────────────

/**
 * 解析当前应操作的元素：
 *   1. leafEl 本身有 data-step → 直接用 leafEl
 *   2. selectedEl(blockEl) 本身有 data-step → 用 blockEl
 *   3. 两者都没有 data-step，但 blockEl 内部有 [data-step] 子元素：
 *        如果所有子元素 step 相同 → 返回第一个（单一展示）
 *        如果子元素 step 不同 → 返回 null（面板提示完善情况）
 *   4. 优先用 leaf ，如果没有则用 block
 */
/** 判断元素是否有任何步骤绑定（新格式 data-step-N 或旧格式 data-step） */
function hasAnyStepAttr(el: HTMLElement): boolean {
  if (el.dataset.step !== undefined) return true
  for (let i = 1; i <= 9; i++) {
    if (el.dataset[`step-${i}`] !== undefined) return true
  }
  return false
}

/** 取元素第一个步骤号（用于 resolveAnimEl 中判断 steps.size） */
function getFirstStepVal(el: HTMLElement): string {
  if (el.dataset['step-1'] !== undefined) return el.dataset['step-1']!
  return el.dataset.step ?? ''
}

function resolveAnimEl(
  selectedEl: Element | null,
  rawLeafEl:  Element | null,
): { el: HTMLElement | null; multiStep: boolean } {
  const leaf  = rawLeafEl  as HTMLElement | null
  const block = selectedEl as HTMLElement | null
  if (!block) return { el: null, multiStep: false }

  // leafEl 自身有步骤绑定 → 直接用
  if (leaf && leaf !== block && hasAnyStepAttr(leaf)) {
    return { el: leaf, multiStep: false }
  }
  // blockEl 自身有步骤绑定 → 直接用
  if (hasAnyStepAttr(block)) {
    return { el: block, multiStep: false }
  }

  // block 内部扫描（兼容新旧格式）
  const selector = '[data-step],' + Array.from({length: 9}, (_, i) => `[data-step-${i+1}]`).join(',')
  const children = Array.from(block.querySelectorAll<HTMLElement>(selector))
  if (children.length === 0) {
    return { el: leaf ?? block, multiStep: false }
  }
  const steps = new Set(children.map(c => getFirstStepVal(c)))
  if (steps.size === 1) {
    return { el: children[0], multiStep: false }
  }
  return { el: block, multiStep: true }
}

// ── 主组件 ────────────────────────────────────────────────────────────────────

export function AnimateTab() {
  const { selectedEl, leafEl: rawLeafEl } = useEditStore()

  // ── 监听 tang:apply-style 强制重渲染（applyAttr 只改 DOM，不触发 React 更新） ──
  const [, setVersion] = useState(0)
  useEffect(() => {
    const onAttrChange = () => setVersion(v => v + 1)
    document.addEventListener('tang:apply-style', onAttrChange)
    return () => document.removeEventListener('tang:apply-style', onAttrChange)
  }, [])

  const { el: resolvedEl, multiStep } = resolveAnimEl(selectedEl, rawLeafEl)
  const el    = resolvedEl
  const hasEl = !!selectedEl
  const slideEl = getSlideEl()

  // ── 解析该元素上所有绑定（实时读 DOM） ──────────────────────────────────────
  const bindings = el ? parseAnimBindings(el) : []
  const hasBindings = bindings.length > 0

  // ── 最大步骤数 ───────────────────────────────────────────────────────────────
  const maxStep = (() => {
    const sEl = getSlideEl()
    if (!sEl) return 0
    let max = 0
    const check = (n: number) => { if (!isNaN(n) && n > max) max = n }
    // 旧格式
    sEl.querySelectorAll<HTMLElement>('[data-step]').forEach(el => check(parseInt(el.dataset.step ?? '0')))
    // 新格式 data-step-N → dataset['step-N']
    for (let i = 1; i <= 9; i++) {
      sEl.querySelectorAll<HTMLElement>(`[data-step-${i}]`).forEach(el => {
        check(parseInt(el.dataset[`step-${i}`] ?? '0'))
      })
    }
    return max
  })()

  // ── 页面级动画属性 ────────────────────────────────────────────────────────
  const loadExists   = hasLoadAnim()
  const loadDisabled = slideEl?.dataset?.disableLoadAnim === 'true'
  const loadAnim     = slideEl?.dataset?.loadAnimation  ?? ''
  const loadDuration = slideEl?.dataset?.loadDuration   ?? '600'
  const loadEase     = slideEl?.dataset?.loadEase       ?? 'power2.out'
  const loadManaged  = loadAnim !== ''

  // ── 添加绑定 ─────────────────────────────────────────────────────────────
  const handleAddBinding = useCallback(() => {
    if (!el) return
    // 找下一个空缺的 index（从 1 开始连续扫）
    let nextIdx = 1
    for (let i = 1; i <= 10; i++) {
      const stepKey = `step-${i}`
      const hasSlot = i === 1
        ? (el.dataset[stepKey] !== undefined || el.dataset.step !== undefined)
        : el.dataset[stepKey] !== undefined
      if (!hasSlot) { nextIdx = i; break }
      if (i === 10) { nextIdx = 11; break } // 超出上限
    }
    if (nextIdx > 10) return
    const newStep = maxStep + 1
    applyAttr(el, `data-step-${nextIdx}`, String(newStep))
    applyAttr(el, `data-animation-${nextIdx}`, 'fade-up')
    // 第二个及之后的绑定默认方向 out（已有入场，新增的通常是出场）
    if (nextIdx > 1) {
      applyAttr(el, `data-direction-${nextIdx}`, 'out')
    }
  }, [el, maxStep])

  // ── 删除某个绑定 ──────────────────────────────────────────────────────────
  const handleDeleteBinding = useCallback((idx: number) => {
    if (!el) return
    removeAttr(el, `data-step-${idx}`)
    removeAttr(el, `data-animation-${idx}`)
    removeAttr(el, `data-duration-${idx}`)
    removeAttr(el, `data-delay-${idx}`)
    removeAttr(el, `data-ease-${idx}`)
    removeAttr(el, `data-direction-${idx}`)  // 同时清除方向属性
    // idx=1 时同时清理旧格式无后缀属性
    if (idx === 1) {
      removeAttr(el, 'data-step')
      removeAttr(el, 'data-animation')
      removeAttr(el, 'data-duration')
      removeAttr(el, 'data-delay')
      removeAttr(el, 'data-ease')
      removeAttr(el, 'data-direction')
    }
    // 若删完了，还清理共享属性
    const remaining = parseAnimBindings(el)
    if (remaining.length === 0) {
      removeAttr(el, 'data-stagger')
    }
  }, [el])

  // ── 预览单个绑定 ──────────────────────────────────────────────────────────
  const handlePreviewBinding = useCallback((binding: AnimBinding) => {
    if (!el) return
    const gsap = (window as any).gsap
    if (!gsap) return
    const preset = getPreset(binding.animation)
    gsap.killTweensOf(el)
    gsap.set(el, { clearProps: 'all' })
    if (binding.direction === 'in') {
      el.style.visibility = 'hidden'
      requestAnimationFrame(() => {
        gsap.set(el, { visibility: 'visible' })
        if (Object.keys(preset).length > 0) {
          gsap.from(el, { ...preset, duration: binding.duration, delay: binding.delay, ease: binding.ease })
        }
      })
    } else {
      el.style.visibility = 'visible'
      gsap.set(el, { clearProps: 'opacity,transform,x,y,scale' })
      if (Object.keys(preset).length > 0) {
        gsap.to(el, {
          ...preset,
          duration: binding.duration,
          delay: binding.delay,
          ease: binding.ease,
          onComplete: () => {
            el.style.visibility = 'hidden'
            gsap.set(el, { clearProps: 'opacity,transform,x,y,scale' })
          },
        })
      }
    }
  }, [el])

  // ── 页面级事件 ────────────────────────────────────────────────────────────
  const handleToggleLoadAnim = useCallback(() => {
    if (!slideEl) return
    if (loadDisabled) removeAttr(slideEl, 'data-disable-load-anim')
    else applyAttr(slideEl, 'data-disable-load-anim', 'true')
  }, [slideEl, loadDisabled])

  const handleToggleManaged = useCallback(() => {
    if (!slideEl) return
    if (loadManaged) {
      removeAttr(slideEl, 'data-load-animation')
      removeAttr(slideEl, 'data-load-duration')
      removeAttr(slideEl, 'data-load-ease')
    } else {
      applyAttr(slideEl, 'data-load-animation', 'fade-up')
    }
  }, [slideEl, loadManaged])

  // ── 自动播放 ──────────────────────────────────────────────────────────────
  const [autoPlaying, setAutoPlaying] = useState(false)
  const stopFlagRef = useRef(false)

  const handleAutoPlay = useCallback(async () => {
    if (autoPlaying) { stopFlagRef.current = true; setAutoPlaying(false); return }
    stopFlagRef.current = false
    setAutoPlaying(true)
    const gsap = (window as any).gsap
    const tang = (window as any).tang
    const sEl  = getSlideEl()
    if (!sEl) { setAutoPlaying(false); return }
    const sleep = (ms: number) => new Promise<void>(res => setTimeout(res, ms))
    if (tang?._runLoad) tang._runLoad()
    const inDur = parseInt((sEl as HTMLElement).dataset.loadDuration ?? '800')
    await sleep(inDur + 300)
    if (stopFlagRef.current) { setAutoPlaying(false); return }
    const steps = scanSteps()
    for (const { step, els } of steps) {
      if (stopFlagRef.current) break
      if (gsap) { gsap.killTweensOf(els); gsap.set(els, { clearProps: 'all' }) }
      els.forEach(el => { el.style.visibility = 'hidden' })
      await sleep(16)
      if (stopFlagRef.current) break
      if (gsap) {
        const firstAttrs = parseAnimAttrs(els[0])
        const stagger = firstAttrs.stagger
        gsap.set(els, { visibility: 'visible', clearProps: 'opacity,transform,x,y,scale' })
        if (stagger > 0) {
          const preset = getPreset(firstAttrs.animation)
          if (Object.keys(preset).length > 0) gsap.from(els, { ...preset, duration: firstAttrs.duration, delay: firstAttrs.delay, ease: firstAttrs.ease, stagger })
        } else {
          for (const el of els) {
            const { animation, duration, delay, ease } = parseAnimAttrs(el)
            const preset = getPreset(animation)
            if (Object.keys(preset).length > 0) gsap.from(el, { ...preset, duration, delay, ease })
          }
        }
        const maxDur = Math.max(...els.map(el => {
          const { duration, delay } = parseAnimAttrs(el)
          return (duration + delay) * 1000
        }))
        await sleep(maxDur + stagger * els.length * 1000 + 400)
      } else {
        els.forEach(el => { el.style.visibility = 'visible' })
        await sleep(600)
      }
      if (step !== steps[steps.length - 1].step) await sleep(200)
    }
    stopFlagRef.current = false
    setAutoPlaying(false)
  }, [autoPlaying])

  // ══════════════════════════════════════════════════════════════════════════
  // 渲染
  // ══════════════════════════════════════════════════════════════════════════

  // ── 有选中元素 → 元素多绑定配置 ──────────────────────────────────────────
  if (hasEl) {
    return (
      <div>
        {/* 块内有多个不同步骤的子元素 → 提示双击 */}
        {multiStep && !hasBindings && (
          <div className={styles.noAnim}>
            <div className={styles.noAnimIcon}>🎯</div>
            <div className={styles.noAnimText}>此块包含多个步骤元素</div>
            <div className={styles.noAnimHint}>
              双击进入子元素后即可单独编辑各自的动画配置
            </div>
          </div>
        )}

        {/* 无绑定 → 空态 + 添加入口 */}
        {!hasBindings && !multiStep && (
          <div className={styles.noAnim}>
            <div className={styles.noAnimIcon}>✨</div>
            <div className={styles.noAnimText}>当前元素无步骤动画</div>
            <div className={styles.noAnimHint}>
              添加后，演示时点击才会显示此元素
            </div>
            <button className={styles.addBtn} onClick={handleAddBinding}>
              + 添加步骤动画
            </button>
          </div>
        )}

        {/* 有绑定 → 绑定列表 */}
        {hasBindings && (
          <div style={{ padding: '8px 0' }}>
            <div className={panelStyles.section}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <div className={panelStyles.sectionTitle}>步骤动画</div>
                <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.2)' }}>
                  / {maxStep} 步
                </span>
              </div>

              {/* 绑定卡片列表 */}
              {bindings.map(binding => (
                <BindingCard
                  key={binding.index}
                  el={el!}
                  binding={binding}
                  maxStep={maxStep}
                  onDelete={() => handleDeleteBinding(binding.index)}
                  onPreview={() => handlePreviewBinding(binding)}
                />
              ))}

              {/* 添加绑定按钮 */}
              <button className={styles.addBindingBtn} onClick={handleAddBinding}>
                + 添加步骤绑定
              </button>
            </div>

            {/* 错落（共享参数，多个元素同步骤时才有意义） */}
            <div className={panelStyles.divider} />
            <div className={panelStyles.section}>
              <div className={panelStyles.sectionTitle}>错落（同步骤多元素）</div>
              <div className={panelStyles.row}>
                <span className={panelStyles.label}>间隔</span>
                <div className={panelStyles.rangeWrap}>
                  <input type="range" min={0} max={500} step={20}
                    className={panelStyles.range}
                    value={parseInt(el?.dataset?.stagger ?? '0')}
                    onChange={e => el && applyAttr(el, 'data-stagger', e.target.value)}
                  />
                </div>
                <input type="number" className={panelStyles.numInput}
                  min={0} max={500} step={20}
                  value={parseInt(el?.dataset?.stagger ?? '0')}
                  onChange={e => el && applyAttr(el, 'data-stagger', e.target.value)}
                />
                <span className={panelStyles.unit}>ms</span>
              </div>
            </div>

            <div className={panelStyles.divider} />

            {/* 全部移除 */}
            <div style={{ padding: '0 0 8px' }}>
              <button
                className={styles.removeBtn}
                style={{ width: '100%' }}
                onClick={() => {
                  if (!el) return
                  // 删除所有绑定
                  bindings.forEach(b => handleDeleteBinding(b.index))
                }}
              >
                移除所有动画
              </button>
            </div>
          </div>
        )}
      </div>
    )
  }

  // ── 无选中元素 → 页面动画 + 步骤总览 ──────────────────────────────────────
  return (
    <div>
      <div className={panelStyles.section}>
        <div className={panelStyles.sectionTitle}>页面入场动画</div>

        {!loadExists && !loadManaged ? (
          <div className={styles.pageAnimEmpty}>
            <div className={styles.pageAnimEmptyIcon}>📭</div>
            <div className={styles.pageAnimEmptyText}>当前页无入场动画</div>
            <div className={styles.pageAnimEmptyHint}>
              可在 &lt;script&gt; 中用 tang.onLoad() 添加，<br />
              或点击下方按钮使用框架预设效果
            </div>
            <button className={styles.addBtn} onClick={handleToggleManaged}>
              + 使用预设入场动画
            </button>
          </div>
        ) : (
          <div>
            <div className={panelStyles.row}>
              <span className={panelStyles.label}>状态</span>
              <div className={styles.switchRow}>
                <span className={styles.switchDot}
                  style={{ background: loadDisabled ? '#475569' : '#4ade80' }} />
                <span className={styles.switchLabel}>
                  {loadDisabled ? '已禁用' : '已启用'}
                </span>
                <button
                  className={loadDisabled ? styles.pageAnimEnableBtn : styles.pageAnimDisableBtn}
                  onClick={handleToggleLoadAnim}
                >
                  {loadDisabled ? '启用' : '禁用'}
                </button>
              </div>
            </div>
            <div className={panelStyles.row} style={{ marginTop: 6 }}>
              <span className={panelStyles.label}>控制方式</span>
              <div className={styles.switchRow} style={{ flex: 1 }}>
                <span className={styles.sourceTag} style={{
                  background: loadManaged ? 'rgba(139,92,246,0.15)' : 'rgba(59,130,246,0.12)',
                  color: loadManaged ? '#a78bfa' : '#93c5fd',
                  borderColor: loadManaged ? 'rgba(139,92,246,0.3)' : 'rgba(59,130,246,0.25)',
                }}>
                  {loadManaged ? '框架预设' : '脚本自定义'}
                </span>
                <button className={styles.switchModeBtn} onClick={handleToggleManaged}
                  title={loadManaged ? '切换回脚本' : '切换为预设'}>
                  {loadManaged ? '改用脚本' : '改用预设'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {loadManaged && (
        <>
          <div className={panelStyles.divider} />
          <div className={panelStyles.section}>
            <div className={panelStyles.sectionTitle}>入场效果</div>
            <div className={panelStyles.row}>
              <select className={panelStyles.select} value={loadAnim}
                onChange={e => slideEl && applyAttr(slideEl, 'data-load-animation', e.target.value)}>
                {ANIMATION_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
          </div>
          <div className={panelStyles.section}>
            <div className={panelStyles.sectionTitle}>时间</div>
            <div className={panelStyles.row}>
              <span className={panelStyles.label}>时长</span>
              <div className={panelStyles.rangeWrap}>
                <input type="range" min={100} max={2000} step={50} className={panelStyles.range}
                  value={parseInt(loadDuration)}
                  onChange={e => slideEl && applyAttr(slideEl, 'data-load-duration', e.target.value)} />
              </div>
              <input type="number" className={panelStyles.numInput} min={100} max={2000} step={50}
                value={parseInt(loadDuration)}
                onChange={e => slideEl && applyAttr(slideEl, 'data-load-duration', e.target.value)} />
              <span className={panelStyles.unit}>ms</span>
            </div>
          </div>
          <div className={panelStyles.section}>
            <div className={panelStyles.sectionTitle}>缓动曲线</div>
            <div className={panelStyles.row}>
              <select className={panelStyles.select} value={loadEase}
                onChange={e => slideEl && applyAttr(slideEl, 'data-load-ease', e.target.value)}>
                {EASE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
          </div>
          <div className={panelStyles.divider} />
          <div className={styles.actions}>
            <button className={styles.previewBtn} onClick={() => {
              const sEl = getSlideEl()
              const gsap = (window as any).gsap
              if (!sEl || !gsap) return
              const preset = getPreset(loadAnim)
              if (!preset || Object.keys(preset).length === 0) return
              gsap.from(sEl, { ...preset, duration: parseInt(loadDuration) / 1000, ease: loadEase })
            }}>
              ▶ 预览入场
            </button>
          </div>
        </>
      )}

      {loadExists && !loadManaged && !loadDisabled && (
        <>
          <div className={panelStyles.divider} />
          <div className={styles.scriptHint}>
            <span className={styles.scriptHintIcon}>💡</span>
            入场动画由 <code>tang.onLoad()</code> 脚本控制，切换为"框架预设"可视化配置。
          </div>
        </>
      )}

      {maxStep > 0 && (
        <>
          <div className={panelStyles.divider} />
          <div className={panelStyles.section}>
            <button
              className={`${styles.autoPlayBtn} ${autoPlaying ? styles.autoPlayBtnStop : ''}`}
              onClick={handleAutoPlay}
            >
              {autoPlaying ? '■ 停止播放' : '▶ 整页自动播放'}
            </button>
          </div>
        </>
      )}

      <StepOverview />
    </div>
  )
}

// ── 绑定卡片子组件 ─────────────────────────────────────────────────────────────

interface BindingCardProps {
  el:        HTMLElement
  binding:   AnimBinding
  maxStep:   number
  onDelete:  () => void
  onPreview: () => void
}

function BindingCard({ el, binding, maxStep, onDelete, onPreview }: BindingCardProps) {
  const idx = binding.index

  // 读绑定级属性（dataset key 格式：'animation-N'）
  const ds = el.dataset
  const animVal = ds[`animation-${idx}`] ?? (idx === 1 ? ds.animation : undefined) ?? 'fade-up'
  const durVal  = parseInt(ds[`duration-${idx}`] ?? (idx === 1 ? ds.duration : undefined) ?? '400')
  const delVal  = parseInt(ds[`delay-${idx}`]    ?? (idx === 1 ? ds.delay    : undefined) ?? '0')
  const easeVal = ds[`ease-${idx}`] ?? (idx === 1 ? ds.ease : undefined) ?? 'power2.out'

  const isIn  = binding.direction === 'in'
  const allOpts = isIn ? ANIMATION_OPTIONS : EXIT_ANIMATION_OPTIONS

  // 切换入场/出场方向
  const handleToggleDirection = () => {
    const newDir = isIn ? 'out' : 'in'
    applyAttr(el, `data-direction-${idx}`, newDir)
    // idx=1 时同时写旧格式兼容属性
    if (idx === 1) applyAttr(el, 'data-direction', newDir)
  }

  return (
    <div className={styles.bindingCard}>
      {/* 头部：步骤号 + 方向徽标（可点击切换）+ 预览 + 删除 */}
      <div className={styles.bindingHeader}>
        <span className={styles.bindingStepLabel}>步骤</span>
        <input
          type="number"
          className={styles.bindingStepInput}
          min={1}
          value={binding.step}
          onChange={e => applyAttr(el, `data-step-${idx}`, e.target.value)}
        />
        <span className={styles.bindingMaxStep}>/ {maxStep}</span>
        <button
          className={`${styles.bindingDirBadge} ${isIn ? styles.bindingDirIn : styles.bindingDirOut}`}
          onClick={handleToggleDirection}
          title={isIn ? '点击切换为出场' : '点击切换为入场'}
          style={{ cursor: 'pointer', border: 'none', padding: '2px 8px' }}
        >
          {isIn ? '入场' : '出场'}
        </button>
        <button className={styles.bindingPreviewBtn} onClick={onPreview}>▶</button>
        <button className={styles.bindingDeleteBtn} onClick={onDelete} title="删除此绑定">×</button>
      </div>

      {/* 体：动画效果 + 时长 + 延迟 + 缓动 */}
      <div className={styles.bindingBody}>
        {/* 动画效果 */}
        <div className={styles.bindingRow}>
          <span className={styles.bindingRowLabel}>效果</span>
          <select
            className={styles.bindingSelect}
            value={animVal}
            onChange={e => applyAttr(el, `data-animation-${idx}`, e.target.value)}
          >
            {allOpts.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>

        {/* 时长 */}
        <div className={styles.bindingRow}>
          <span className={styles.bindingRowLabel}>时长</span>
          <input
            type="number" className={styles.bindingNumInput}
            min={50} max={3000} step={50}
            value={durVal}
            onChange={e => applyAttr(el, `data-duration-${idx}`, e.target.value)}
          />
          <span className={styles.bindingUnit}>ms</span>
        </div>

        {/* 延迟 */}
        <div className={styles.bindingRow}>
          <span className={styles.bindingRowLabel}>延迟</span>
          <input
            type="number" className={styles.bindingNumInput}
            min={0} max={3000} step={50}
            value={delVal}
            onChange={e => applyAttr(el, `data-delay-${idx}`, e.target.value)}
          />
          <span className={styles.bindingUnit}>ms</span>
        </div>

        {/* 缓动 */}
        <div className={styles.bindingRow}>
          <span className={styles.bindingRowLabel}>缓动</span>
          <select
            className={styles.bindingSelect}
            value={easeVal}
            onChange={e => applyAttr(el, `data-ease-${idx}`, e.target.value)}
          >
            {EASE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
      </div>
    </div>
  )
}

// ── 步骤总览子组件 ────────────────────────────────────────────────────────────

function StepOverview() {
  const steps = scanSteps()
  const hasSteps = steps.length > 0

  function highlight(els: HTMLElement[]) {
    const cls = 'tang-step-highlight'
    els.forEach(el => el.classList.add(cls))
    setTimeout(() => els.forEach(el => el.classList.remove(cls)), 900)
  }

  function handleDeleteStep(step: number, els: HTMLElement[]) {
    for (const el of els) {
      // 清理旧格式
      removeAttr(el, 'data-step')
      removeAttr(el, 'data-animation')
      removeAttr(el, 'data-duration')
      removeAttr(el, 'data-delay')
      removeAttr(el, 'data-ease')
      removeAttr(el, 'data-stagger')
      // 清理新格式
      for (let i = 1; i <= 9; i++) {
        removeAttr(el, `data-step-${i}`)
        removeAttr(el, `data-animation-${i}`)
        removeAttr(el, `data-duration-${i}`)
        removeAttr(el, `data-delay-${i}`)
        removeAttr(el, `data-ease-${i}`)
      }
    }
    shiftSteps(step + 1, -1)
  }

  function handleInsertBefore(step: number) {
    shiftSteps(step, 1)
    const toast = document.createElement('div')
    toast.style.cssText = `
      position:fixed;bottom:80px;left:50%;transform:translateX(-50%);
      background:#1e1b4b;border:1px solid rgba(139,92,246,0.4);
      color:#c4b5fd;font-size:12px;padding:8px 16px;border-radius:8px;
      z-index:9999;pointer-events:none;transition:opacity 0.3s;
    `
    toast.textContent = `已腾出第 ${step} 步，选中元素后添加步骤动画即可`
    document.body.appendChild(toast)
    setTimeout(() => { toast.style.opacity = '0' }, 2000)
    setTimeout(() => toast.remove(), 2400)
  }

  return (
    <>
      <div className={panelStyles.divider} />
      <div className={panelStyles.section}>
        <div className={styles.stepOverviewHeader}>
          <div className={panelStyles.sectionTitle}>步骤总览</div>
          {hasSteps && (
            <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.25)' }}>
              共 {steps.length} 步
            </span>
          )}
        </div>

        {!hasSteps ? (
          <div className={styles.stepOverviewEmpty}>当前页暂无步骤动画</div>
        ) : (
          <div className={styles.stepOverview}>
            {steps.map(({ step, els }) => {
              const animName = ANIMATION_OPTIONS.find(
                o => o.value === (els[0].dataset['animation-1'] ?? els[0].dataset.animation ?? 'fade-up')
              )?.label ?? 'fade-up'
              const staggerMs = parseInt(els[0].dataset.stagger ?? '0')
              return (
                <div key={step} className={styles.stepRow}
                  onClick={() => highlight(els)} title="点击高亮对应元素">
                  <div className={styles.stepNum}>第 {step} 步</div>
                  <div className={styles.stepInfo}>
                    <div className={styles.stepElNames}>
                      {els.map(el => getElLabel(el)).join('  ')}
                    </div>
                    <div className={styles.stepAnimName}>
                      {animName}{staggerMs > 0 ? `  stagger ${staggerMs}ms` : ''}
                    </div>
                  </div>
                  <div className={styles.stepActions}>
                    <button className={styles.stepActionBtn}
                      onClick={e => { e.stopPropagation(); handleInsertBefore(step) }}>
                      插入
                    </button>
                    <button className={`${styles.stepActionBtn} ${styles.stepActionBtnDanger}`}
                      onClick={e => { e.stopPropagation(); handleDeleteStep(step, els) }}>
                      删除
                    </button>
                  </div>
                </div>
              )
            })}
            <div className={styles.insertStepRow}>
              <button className={styles.insertStepBtn} onClick={() => {
                const max = steps.length > 0 ? steps[steps.length - 1].step : 0
                handleInsertBefore(max + 1)
              }}>
                + 在末尾添加步骤
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  )
}

