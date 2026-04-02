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

import { useState, useCallback } from 'react'
import { useEditStore } from '../../../store/editStore'
import { useAnimCtrl } from '../../StageArea/AnimCtrlContext'
import panelStyles from '../RightPanel.module.css'
import styles from './AnimateTab.module.css'

// ── 常量 ──────────────────────────────────────────────────────────────────────

const ANIMATION_OPTIONS = [
  { value: 'fade',        label: '淡入' },
  { value: 'fade-up',     label: '向上淡入' },
  { value: 'fade-down',   label: '向下淡入' },
  { value: 'fade-left',   label: '从右淡入（自右）' },
  { value: 'fade-right',  label: '从左淡入（自左）' },
  { value: 'zoom-in',     label: '缩小出现' },
  { value: 'zoom-out',    label: '放大出现' },
  { value: 'slide-up',    label: '从下滑入' },
  { value: 'slide-right', label: '从左滑入' },
  { value: 'none',        label: '无效果（直接显示）' },
]

const EASE_OPTIONS = [
  { value: 'power2.out',         label: 'Power2（推荐）' },
  { value: 'power1.out',         label: 'Power1（轻缓）' },
  { value: 'power3.out',         label: 'Power3（有力）' },
  { value: 'back.out(1.2)',       label: 'Back（弹性）' },
  { value: 'elastic.out(1,0.5)', label: 'Elastic（弹跳）' },
  { value: 'linear',             label: 'Linear（线性）' },
]

// ── 工具函数 ──────────────────────────────────────────────────────────────────

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

// ── 主组件 ────────────────────────────────────────────────────────────────────

export function AnimateTab() {
  const { selectedEl } = useEditStore()
  const animCtrl = useAnimCtrl()

  const [previewKey, setPreviewKey] = useState(0)

  const el        = selectedEl as HTMLElement | null
  const hasEl     = !!el
  const slideEl   = getSlideEl()

  // ── 元素步骤动画属性 ────────────────────────────────────────────────────────
  const currentStep     = el?.dataset?.step       ?? ''
  const hasStep         = currentStep !== ''
  const currentAnim     = el?.dataset?.animation  ?? 'fade-up'
  const currentDuration = el?.dataset?.duration   ?? '400'
  const currentDelay    = el?.dataset?.delay       ?? '0'
  const currentEase     = el?.dataset?.ease        ?? 'power2.out'

  const stepMap = animCtrl?.getStepMap() ?? new Map()
  const maxStep = stepMap.size > 0 ? Math.max(...stepMap.keys()) : 0

  // ── 页面级动画属性（存在 .slide 上） ────────────────────────────────────────
  const loadExists      = hasLoadAnim()
  const loadDisabled    = slideEl?.dataset?.disableLoadAnim === 'true'
  // data-load-animation：用户覆盖页面入场效果类型（当脚本动画被"管理模式"接管时）
  // 空值 = 由 tang.onLoad 脚本控制；有值 = 框架统一应用此预设（覆盖脚本）
  const loadAnim        = slideEl?.dataset?.loadAnimation  ?? ''
  const loadDuration    = slideEl?.dataset?.loadDuration   ?? '600'
  const loadEase        = slideEl?.dataset?.loadEase       ?? 'power2.out'
  // 是否处于"托管模式"：用框架预设替代脚本动画
  const loadManaged     = loadAnim !== ''

  // ── 事件：元素步骤动画 ────────────────────────────────────────────────────
  const handleAddStep = useCallback(() => {
    if (!el) return
    applyAttr(el, 'data-step',      String(maxStep + 1))
    applyAttr(el, 'data-animation', 'fade-up')
  }, [el, maxStep])

  const handleRemoveStep = useCallback(() => {
    if (!el) return
    removeAttr(el, 'data-step')
    removeAttr(el, 'data-animation')
    removeAttr(el, 'data-duration')
    removeAttr(el, 'data-delay')
    removeAttr(el, 'data-ease')
  }, [el])

  const handlePreview = useCallback(() => {
    const step = parseInt(currentStep)
    if (!animCtrl || isNaN(step)) return
    setPreviewKey(k => k + 1)
    // 直接触发预览（animCtrl.previewStep 内部有 hide→play 逻辑）
    animCtrl.previewStep(step)
  }, [animCtrl, currentStep])

  // ── 事件：页面级动画 ──────────────────────────────────────────────────────
  const handleToggleLoadAnim = useCallback(() => {
    if (!slideEl) return
    if (loadDisabled) {
      removeAttr(slideEl, 'data-disable-load-anim')
    } else {
      applyAttr(slideEl, 'data-disable-load-anim', 'true')
    }
  }, [slideEl, loadDisabled])

  // 切换托管模式（框架预设 vs 脚本控制）
  const handleToggleManaged = useCallback(() => {
    if (!slideEl) return
    if (loadManaged) {
      // 取消托管：恢复脚本控制
      removeAttr(slideEl, 'data-load-animation')
      removeAttr(slideEl, 'data-load-duration')
      removeAttr(slideEl, 'data-load-ease')
    } else {
      // 启用托管：用框架预设
      applyAttr(slideEl, 'data-load-animation', 'fade-up')
    }
  }, [slideEl, loadManaged])

  // ══════════════════════════════════════════════════════════════════════════
  // 渲染
  // ══════════════════════════════════════════════════════════════════════════

  // ── 有选中元素 → 只显示元素步骤动画区块 ──────────────────────────────────
  if (hasEl) {
    return (
      <div>
        {/* 无步骤 → 添加入口 */}
        {!hasStep && (
          <div className={styles.noAnim}>
            <div className={styles.noAnimIcon}>✨</div>
            <div className={styles.noAnimText}>当前元素无步骤动画</div>
            <div className={styles.noAnimHint}>
              添加后，演示时点击才会显示此元素
            </div>
            <button className={styles.addBtn} onClick={handleAddStep}>
              + 添加步骤动画
            </button>
          </div>
        )}

        {/* 有步骤 → 配置区 */}
        {hasStep && (
          <div>
            {/* 出现时机 */}
            <div className={panelStyles.section}>
              <div className={panelStyles.sectionTitle}>出现时机</div>
              <div className={panelStyles.row}>
                <span className={panelStyles.label}>步骤</span>
                <input
                  type="number"
                  className={panelStyles.numInput}
                  min={1}
                  value={currentStep}
                  onChange={e => el && applyAttr(el, 'data-step', e.target.value)}
                  style={{ width: 52 }}
                />
                <span className={panelStyles.unit}>/ {maxStep} 步</span>
              </div>
            </div>

            <div className={panelStyles.divider} />

            {/* 入场效果 */}
            <div className={panelStyles.section}>
              <div className={panelStyles.sectionTitle}>入场效果</div>
              <div className={panelStyles.row}>
                <select
                  className={panelStyles.select}
                  value={currentAnim}
                  onChange={e => el && applyAttr(el, 'data-animation', e.target.value)}
                >
                  {ANIMATION_OPTIONS.map(o => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* 时间 */}
            <div className={panelStyles.section}>
              <div className={panelStyles.sectionTitle}>时间</div>
              <div className={panelStyles.row}>
                <span className={panelStyles.label}>时长</span>
                <div className={panelStyles.rangeWrap}>
                  <input type="range" min={100} max={2000} step={50}
                    className={panelStyles.range}
                    value={parseInt(currentDuration)}
                    onChange={e => el && applyAttr(el, 'data-duration', e.target.value)}
                  />
                </div>
                <input type="number" className={panelStyles.numInput}
                  min={100} max={2000} step={50}
                  value={parseInt(currentDuration)}
                  onChange={e => el && applyAttr(el, 'data-duration', e.target.value)}
                />
                <span className={panelStyles.unit}>ms</span>
              </div>
              <div className={panelStyles.row}>
                <span className={panelStyles.label}>延迟</span>
                <div className={panelStyles.rangeWrap}>
                  <input type="range" min={0} max={1500} step={50}
                    className={panelStyles.range}
                    value={parseInt(currentDelay)}
                    onChange={e => el && applyAttr(el, 'data-delay', e.target.value)}
                  />
                </div>
                <input type="number" className={panelStyles.numInput}
                  min={0} max={1500} step={50}
                  value={parseInt(currentDelay)}
                  onChange={e => el && applyAttr(el, 'data-delay', e.target.value)}
                />
                <span className={panelStyles.unit}>ms</span>
              </div>
            </div>

            {/* 缓动曲线 */}
            <div className={panelStyles.section}>
              <div className={panelStyles.sectionTitle}>缓动曲线</div>
              <div className={panelStyles.row}>
                <select
                  className={panelStyles.select}
                  value={currentEase}
                  onChange={e => el && applyAttr(el, 'data-ease', e.target.value)}
                >
                  {EASE_OPTIONS.map(o => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className={panelStyles.divider} />

            {/* 操作 */}
            <div className={styles.actions}>
              <button key={previewKey} className={styles.previewBtn} onClick={handlePreview}>
                ▶ 预览
              </button>
              <button className={styles.removeBtn} onClick={handleRemoveStep}>
                移除动画
              </button>
            </div>
          </div>
        )}
      </div>
    )
  }

  // ── 无选中元素 → 只显示页面入场动画区块 ──────────────────────────────────
  return (
    <div>
      {/* 当前页状态 */}
      <div className={panelStyles.section}>
        <div className={panelStyles.sectionTitle}>页面入场动画</div>

        {!loadExists && !loadManaged ? (
          /* 当前页无 tang.onLoad，且无托管配置 */
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
          /* 有动画（脚本或托管） */
          <div>
            {/* 启用/禁用总开关 */}
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

            {/* 来源标签 + 托管切换 */}
            <div className={panelStyles.row} style={{ marginTop: 6 }}>
              <span className={panelStyles.label}>控制方式</span>
              <div className={styles.switchRow} style={{ flex: 1 }}>
                <span className={styles.sourceTag} style={{
                  background: loadManaged
                    ? 'rgba(139,92,246,0.15)' : 'rgba(59,130,246,0.12)',
                  color: loadManaged ? '#a78bfa' : '#93c5fd',
                  borderColor: loadManaged
                    ? 'rgba(139,92,246,0.3)' : 'rgba(59,130,246,0.25)',
                }}>
                  {loadManaged ? '框架预设' : '脚本自定义'}
                </span>
                <button
                  className={styles.switchModeBtn}
                  onClick={handleToggleManaged}
                  title={loadManaged
                    ? '切换回 tang.onLoad 脚本控制'
                    : '切换为框架预设效果（可视化配置）'}
                >
                  {loadManaged ? '改用脚本' : '改用预设'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 托管模式下的预设配置 */}
      {loadManaged && (
        <>
          <div className={panelStyles.divider} />

          {/* 入场效果 */}
          <div className={panelStyles.section}>
            <div className={panelStyles.sectionTitle}>入场效果</div>
            <div className={panelStyles.row}>
              <select
                className={panelStyles.select}
                value={loadAnim}
                onChange={e => slideEl && applyAttr(slideEl, 'data-load-animation', e.target.value)}
              >
                {ANIMATION_OPTIONS.map(o => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* 时间 */}
          <div className={panelStyles.section}>
            <div className={panelStyles.sectionTitle}>时间</div>
            <div className={panelStyles.row}>
              <span className={panelStyles.label}>时长</span>
              <div className={panelStyles.rangeWrap}>
                <input type="range" min={100} max={2000} step={50}
                  className={panelStyles.range}
                  value={parseInt(loadDuration)}
                  onChange={e => slideEl && applyAttr(slideEl, 'data-load-duration', e.target.value)}
                />
              </div>
              <input type="number" className={panelStyles.numInput}
                min={100} max={2000} step={50}
                value={parseInt(loadDuration)}
                onChange={e => slideEl && applyAttr(slideEl, 'data-load-duration', e.target.value)}
              />
              <span className={panelStyles.unit}>ms</span>
            </div>
          </div>

          {/* 缓动 */}
          <div className={panelStyles.section}>
            <div className={panelStyles.sectionTitle}>缓动曲线</div>
            <div className={panelStyles.row}>
              <select
                className={panelStyles.select}
                value={loadEase}
                onChange={e => slideEl && applyAttr(slideEl, 'data-load-ease', e.target.value)}
              >
                {EASE_OPTIONS.map(o => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div className={panelStyles.divider} />

          {/* 预览 */}
          <div className={styles.actions}>
            <button
              className={styles.previewBtn}
              onClick={() => {
                // 预览：重新执行页面托管动画
                const host = document.getElementById('slide-host')
                const sEl  = host?.querySelector<HTMLElement>('.slide')
                const gsap = (window as any).gsap
                if (!sEl || !gsap) return
                const preset = getLoadPreset(loadAnim)
                if (!preset) return
                gsap.from(sEl, {
                  ...preset,
                  duration: parseInt(loadDuration) / 1000,
                  ease: loadEase,
                })
              }}
            >
              ▶ 预览入场
            </button>
          </div>
        </>
      )}

      {/* 脚本模式提示 */}
      {loadExists && !loadManaged && !loadDisabled && (
        <>
          <div className={panelStyles.divider} />
          <div className={styles.scriptHint}>
            <span className={styles.scriptHintIcon}>💡</span>
            入场动画由 <code>tang.onLoad()</code> 脚本控制，可在 slide 的 &lt;script&gt; 中修改。
            切换为"框架预设"可进行可视化配置。
          </div>
        </>
      )}
    </div>
  )
}

// ── 辅助：页面入场预设参数（与 animCtrl PRESETS 保持一致） ───────────────────
const PAGE_PRESETS: Record<string, Record<string, unknown>> = {
  'fade':       { opacity: 0 },
  'fade-up':    { opacity: 0, y: 30 },
  'fade-down':  { opacity: 0, y: -30 },
  'fade-left':  { opacity: 0, x: 30 },
  'fade-right': { opacity: 0, x: -30 },
  'zoom-in':    { opacity: 0, scale: 0.9 },
  'zoom-out':   { opacity: 0, scale: 1.1 },
  'slide-up':   { y: 60 },
  'slide-right':{ x: -60 },
  'none':       null as any,
}

function getLoadPreset(name: string) {
  return PAGE_PRESETS[name] ?? PAGE_PRESETS['fade-up']
}
