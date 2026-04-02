# StyleTab 增强实现计划

> **文档状态**：Draft  
> **作者**：jiaoxinheng  
> **最后更新**：2026-04-02  
> **关联文档**：[css-style-编辑能力调研](./css-style-编辑能力调研.md) | [编辑功能技术方案](./编辑功能技术方案.md)

---

## 目标

以「用户实际编辑 PPT 时最需要什么」为导向，分三个 Phase 逐步把 StyleTab 和 TopBar 工具栏做完整。  
**UX 原则**：每一个控件都要有即时视觉反馈；面板布局以最小操作路径为目标，避免用户到处找工具。

---

## 分层架构（代码规范）

```
packages/
├── editor/src/
│   └── (不动，Patch 系统已完整)
└── viewer/src/
    ├── hooks/
    │   └── useStyleApply.ts  ji'h        ← 新增：统一的样式应用 Hook（封装 tang:apply-style dispatch）
    ├── components/
    │   ├── TopBar/
    │   │   ├── TopBar.tsx             ← 扩展：文字工具组（对齐、颜色、字号）
    │   │   └── TopBar.module.css
    │   └── RightPanel/
    │       ├── RightPanel.tsx         ← 不动（Tab 结构保持不变）
    │       └── tabs/
    │           ├── StyleTab.tsx       ← 重构：按 Section 拆分，引入子组件
    │           ├── LayoutTab.tsx      ← 扩展：补充 W/H 精确输入、置底按钮
    │           └── style-sections/   ← 新增目录：StyleTab 各区块子组件
    │               ├── TextSection.tsx
    │               ├── FillSection.tsx
    │               ├── BorderSection.tsx
    │               ├── ShadowSection.tsx
    │               ├── AppearanceSection.tsx
    │               └── TransformSection.tsx
```

### 分层原则

| 层级 | 职责 | 禁止 |
|------|------|------|
| `style-sections/*.tsx` | 纯 UI 展示 + 用户输入，接收 `el: Element` 和 `applyStyle` 函数 | 不直接 dispatch 事件 |
| `useStyleApply.ts` | 封装 `tang:apply-style` dispatch，提供 `applyStyle(el, prop, val)` | 不含 UI |
| `StyleTab.tsx` | 组合各 Section，读取 `el` 的 computed style 初始化各 Section | 不做具体 CSS 操作 |
| `TopBar.tsx` | 常用高频操作（文字对齐、B/I/U、颜色），仅操作 `selectedEl` | 不含布局/阴影等低频操作 |

---

## Phase 1 — 高频文字工具（1~2 天）

**目标**：补完用户打开编辑模式后第一时间就需要的文字工具，对标 PPT 最基础的功能集。

### 1.1 TopBar 扩展

当前 TopBar 中区只有 B / I / U + Undo/Redo 5 个按钮，需要补充：

```
现在：  [B] [I] [U]  |  [↩] [↪]

Phase1：[B] [I] [U] [S]  |  [≡ 左] [≡ 中] [≡ 右] [≡ 两端]  |  [字号 ▲▼]  |  [↩] [↪]
```

**新增控件**：

| 控件 | CSS 属性 | 交互 |
|------|---------|------|
| S（删除线）按钮 | `text-decoration: line-through` | toggle，active 态高亮 |
| 文字对齐 × 4 | `text-align: left/center/right/justify` | 单选组，当前值高亮 |
| 字号 +/- 微调 | `font-size` | +2/-2px，长按连续触发 |

**UX 要点**：
- 选中不同元素时，TopBar 按钮状态实时同步（B/I/U/S/对齐都要反映当前元素的实际值）
- 无选中元素时所有按钮 disabled（灰显，不可点）
- `text-align` 四个按钮做成一组（类似 radio），用图标（AlignLeft/Center/Right/Justify）

### 1.2 StyleTab — 文字 Section 重构

当前 StyleTab 的「文字」区只有颜色和字号，需要扩充为完整文字区块：

```
┌─ 文字 ─────────────────────────────────┐
│  颜色  [●]  #FFFFFF                    │  ← 已有
│  字号  [   16  ]  px                   │  ← 已有
│  ─────────────────────────────────────  │
│  字体  [ Inter ▼ ]                     │  ← 新增（下拉选字体族）
│  字重  [ Regular ▼ ]                   │  ← 新增（下拉选 100~900）
│  ─────────────────────────────────────  │
│  行高  [====|---]  1.5                 │  ← 新增（0.8~3.0 滑块）
│  字间距 [====|---] 0                   │  ← 新增（-5~20 px 滑块）
└────────────────────────────────────────┘
```

**字体族列表（预设，不做自由输入）**：
```
中文无衬线: 思源黑体(Noto Sans SC), 苹方, 微软雅黑
中文衬线:   思源宋体(Noto Serif SC)
英文无衬线: Inter, Geist, Arial
英文衬线:   Georgia, Times New Roman
等宽:       JetBrains Mono, ui-monospace
```

### 1.3 LayoutTab — 补充宽高精确输入

```
┌─ 尺寸 ─────────────────────────────────┐
│  W  [  320  ]  px     H  [  80  ]  px  │  ← 新增（读 offsetWidth/Height）
└────────────────────────────────────────┘
```

放在「位置」区块上方，与 X/Y 输入框风格统一。

---

## Phase 2 — 填充 / 边框 / 阴影（2~3 天）

**目标**：让用户能完整控制元素的「外观」，对标 PPT 的格式设置面板。

### 2.1 填充 Section 重构

当前只有纯色 + 透明度，需要支持渐变和 Alpha 通道：

```
┌─ 填充 ─────────────────────────────────┐
│  类型  [纯色] [渐变] [无]               │  ← Tab 切换
│                                        │
│  ── 纯色模式 ──                         │
│  颜色  [●]  rgba(15,23,42,0.85)        │  ← 颜色选择器 + Alpha 滑块
│  Alpha [====|---]  85%                 │
│                                        │
│  ── 渐变模式 ──                         │
│  起始色 [●]  #3b82f6                   │
│  结束色 [●]  #8b5cf6                   │
│  角度  [====|---]  135°                │
└────────────────────────────────────────┘
```

**UX 要点**：
- 颜色选择器用 `<input type="color">` + 独立 Alpha 滑块组合（浏览器原生不支持 Alpha）
- 渐变预览：角度滑块旁实时显示一个渐变色条
- 切换「无」时 `background: transparent`

### 2.2 边框 Section（新增）

```
┌─ 边框 ─────────────────────────────────┐
│  ○ 显示边框  [开关]                     │  ← toggle，关闭时 border: none
│                                        │
│  颜色  [●]  #3b82f6                    │
│  宽度  [====|---]  2   px              │
│  样式  [—实线▼]                         │  ← solid/dashed/dotted 下拉
│  圆角  [====|---]  8   px              │  ← 已有，移入边框区块
└────────────────────────────────────────┘
```

**UX 要点**：
- 开关 toggle：开启时才显示颜色/宽度/样式控件（折叠展开动画）
- 颜色/宽度/样式三者联动写 `border: {宽}px {样式} {颜色}` shorthand

### 2.3 阴影 Section（新增）

```
┌─ 阴影 ─────────────────────────────────┐
│  盒阴影  [开关]                         │
│  X     [-5 ~ 20]  4    px              │
│  Y     [-5 ~ 20]  8    px              │
│  模糊  [0 ~ 40]   16   px              │
│  扩散  [-10 ~ 20] 0    px              │
│  颜色  [●]  rgba(0,0,0,0.25)           │
│  内阴影  □                              │  ← checkbox: inset
│  ─────────────────────────────────────  │
│  文字阴影  [开关]                        │
│  X     2   Y  2   模糊  4   颜色 [●]   │
└────────────────────────────────────────┘
```

**UX 要点**：
- 开关关闭时 `box-shadow: none` / `text-shadow: none`
- 各参数联动实时预览（每次 input 都 dispatch，不等 blur）
- 颜色支持 Alpha（rgba 格式输出）

---

## Phase 3 — 外观进阶 / 变换 / 毛玻璃（2~3 天）

**目标**：补充高设计感效果，覆盖 Keynote/Figma 用户习惯的能力。

### 3.1 外观 Section 重构

```
┌─ 外观 ─────────────────────────────────┐
│  透明度  [====|----]  100%             │  ← 已有，保留
│  ─────────────────────────────────────  │
│  ○ 毛玻璃  [开关]                       │  ← 新增
│    模糊   [===|----]  12  px           │  backdrop-filter: blur
│    透光度 [===|----]  15  %            │  background-color alpha
│  ─────────────────────────────────────  │
│  ○ 滤镜（对图片元素）                   │
│    [正常] [模糊] [黑白] [高亮]          │  ← 预设模式 Tab
│    自定义:                             │
│    亮度  [===|----]  100%              │  filter: brightness
│    对比度 [===|----]  100%             │  filter: contrast
│    饱和度 [===|----]  100%             │  filter: saturate
└────────────────────────────────────────┘
```

**毛玻璃 UX 要点**（重点）：
- 开关开启时，**一次性**同时设置：
  - `backdrop-filter: blur(12px) saturate(160%)`
  - `-webkit-backdrop-filter: blur(12px) saturate(160%)`（Safari）
  - `background-color: rgba(255,255,255,0.15)`（如当前背景不透明则自动带 alpha）
- 开关旁显示一个毛玻璃效果的小预览缩略图（CSS 渲染）
- 「模糊」和「透光度」两个滑块实时联动，不需要单独保存按钮
- 开关关闭时清除 `backdrop-filter` 和 `-webkit-backdrop-filter`，**不动** `background-color`（防止用户丢失颜色设置）

**滤镜 UX 要点**：
- 仅当选中元素包含 `<img>` 或背景图时，才展示「滤镜」区块（其他元素不显示，减少干扰）
- 四个预设模式是快捷方式：
  - 「正常」：清除 filter
  - 「模糊」：`filter: blur(4px)`
  - 「黑白」：`filter: grayscale(100%)`
  - 「高亮」：`filter: brightness(130%) saturate(120%)`

### 3.2 变换 Section（新增）

```
┌─ 变换 ─────────────────────────────────┐
│  缩放  X [  100  ]%   Y [  100  ]%     │  ← transform: scale(x, y)
│  ─────────────────────────────────────  │
│  翻转  [↔ 水平]  [↕ 垂直]              │  ← toggle: scaleX(-1) / scaleY(-1)
└────────────────────────────────────────┘
```

**UX 要点**：
- 缩放和翻转需要与已有的 `translate` / `rotate` 合并写入 transform（不能覆盖掉）
- 使用 `EditManager._getTransformParts()` 读取当前 transform 再合并写回

---

## 整体 UX 动线设计

### 操作路径分级

```
高频（TopBar 展示，一键触发）
  → 文字对齐、B/I/U/S、颜色、字号微调

中频（RightPanel 默认展开区块）
  → 字体族/字重/行高/字间距
  → 填充颜色（含 Alpha）
  → 圆角、透明度

低频（折叠区块，需要展开）
  → 渐变填充
  → 边框样式
  → 阴影
  → 毛玻璃
  → 滤镜、缩放/翻转
```

### 选中元素后的面板行为

```
用户点击元素
  │
  ├─ RightPanel 自动切换到「样式」Tab（如果当前在其他 Tab）
  │   → 是否自动切换？建议：仅第一次进入编辑模式时切换，
  │     之后保留用户手动切换的 Tab 状态
  │
  ├─ 各 Section 读取 getComputedStyle(el) 初始化控件值
  │
  └─ TopBar 工具状态同步（B/I/U/S/对齐按钮 active 态）
```

### 控件输入反馈策略

| 控件类型 | 触发时机 | 原因 |
|---------|---------|------|
| `<input type="color">` | `onChange`（实时） | 颜色选择需要即时预览 |
| `<input type="range">` | `onInput`（实时） | 滑块必须实时反馈 |
| `<input type="number">` | `onBlur` + `Enter` | 避免用户输入中间态（如输入 "1" 时立即触发） |
| `<select>` 下拉 | `onChange` | 选中即生效 |
| 开关 Toggle | `onChange` | 即时生效 |
| 按钮 | `onClick` | 点击即触发 |

### 无选中状态的面板处理

- 当前：显示「点击 PPT 中的元素以查看属性」
- 建议保持，但改进文案：「在编辑模式下点击元素，可在此处调整样式」
- 不做空状态占位 skeleton（面板较小，空白比假数据好）

---

## 代码实现要点

### `useStyleApply` Hook

```typescript
// packages/viewer/src/hooks/useStyleApply.ts
export function useStyleApply() {
  const applyStyle = useCallback((el: Element, prop: string, val: string) => {
    document.dispatchEvent(
      new CustomEvent('tang:apply-style', { detail: { el, prop, val } })
    )
  }, [])

  // 批量设置（如毛玻璃需要同时设多个属性）
  const applyStyles = useCallback((el: Element, styles: Record<string, string>) => {
    Object.entries(styles).forEach(([prop, val]) => {
      document.dispatchEvent(
        new CustomEvent('tang:apply-style', { detail: { el, prop, val } })
      )
    })
  }, [])

  return { applyStyle, applyStyles }
}
```

### Section 子组件接口规范

```typescript
// 所有 Section 组件统一接口
interface SectionProps {
  el: Element                           // 当前选中元素（leafEl 或 selectedEl）
  applyStyle: (prop: string, val: string) => void
  applyStyles: (styles: Record<string, string>) => void
}
```

### transform 合并写入

缩放/翻转写入时不能覆盖 translate 和 rotate，需要合并：

```typescript
import { _getTransformParts, _buildTransform } from '@tang-slidex/editor'

function applyScale(el: HTMLElement, sx: number, sy: number) {
  const parts = _getTransformParts(el.style.transform || '')
  // _buildTransform 目前只有 translate + rotate，需要扩展 scale
  // 方案：在 viewer 侧维护一个 buildTransformWithScale 工具函数
  const val = buildTransformFull({ ...parts, sx, sy })
  applyStyle(el, 'transform', val)
}
```

> ⚠️ `_buildTransform` 目前只处理 `translate + rotate`，Phase 3 需要在 viewer 侧补充 `scale` 的合并逻辑（或升级 editor 包的工具函数）。

### 毛玻璃开关实现

```typescript
function applyFrostedGlass(el: Element, blur: number, alpha: number) {
  const blurVal = `blur(${blur}px) saturate(160%)`
  applyStyles(el, {
    'backdrop-filter':          blurVal,
    '-webkit-backdrop-filter':  blurVal,
    'background-color':         `rgba(255,255,255,${alpha / 100})`,
  })
}

function removeFrostedGlass(el: Element) {
  applyStyles(el, {
    'backdrop-filter':         '',
    '-webkit-backdrop-filter': '',
  })
  // 不清 background-color，保留用户已设的颜色
}
```

---

## Phase 排期参考

| Phase | 内容 | 预估工时 | 依赖 |
|-------|------|---------|------|
| Phase 1 | TopBar 文字工具 + StyleTab 文字 Section + LayoutTab W/H | 1.5 天 | 无 |
| Phase 2 | 填充 Alpha/渐变 + 边框 + 阴影 | 2.5 天 | Phase 1 的 Section 架构 |
| Phase 3 | 毛玻璃 + 滤镜 + 缩放/翻转 + transform 合并 | 2 天 | editor 包 transform 工具函数 |

**总计约 6 天**，可根据优先级拆分独立完成，不互相阻塞。

---

## Phase 4 — 对标 WPS 文字工具栏补齐（参考 WPS 截图，约 2 天）

> **背景**：对比 WPS 文字工具栏截图，我们 Phase 1~3 已覆盖了大部分基础排版能力，但以下几项用户高频操作仍缺失。

### WPS vs 现有能力对比

| WPS 功能 | CSS 对应 | 我们现状 | 优先级 |
|----------|---------|---------|--------|
| 清除格式按钮 | 移除所有 `style` inline 属性 | ❌ 无 | ⭐⭐⭐ |
| 文字高亮色 | `background-color`（行内） | ❌ 无 | ⭐⭐⭐ |
| 上标 / 下标 | `vertical-align: super/sub` + `font-size: 0.75em` | ❌ 无 | ⭐⭐ |
| 段落间距 | `margin-top` / `margin-bottom` | ❌ 无 | ⭐⭐ |
| 首行缩进 | `text-indent` | ❌ 无 | ⭐ |
| 文字描边（轮廓）| `-webkit-text-stroke` | ❌ 无 | ⭐ |
| 竖向对齐（容器）| `vertical-align` / `align-items` | ❌ 无 | ⭐ |
| B / I / U / S | `font-weight/style/text-decoration` | ✅ TopBar 有 | — |
| 字体 / 字号 | `font-family / font-size` | ✅ TextSection 有 | — |
| 对齐方式 × 4 | `text-align` | ✅ TopBar 有 | — |
| 行高 / 字间距 | `line-height / letter-spacing` | ✅ TextSection 有 | — |

### 4.1 TopBar 新增：清除格式 + 文字高亮 + 上下标

```
现有:   [B] [I] [U] [S]  |  对齐×4  |  字号+/-

Phase4: [B] [I] [U] [S] [X²] [X₂]  |  [高亮▼]  |  [清除格式 ✕]  |  对齐×4  |  字号+/-
```

#### 4.1.1 清除格式按钮（`✕ 清除格式`）

**功能**：一键清除选中元素的所有 `style` 内联属性，还原到 HTML 原始样式。

**UX**：
- 图标：橡皮擦 `Eraser`（lucide-react 有）
- 点击后弹出一个确认 Toast：「已清除所有内联样式」（2s 消失）
- 不影响元素的 `class` 和其他属性，只移除 `style="..."`
- `applyStyle(el, '__clear__', '')` → EditManager 新增 `clear-style` patch 类型（或直接保存 `style=""` 到 HTML）

**实现方式**：发 `tang:clear-style` 自定义事件（不复用 `tang:apply-style`，语义独立），EditManager 处理时直接写 `style=""`。

---

#### 4.1.2 文字高亮色（`[高亮▼]`）

**功能**：设置文字背景高亮色（`background-color` 内联），常用于强调关键词。

**UX**：
```
TopBar 中：[A 高亮▼]  ← 点击展开颜色选择器浮层

浮层：
  [黄] [绿] [青] [粉] [无]   ← 5个常用高亮预设色（参考 WPS/Word）
  [自定义 ●]                  ← input type=color
```

- 默认高亮色：黄色 `rgba(255, 230, 0, 0.5)`
- 「无」= 清除 `background-color`
- 颜色选择器悬停时实时预览
- 位于 TopBar，操作对象是 `leafEl`（与 B/I/U 一样作用于文字元素）

**实现注意**：  
`background-color` 同时被 FillSection 用于设置容器背景，但这里是对**文字元素**设置，两者对象不同，不冲突。

---

#### 4.1.3 上标 / 下标（`X²` / `X₂`）

**功能**：WPS 标准上下标（`X²` 上标，`X₂` 下标）。

**UX**：
- 两个 toggle 按钮，互斥（开上标则关下标）
- 点击已激活的再次点击取消
- 仅对 `leafEl`（文字元素）生效

**CSS 实现**：
```css
/* 上标 */
vertical-align: super;
font-size: 0.75em;

/* 下标 */
vertical-align: sub;
font-size: 0.75em;

/* 取消 */
vertical-align: baseline;
font-size: inherit;
```

用 `applyStyles` 批量设置两个属性。

---

### 4.2 TextSection 新增：段落间距 + 首行缩进

放在 TextSection 的行高 / 字间距区块之后。

```
┌─ 文字 ─────────────────────────────────┐
│  颜色  字号  字体  字重                 │  ← 已有
│  行高  字间距                           │  ← 已有
│  ─────────────────────────────────────  │
│  段前距  [====|---]  0   px            │  ← 新增
│  段后距  [====|---]  0   px            │  ← 新增
│  首行缩进 [====|---] 0   em            │  ← 新增
└────────────────────────────────────────┘
```

**UX 要点**：
- 范围：段前 / 段后距 `0~60px`（`margin-top` / `margin-bottom`）
- 首行缩进 `0~4em`（`text-indent`），step=0.5
- 三者都用 range + number 双联动（与行高/字间距风格一致）

---

### 4.3 TopBar UX 调整：工具组重排

整合 Phase 1 + Phase 4 新增后，TopBar 中区顺序建议：

```
[B] [I] [U] [S]  |  [X²] [X₂]  |  [高亮▼]  [清除格式]  |  [左] [中] [右] [两端]  |  [-] 字号 [+]  |  [↩] [↪]
```

UX 原则：
- 格式类（加粗/斜体/装饰线/上下标）→ 高亮/清除 → 对齐 → 字号 → 历史操作
- 分组用 `|` 分隔线隔开，视觉层次清晰
- 过窄时（TopBar < 800px）后面的组折叠为 `…更多` 下拉（暂不做，预留）

---

### 排期

| 子任务 | 工时估算 | 优先级 |
|--------|---------|--------|
| 清除格式按钮（含 EditManager clear-style patch） | 0.5 天 | ⭐⭐⭐ |
| 文字高亮色浮层 | 0.5 天 | ⭐⭐⭐ |
| 上标 / 下标按钮 | 0.25 天 | ⭐⭐ |
| TextSection 段落间距 + 首行缩进 | 0.5 天 | ⭐⭐ |
| TopBar 工具组重排（视觉整理） | 0.25 天 | ⭐ |
| **合计** | **约 2 天** | — |

---

**总计约 6 天**，可根据优先级拆分独立完成，不互相阻塞.

---

## 附：各 Phase 完成后的 StyleTab 全貌

```
┌─────────────────────────────────────────┐
│  [样式] [排列] [动画] [AI🤖]             │
├─────────────────────────────────────────┤
│ ▼ 文字                          Phase 1 │
│   颜色  字号  字体  字重                 │
│   行高  字间距                           │
│   段前距  段后距  首行缩进      Phase 4  │
├─────────────────────────────────────────┤
│ ▼ 填充                          Phase 2 │
│   [纯色] [渐变] [无]                     │
│   颜色  Alpha 滑块                       │
├─────────────────────────────────────────┤
│ ▼ 边框                          Phase 2 │
│   开关 ○  颜色  宽度  样式  圆角         │
├─────────────────────────────────────────┤
│ ▼ 阴影                          Phase 2 │
│   盒阴影 开关 ○  X Y blur spread 颜色   │
│   文字阴影 开关 ○                        │
├─────────────────────────────────────────┤
│ ▼ 外观                          Phase 3 │
│   透明度                                 │
│   毛玻璃 开关 ○  模糊  透光度（待迭代）  │
│   滤镜（仅图片元素显示）                  │
├─────────────────────────────────────────┤
│ ▼ 变换                          Phase 3 │
│   缩放 X  Y    翻转 [↔] [↕]            │
└─────────────────────────────────────────┘
```

**TopBar 最终形态（Phase 1 + Phase 4）**：

```
[B] [I] [U] [S]  |  [X²] [X₂]  |  [高亮▼] [清除✕]  |  [左] [中] [右] [两端]  |  [-] 16 [+]  |  [↩] [↪]
```
