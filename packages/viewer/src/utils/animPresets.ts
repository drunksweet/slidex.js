/**
 * animPresets — 统一动画预设表 & 属性解析
 *
 * 多绑定属性格式（v2）：
 *   第 1 个绑定：data-step-1="N"  data-animation-1="xxx"  （兼容旧写法 data-step / data-animation）
 *   第 2 个绑定：data-step-2="M"  data-animation-2="yyy"
 *   ...依此类推，上限无限制
 *
 *   共享参数（所有绑定默认继承）：
 *     data-duration / data-ease / data-stagger
 *   绑定级参数（可覆盖共享参数）：
 *     data-duration-N / data-delay-N / data-ease-N
 *
 *   向后兼容：无后缀的 data-step / data-animation 等价于 data-step-1 / data-animation-1
 */

// ── 预设表 ───────────────────────────────────────────────────────────────────

// GSAP from() 的起始态参数（目标态始终是元素本身的最终样式）
export const ANIM_PRESETS: Record<string, Record<string, unknown>> = {
  'fade':        { opacity: 0 },
  'fade-up':     { opacity: 0, y: 30 },
  'fade-down':   { opacity: 0, y: -30 },
  'fade-left':   { opacity: 0, x: 30 },
  'fade-right':  { opacity: 0, x: -30 },
  'zoom-in':     { opacity: 0, scale: 0.85 },
  'zoom-out':    { opacity: 0, scale: 1.15 },
  'slide-up':    { y: 60 },
  'slide-right': { x: -60 },
  'none':        {},
  // 'custom'：通过 tang.onStep 注册的回调处理，框架不预设
}

/**
 * 出场动画预设表（gsap.to 的目标态参数）
 * 元素从当前状态运动到这些值后隐藏
 */
export const EXIT_PRESETS: Record<string, Record<string, unknown>> = {
  'fade':        { opacity: 0 },
  'fade-up':     { opacity: 0, y: -30 },   // 向上飞出（与入场反向）
  'fade-down':   { opacity: 0, y: 30 },    // 向下飞出
  'fade-left':   { opacity: 0, x: -30 },   // 向左飞出
  'fade-right':  { opacity: 0, x: 30 },    // 向右飞出
  'zoom-in':     { opacity: 0, scale: 0.7 },  // 缩小消失
  'zoom-out':    { opacity: 0, scale: 1.3 },  // 放大消失
  'slide-up':    { y: -60 },               // 向上滑出
  'slide-right': { x: 60 },               // 向右滑出
  'none':        {},
}

/** 获取入场预设，未找到时 fallback 到 fade-up */
export function getPreset(name: string): Record<string, unknown> {
  return ANIM_PRESETS[name] ?? ANIM_PRESETS['fade-up']
}

/** 获取出场预设，未找到时 fallback 到 fade-up 对应的出场 */
export function getExitPreset(name: string): Record<string, unknown> {
  return EXIT_PRESETS[name] ?? EXIT_PRESETS['fade-up']
}

// ── 单绑定（旧接口，向后兼容） ────────────────────────────────────────────────

/**
 * 解析元素第一个绑定的动画属性（向后兼容，读无后缀 or -1 后缀）
 * - animation : 效果名
 * - duration  : 时长（秒）
 * - delay     : 延迟（秒）
 * - ease      : 缓动函数字符串
 * - stagger   : 同步骤多元素的错落时间间隔（秒）
 */
export function parseAnimAttrs(el: HTMLElement) {
  const ds = el.dataset
  // data-step-1 → dataset['step-1']（连字符后跟数字不做 camelCase 转换）
  return {
    animation: ds['animation-1'] ?? ds.animation ?? 'fade-up',
    duration:  parseInt(ds['duration-1'] ?? ds.duration ?? '400') / 1000,
    delay:     parseInt(ds['delay-1']    ?? ds.delay    ?? '0')   / 1000,
    ease:      ds['ease-1']    ?? ds.ease    ?? 'power2.out',
    stagger:   parseFloat(ds.stagger ?? '0') / 1000,
  }
}

// ── 多绑定（v2 新接口） ──────────────────────────────────────────────────────

export interface AnimBinding {
  /** 触发此绑定的步骤号 */
  step:      number
  /** 动画效果名 */
  animation: string
  /** 时长（秒） */
  duration:  number
  /** 延迟（秒） */
  delay:     number
  /** 缓动字符串 */
  ease:      string
  /**
   * 动画方向：
   *   'in'  → gsap.from()，元素从隐藏状态飞入（该元素最小步骤号的那次）
   *   'out' → gsap.to()，元素从可见状态飞出后隐藏（后续步骤）
   */
  direction: 'in' | 'out'
  /** 绑定的序号（1 开始），用于写回属性 */
  index: number
}

/**
 * 解析元素上所有的步骤绑定，返回按步骤号排序的绑定数组。
 *
 * 规则：
 *   1. 扫描 data-step-1, data-step-2... 直到遇到 undefined（兼容 data-step = data-step-1）
 *   2. 共享参数（data-duration / data-ease / data-stagger）作为默认值，可被绑定级属性覆盖
 *   3. 方向（direction）优先读 data-direction-N：
 *        'in'  → 入场（gsap.from，元素从隐藏飞入）
 *        'out' → 出场（gsap.to，元素飞出后隐藏）
 *      若未设置 data-direction-N，则沿用旧规则：步骤号最小的为 'in'，其余为 'out'
 */
export function parseAnimBindings(el: HTMLElement): AnimBinding[] {
  const ds = el.dataset

  // 共享参数（元素级默认值）
  const sharedDuration = parseInt(ds.duration ?? '400')
  const sharedEase     = ds.ease ?? 'power2.out'

  const bindings: AnimBinding[] = []

  // 最多扫描 10 个绑定（足够用了）
  for (let i = 1; i <= 10; i++) {
    // data-step-N → dataset['step-N']（连字符后跟数字，不做 camelCase 转换）
    const k = (field: string) => `${field}-${i}`

    // data-step-1 or data-step（兼容旧写法，仅 i=1 时）
    const rawStep = i === 1
      ? (ds[k('step')] ?? ds.step)
      : ds[k('step')]

    if (rawStep === undefined) break  // 遇到空洞就停止

    const step = parseInt(rawStep)
    if (isNaN(step) || step <= 0) continue

    // 绑定级参数，未设则继承共享参数
    const animation = (i === 1
      ? (ds[k('animation')] ?? ds.animation)
      : ds[k('animation')]) ?? 'fade-up'

    const duration = parseInt(
      (i === 1 ? (ds[k('duration')] ?? ds['duration-1'] ?? ds.duration) : ds[k('duration')])
      ?? String(sharedDuration)
    ) / 1000

    const delay = parseInt(
      (i === 1 ? (ds[k('delay')] ?? ds['delay-1'] ?? ds.delay) : ds[k('delay')])
      ?? '0'
    ) / 1000

    const ease =
      (i === 1 ? (ds[k('ease')] ?? ds['ease-1'] ?? ds.ease) : ds[k('ease')])
      ?? sharedEase

    // 优先读显式 data-direction-N；兼容 i=1 时的 data-direction（无后缀）
    const rawDir = i === 1
      ? (ds[k('direction')] ?? ds.direction)
      : ds[k('direction')]
    // 暂存 'explicit' | undefined，后面统一计算推断值
    const explicitDir: 'in' | 'out' | undefined =
      rawDir === 'in' ? 'in' : rawDir === 'out' ? 'out' : undefined

    bindings.push({ step, animation, duration, delay, ease, direction: explicitDir ?? 'in', index: i })
  }

  if (bindings.length === 0) return []

  // 对没有显式 direction 的绑定：步骤号最小的为 'in'，其余为 'out'
  const hasAnyExplicit = bindings.some(b => {
    const ds = el.dataset
    const i  = b.index
    const raw = i === 1 ? (ds[`direction-${i}`] ?? ds.direction) : ds[`direction-${i}`]
    return raw === 'in' || raw === 'out'
  })

  if (!hasAnyExplicit) {
    // 全部没有显式声明 → 沿用旧规则：步骤号最小的为 in，其余为 out
    const minStep = Math.min(...bindings.map(b => b.step))
    for (const b of bindings) {
      b.direction = b.step === minStep ? 'in' : 'out'
    }
  } else {
    // 有显式声明：先把所有显式的方向赋好，再对未声明的按步骤号顺序推断
    // 先按步骤号排序，确保推断时"前面"是步骤号更小的绑定
    const sorted = [...bindings].sort((a, b) => a.step - b.step)
    for (const b of sorted) {
      const i   = b.index
      const raw = i === 1 ? (ds[`direction-${i}`] ?? ds.direction) : ds[`direction-${i}`]
      if (raw !== 'in' && raw !== 'out') {
        // 未显式声明：若步骤号比它小的绑定里有 'in'，则默认为 'out'；否则为 'in'
        const hasPriorIn = sorted
          .filter(x => x.step < b.step)
          .some(x => x.direction === 'in')
        b.direction = hasPriorIn ? 'out' : 'in'
      }
    }
  }

  // 按步骤号升序排列
  return bindings.sort((a, b) => a.step - b.step)
}

/**
 * 将单绑定写回 el 的 dataset（用于 AnimateTab 对旧格式元素的 applyAttr）
 * 新格式：data-step-N / data-animation-N ...
 */
export function bindingAttrKey(field: string, index: number): string {
  return `data-${field}-${index}`
}
