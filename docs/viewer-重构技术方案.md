# tang-slidex · 展示交互层 React+PWA 重构技术方案

> 文档状态：**Completed**  
> 作者：jiaoxinheng  
> 最后更新：2026-04-02（Viewer 重构完成）  
> 关联文档：[技术方案](./技术方案.md) | [编辑功能技术方案](./编辑功能技术方案.md) | [MVP 架构](./mvp-架构.md)

---

## 目录

1. [背景与动机](#1-背景与动机)
2. [目标布局：三栏 PPT 编辑器](#2-目标布局三栏-ppt-编辑器)
3. [整体架构](#3-整体架构)
4. [组件设计](#4-组件设计)
5. [状态管理：Zustand](#5-状态管理zustand)
6. [PWA 方案](#6-pwa-方案)
7. [Electron 升级路径（预留）](#7-electron-升级路径预留)
8. [Vite 配置与插件集成](#8-vite-配置与插件集成)
9. [迁移策略](#9-迁移策略)
10. [技术选型汇总](#10-技术选型汇总)
11. [约束与注意事项](#11-约束与注意事项)

---

## 1. 背景与动机

### 1.1 现状问题

当前展示交互层 `examples/tech-intro/index.html` 是一个 **1300+ 行的单文件 HTML**，将 CSS、DOM 结构与 JavaScript 逻辑全部内联在一起，包含：

- `EditUI` 类（选中框 / 浮动工具栏）
- `PropsPanel` 类（右侧属性面板，以 `position: fixed` 覆盖在 PPT 舞台上）
- `CodeBoxManager` 类（CodeMirror IDE 模式）
- 导航逻辑、缩放逻辑、HMR 处理逻辑

**核心痛点：**

| 问题 | 影响 |
|------|------|
| 单文件膨胀，逻辑高度耦合 | 功能扩展困难，几乎无法测试 |
| 属性面板以 `position:fixed` 覆盖 PPT 舞台 | 编辑时 PPT 内容被遮挡，体验差 |
| 无 PWA / 安装支持 | 无法作为独立应用使用，无法离线 |
| 无组件抽象，逻辑重复 | 无法在不同 examples 中复用编辑 UI |
| 全局变量/内联类 pattern | 与 Electron IPC 路径不兼容，升级成本极高 |

### 1.2 目标

1. **三栏布局**：参照 Keynote / Google Slides 的专业 PPT 编辑器布局，属性面板独占右侧，不遮挡舞台
2. **组件化**：React 19 + TypeScript，每个功能面板独立组件，逻辑可测试
3. **PWA 优先**：可安装到桌面/手机，离线可用（App Shell 策略）
4. **Electron 预留**：平台 API 层抽象，未来只需替换 IPC 实现即可升级
5. **复用现有包**：`@tang-slidex/editor`（EditManager + Vite 插件）和 `@tang-slidex/core`（SlideRunner）保持不动

---

## 2. 目标布局：三栏 PPT 编辑器

参考 Keynote / Google Slides / PowerPoint Web 版，分为**编辑模式**和**演示模式**。

### 2.1 编辑模式布局

```
┌─────────────────────────────────────────────────────────────────────────┐
│  TopBar（顶部工具栏）                                           48px    │
│  [🎞 tang-slidex] [演示] [编辑★]   [↩][↪][B][I][U][A▾]  [💾保存][⛶全屏]│
├──────────────────┬──────────────────────────────────┬───────────────────┤
│                  │                                  │                   │
│  SlidePanel      │         StageArea                │   RightPanel      │
│  左侧缩略图       │         中间舞台区                │   右侧属性栏       │
│  200px           │         flex:1                   │   240px           │
│                  │                                  │                   │
│  ┌────────────┐  │  ┌────────────────────────────┐  │  ╔═════════════╗  │
│  │  Slide 01  │  │  │                            │  │  ║  [样式][排列]║  │
│  │  (缩略图)   │  │  │   1280 × 720 PPT 舞台      │  │  ╠═════════════╣  │
│  └────────────┘  │  │   scale(自适应)             │  │  ║ 背景色       ║  │
│  ┌────────────┐  │  │                            │  │  ║ ████ #0f172a ║  │
│  │  Slide 02  │  │  │                            │  │  ╠═════════════╣  │
│  │  当前页★   │  │  └────────────────────────────┘  │  ║ 不透明度     ║  │
│  └────────────┘  │                                  │  ║ ▓▓▓▓▓▓░ 80% ║  │
│  ┌────────────┐  │  ────── 页码导航 ──────────────── │  ╠═════════════╣  │
│  │  Slide 03  │  │  [‹]   2 / 16   [›]  [▶ 演示]    │  ║ 圆角         ║  │
│  └────────────┘  │                                  │  ║ ▓▓░░░░░  8px ║  │
│  ...             │                                  │  ╚═════════════╝  │
│                  │                                  │                   │
└──────────────────┴──────────────────────────────────┴───────────────────┤
│  StatusBar  [缩放: 75%] · [第 2 页] · [有未保存修改 ●] · [Ctrl+S 保存]  │
└─────────────────────────────────────────────────────────────────────────┘
```

### 2.2 演示模式布局

```
┌─────────────────────────────────────────────────────────────────────────┐
│  TopBar（精简）                                                          │
│  [← 退出演示]                                    [⛶ 全屏]               │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│                       PPT 舞台（全屏自适应）                              │
│                        无左右侧栏遮挡                                     │
│                                                                         │
├─────────────────────────────────────────────────────────────────────────┤
│  底部导航  [‹]  2 / 16  [›]                                             │
└─────────────────────────────────────────────────────────────────────────┘
```

**模式切换规则：**
- 点击 TopBar「演示」Tab → 切换到演示模式，左右侧栏滑出（CSS transition）
- 点击「← 退出演示」→ 回到编辑模式
- 按 `F` 键 → `requestFullscreen()`，进入全屏演示（浏览器级全屏）
- 按 `Esc` → 退出全屏（浏览器行为）或退出演示模式

---

## 3. 整体架构

### 3.1 新包：`packages/viewer`

在现有 Monorepo 中新增独立包，作为**正式的展示交互层**实现：

```
packages/viewer/
├── package.json                    # @tang-slidex/viewer
├── vite.config.ts                  # Vite + React + PWA 插件
├── tsconfig.json
├── index.html                      # SPA 入口（轻量，仅挂载 React）
├── public/
│   ├── manifest.json               # PWA Manifest
│   ├── icons/
│   │   ├── icon-192.png
│   │   └── icon-512.png
│   └── screenshots/                # PWA 应用截图（App Store 展示用）
└── src/
    ├── main.tsx                    # ReactDOM.createRoot 入口
    ├── App.tsx                     # 根组件，模式路由（演示/编辑）
    ├── store/
    │   ├── slideStore.ts           # Zustand：当前页、总页数、加载状态、缩放
    │   ├── editStore.ts            # Zustand：编辑状态、patches、选中元素
    │   └── uiStore.ts              # Zustand：模式（present/edit）、侧栏开关
    ├── components/
    │   ├── TopBar/
    │   │   ├── TopBar.tsx
    │   │   ├── TopBar.module.css
    │   │   └── ToolGroup.tsx       # 文字样式工具组（编辑模式下显示）
    │   ├── SlidePanel/
    │   │   ├── SlidePanel.tsx      # 左侧整体面板（可折叠）
    │   │   ├── SlideThumbnail.tsx  # 单个缩略图 item（iframe 方案）
    │   │   └── SlidePanel.module.css
    │   ├── StageArea/
    │   │   ├── StageArea.tsx       # 中间舞台（包裹 slide-host）
    │   │   ├── StageCanvas.tsx     # 实际渲染容器（含选中框、辅助线）
    │   │   ├── NavBar.tsx          # 页码导航条
    │   │   └── StageArea.module.css
    │   ├── RightPanel/
    │   │   ├── RightPanel.tsx      # 右侧面板容器（含 Tab 切换）
    │   │   ├── tabs/
    │   │   │   ├── StyleTab.tsx    # 样式：背景色、文字色、圆角、透明度
    │   │   │   ├── LayoutTab.tsx   # 排列：XY坐标、宽高、对齐、层级
    │   │   │   ├── AnimateTab.tsx  # 动画（Phase 3，占位）
    │   │   │   └── AiTab.tsx       # AI 对话（Phase 3，占位）
    │   │   └── RightPanel.module.css
    │   ├── StatusBar/
    │   │   └── StatusBar.tsx
    │   └── shared/
    │       ├── Toast.tsx
    │       ├── ColorPicker.tsx     # 颜色选择器（swatch + hex input）
    │       ├── RangeInput.tsx      # Range + 数字输入联动
    │       └── Icon.tsx            # lucide-react 图标封装
    ├── hooks/
    │   ├── useSlideRunner.ts       # 封装 @tang-slidex/core SlideRunner
    │   ├── useEditManager.ts       # 封装 @tang-slidex/editor EditManager
    │   ├── useKeyboard.ts          # 全局快捷键注册（演示/编辑分组）
    │   └── useResizeObserver.ts    # 舞台自适应缩放
    └── platform/
        ├── index.ts                # 平台 API 接口定义
        ├── web.ts                  # Web/PWA 实现（fetch + Vite dev server）
        └── electron.ts             # Electron 实现（预留，ipcRenderer）
```

### 3.2 与现有包的分层关系

```
┌──────────────────────────────────────────────────────────────────┐
│               packages/viewer  (React SPA / PWA)                 │
│                                                                  │
│  ┌──────────┐  ┌────────────┐  ┌─────────────┐  ┌────────────┐  │
│  │  TopBar  │  │ SlidePanel │  │  StageArea  │  │ RightPanel │  │
│  └──────────┘  └─────┬──────┘  └──────┬──────┘  └─────┬──────┘  │
│                      │               │               │           │
│  ┌───────────────────────────────────────────────────────────┐   │
│  │                  Zustand Store 层                         │   │
│  │        slideStore · editStore · uiStore                   │   │
│  └───────────────────────────────────────────────────────────┘   │
│                      │               │               │           │
│  ┌───────────────────┴───┐   ┌───────┴───────────────┘           │
│  │  useSlideRunner hook  │   │  useEditManager hook              │
│  └──────────┬────────────┘   └──────────────┬────────────────────┘
└─────────────┼────────────────────────────────┼───────────────────┘
              ↓                                ↓
┌─────────────────────────┐   ┌────────────────────────────────────┐
│  @tang-slidex/core      │   │  @tang-slidex/editor               │
│  SlideRunner            │   │  EditManager（类实例，非 React）    │
└────────────┬────────────┘   │  slideInspectorPlugin              │
             │                │  slideSavePlugin / slideUndoPlugin  │
             ↓                └────────────────────────────────────┘
     slides/*.html
  （纯 HTML，保持不变）
```

### 3.3 关键设计原则

1. **EditManager 不 Reactify**：`EditManager` 是命令式类实例，通过 `useEditManager` hook 用 `useRef` 持有，通过回调同步状态到 Zustand store，不把 EditManager 重写为 React 形式
2. **`slide-host` 保持普通 DOM**：React 不接管 `slide-host` 的内容（那是 SlideRunner 管的），只用 `useRef` 持有 DOM 引用并传给 SlideRunner
3. **样式隔离**：Viewer 组件用 CSS Modules，`slide-host` 内的 slide 样式完全独立，不会互相干扰

---

## 4. 组件设计

### 4.1 `App.tsx` — 根组件

```tsx
// 根据 uiStore.mode 在演示/编辑模式间切换布局
// 编辑模式: 三栏 grid 布局
// 演示模式: 仅中间舞台 + 精简 TopBar

type AppMode = 'present' | 'edit'

export function App() {
  const mode = useUiStore(s => s.mode)

  return (
    <div className={styles.app} data-mode={mode}>
      <TopBar />
      {mode === 'edit' && <SlidePanel />}
      <StageArea />
      {mode === 'edit' && <RightPanel />}
      <StatusBar />
      <Toast />
    </div>
  )
}
```

CSS Grid 布局：
```css
/* 编辑模式 */
.app[data-mode="edit"] {
  display: grid;
  grid-template-areas:
    "topbar  topbar  topbar"
    "slides  stage   panel"
    "status  status  status";
  grid-template-columns: 200px 1fr 240px;
  grid-template-rows: 48px 1fr 28px;
  height: 100vh;
}

/* 演示模式 */
.app[data-mode="present"] {
  display: grid;
  grid-template-areas:
    "topbar"
    "stage"
    "status";
  grid-template-rows: 40px 1fr 28px;
  height: 100vh;
}
```

### 4.2 `TopBar` — 顶部工具栏

```
左区:  Logo  |  [演示模式][编辑模式]  ← Tab 切换
中区:  ← 编辑模式时显示 → [↩撤销] [↪重做]  |  [B] [I] [U]  |  [色块▾]  |  [字号↕]
右区:  [💾 保存]  [⛶ 全屏]  [⋯ 更多]
```

- 模式 Tab 驱动 `uiStore.setMode()`
- 撤销/重做调用 `editStore.undo()` / `editStore.redo()`（redo 在 Phase 2 实现）
- 保存按钮调用 `editStore.save()`，`isDirty` 为 true 时才 active

### 4.3 `SlidePanel` — 左侧缩略图面板

**功能：**
- 滚动列表，显示所有 slide 缩略图（共 16 张）
- 点击跳转，当前页高亮蓝色边框
- 顶部有「+ 新增页面」按钮（Phase 2 实现）
- 支持折叠（点击收起图标 → 宽度缩为 0，CSS transition）

**缩略图方案：**

```tsx
// MVP 阶段：iframe + CSS scale
function SlideThumbnail({ index }: { index: number }) {
  const url = `/slides/slide-${pad(index + 1)}.html`
  return (
    <div className={styles.thumbnailWrapper} onClick={() => navigateTo(index)}>
      <iframe
        src={url}
        tabIndex={-1}
        scrolling="no"
        style={{
          width: '1280px', height: '720px',
          transform: `scale(${160 / 1280})`,
          transformOrigin: 'top left',
          pointerEvents: 'none',
          border: 'none',
        }}
      />
    </div>
  )
}
// 容器：width: 160px; height: 90px; overflow: hidden;
```

**后续优化（Phase 5）：**
- 使用 `IntersectionObserver` 懒加载，只渲染视口内的 iframe
- 页面编辑保存后，对应缩略图刷新（传递 `key={lastSaved}` 使 iframe 重渲染）

**拖拽排序（Phase 3）：**
```tsx
// 使用 @dnd-kit/core 实现
// 拖拽完成后调用 platform.reorderSlides(fromIndex, toIndex)
// 服务端重命名文件（slide-002.html ↔ slide-003.html）
```

### 4.4 `StageArea` — 中间舞台

```tsx
function StageArea() {
  const containerRef = useRef<HTMLDivElement>(null)
  const hostRef      = useRef<HTMLDivElement>(null)
  const { scale, setScale } = useSlideStore()
  const runner = useSlideRunner(hostRef)  // 初始化 SlideRunner

  // 自适应缩放
  useResizeObserver(containerRef, ({ width, height }) => {
    const s = Math.min(width / 1280, height / 720) * 0.96
    setScale(s)
    if (hostRef.current) {
      hostRef.current.style.transform = `scale(${s})`
    }
  })

  return (
    <div ref={containerRef} className={styles.stageArea}>
      <div className={styles.stageWrapper}>
        {/* slide-host: 1280×720，由 SlideRunner 管理内容 */}
        <div ref={hostRef} id="slide-host" className={styles.slideHost} />
        {/* 选中框（编辑模式下显示） */}
        <SelectionOverlay />
        {/* 对齐辅助线 */}
        <AlignGuides />
      </div>
      <NavBar />
    </div>
  )
}
```

**`useResizeObserver`**：使用 `ResizeObserver` 监听 `containerRef` 尺寸变化，重新计算 scale，代替原来的 `window.resize` 事件（三栏布局中舞台宽度不等于 window 宽度）。

### 4.5 `RightPanel` — 右侧属性面板

**Tab 结构：**

```
┌──────────────────────────────────────┐
│  [样式 ✦] [排列] [动画] [AI 🤖]      │ ← Tab header
├──────────────────────────────────────┤
│                                      │
│  StyleTab / LayoutTab / AnimateTab   │ ← Tab content（按选中元素切换）
│                                      │
└──────────────────────────────────────┘
```

- 无选中元素时：显示「幻灯片属性」（当前页背景色、主题等）
- 有选中元素时：StyleTab 显示该元素的样式属性
- 所有修改调用 `editManager.applyStyleProp(el, prop, val)` → 自动记录 patch

**`StyleTab.tsx` 核心 Props 组：**
```
背景色      [████] #0f172a
文字色      [████] #f1f5f9
字体大小    [──────] 48px
不透明度    [▓▓▓▓░░] 80%
圆角        [▓░░░░░] 8px
```

**`LayoutTab.tsx` 核心 Props 组：**
```
X 偏移      [   0 ] px
Y 偏移      [   0 ] px
对齐:  [← 左] [↔ 中] [→ 右]
       [↑ 顶] [↕ 中] [↓ 底]
层级:  [↑ 置顶] [↓ 置底]
```

### 4.6 `StatusBar` — 状态栏

```tsx
function StatusBar() {
  const { scale } = useSlideStore()
  const { isDirty } = useEditStore()
  return (
    <div className={styles.statusBar}>
      <span>缩放 {Math.round(scale * 100)}%</span>
      {isDirty && <span className={styles.dirty}>● 未保存</span>}
      <span className={styles.hint}>Ctrl+S 保存 · Ctrl+Z 撤销</span>
    </div>
  )
}
```

---

## 5. 状态管理：Zustand

采用 [Zustand](https://zustand.docs.pmnd.rs/) v5，轻量无样板，适合中等复杂度的状态管理。

### 5.1 `slideStore.ts`

```ts
import { create } from 'zustand'

interface SlideState {
  current:   number
  total:     number
  isLoading: boolean
  scale:     number
}

interface SlideActions {
  setCurrent:   (i: number) => void
  setTotal:     (n: number) => void
  setLoading:   (b: boolean) => void
  setScale:     (s: number) => void
}

export const useSlideStore = create<SlideState & SlideActions>(set => ({
  current: 0, total: 0, isLoading: true, scale: 1,
  setCurrent:  (i) => set({ current: i }),
  setTotal:    (n) => set({ total: n }),
  setLoading:  (b) => set({ isLoading: b }),
  setScale:    (s) => set({ scale: s }),
}))
```

### 5.2 `editStore.ts`

```ts
import type { WysiwygPatch } from '@tang-slidex/editor'

interface EditState {
  isActive:   boolean
  selectedEl: Element | null
  patches:    WysiwygPatch[]
  isDirty:    boolean
}

interface EditActions {
  setActive:     (b: boolean) => void
  setSelectedEl: (el: Element | null) => void
  setPatches:    (patches: WysiwygPatch[]) => void
  setDirty:      (b: boolean) => void
}

export const useEditStore = create<EditState & EditActions>(set => ({
  isActive: false, selectedEl: null, patches: [], isDirty: false,
  setActive:     (b)  => set({ isActive: b }),
  setSelectedEl: (el) => set({ selectedEl: el }),
  setPatches:    (p)  => set({ patches: p, isDirty: p.length > 0 }),
  setDirty:      (b)  => set({ isDirty: b }),
}))
```

### 5.3 `uiStore.ts`

```ts
type ViewMode  = 'present' | 'edit'
type RightTab  = 'style' | 'layout' | 'animate' | 'ai'

interface UiState {
  mode:          ViewMode
  leftPanelOpen: boolean
  rightTab:      RightTab
}

interface UiActions {
  setMode:         (m: ViewMode) => void
  toggleLeftPanel: () => void
  setRightTab:     (t: RightTab) => void
}

export const useUiStore = create<UiState & UiActions>(set => ({
  mode: 'present', leftPanelOpen: true, rightTab: 'style',
  setMode:         (m) => set({ mode: m }),
  toggleLeftPanel: () => set(s => ({ leftPanelOpen: !s.leftPanelOpen })),
  setRightTab:     (t) => set({ rightTab: t }),
}))
```

### 5.4 Hooks 封装

**`useSlideRunner.ts`**

```ts
export function useSlideRunner(hostRef: RefObject<HTMLDivElement | null>) {
  const runnerRef = useRef<SlideRunner | null>(null)
  const { setTotal, setCurrent, setLoading } = useSlideStore()

  useEffect(() => {
    if (!hostRef.current) return
    const config = window.__TANG_CONFIG__  // 由 Vite 插件注入的 manifest
    const runner = new SlideRunner({
      container:    hostRef.current,
      slidesDir:    './slides',
      totalSlides:  config.totalSlides,
      onNavigate:   (i) => { setCurrent(i); setLoading(false) },
    })
    runnerRef.current = runner
    setTotal(config.totalSlides)
    runner.navigateTo(initialIndex(), { instant: true })

    return () => { /* cleanup */ }
  }, [])

  return runnerRef
}
```

**`useEditManager.ts`**

```ts
export function useEditManager(
  stageRef: RefObject<HTMLDivElement | null>,
  runnerRef: RefObject<SlideRunner | null>,
) {
  const managerRef = useRef<EditManager | null>(null)
  const { setActive, setSelectedEl, setDirty } = useEditStore()
  const { showToast } = useToast()

  useEffect(() => {
    if (!stageRef.current) return
    const manager = new EditManager({
      slideStage:       stageRef.current,
      getCurrentIndex:  () => useSlideStore.getState().current,
      getCurrentScale:  () => useSlideStore.getState().scale,
      showToast,
      onStateChange:    (active) => setActive(active),
      onElementClick:   (el) => setSelectedEl(el),
      onDragMove:       (el) => { /* 更新 overlay 位置 */ },
      onDragEnd:        () => { /* 隐藏辅助线 */ },
    })
    managerRef.current = manager
    return () => { /* cleanup */ }
  }, [])

  return managerRef
}
```

---

## 6. PWA 方案

### 6.1 技术选型

| 能力 | 方案 | 说明 |
|------|------|------|
| Service Worker | `vite-plugin-pwa`（基于 Workbox） | 自动生成 SW，声明式缓存配置 |
| Manifest | `public/manifest.json` | 支持安装到桌面 / 手机主屏幕 |
| 缓存策略 | App Shell precache + Runtime cache | 见下方详述 |
| 离线保存 | IndexedDB（patch 队列）+ 恢复网络后同步 | 需 Background Sync API |
| 推送通知 | 暂不实现 | Phase 4 预留 |

### 6.2 `manifest.json`

```json
{
  "name": "tang-slidex",
  "short_name": "Slidex",
  "description": "AI 驱动的前端技术栈 PPT 框架",
  "start_url": "/",
  "display": "standalone",
  "orientation": "landscape",
  "theme_color": "#0a0a0f",
  "background_color": "#0a0a0f",
  "categories": ["productivity", "education"],
  "icons": [
    { "src": "/icons/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icons/icon-512.png", "sizes": "512x512", "type": "image/png" },
    { "src": "/icons/icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable" }
  ],
  "screenshots": [
    {
      "src": "/screenshots/editor.png",
      "sizes": "1280x720",
      "type": "image/png",
      "form_factor": "wide",
      "label": "编辑模式三栏布局"
    }
  ]
}
```

### 6.3 缓存策略（vite-plugin-pwa 配置）

```ts
VitePWA({
  registerType: 'autoUpdate',
  includeAssets: ['favicon.ico', 'icons/*.png'],
  manifest: false,  // 使用 public/manifest.json
  workbox: {
    // App Shell：预缓存（随版本更新）
    globPatterns: ['**/*.{js,css,html,woff2,png,svg,ico}'],

    // Runtime Cache
    runtimeCaching: [
      {
        // Slide HTML 文件：NetworkFirst（优先网络，网络失败用缓存）
        urlPattern: /\/slides\/slide-\d+\.html/,
        handler: 'NetworkFirst',
        options: {
          cacheName: 'slides-cache',
          expiration: { maxEntries: 50, maxAgeSeconds: 7 * 24 * 60 * 60 },
        },
      },
      {
        // CDN 资源（GSAP、ECharts、Highlight.js）：CacheFirst
        urlPattern: /^https:\/\/(cdn\.jsdelivr\.net|cdnjs\.cloudflare\.com)/,
        handler: 'CacheFirst',
        options: {
          cacheName: 'cdn-cache',
          expiration: { maxEntries: 30, maxAgeSeconds: 30 * 24 * 60 * 60 },
        },
      },
    ],
  },
})
```

### 6.4 生产模式下的保存

**痛点**：生产构建后没有 Vite dev server，patch 无法通过 `/api/save-slide` 写回本地文件。

**解决方案：File System Access API**

```ts
// platform/web.ts (生产模式)
let dirHandle: FileSystemDirectoryHandle | null = null

export async function openProjectFolder() {
  dirHandle = await window.showDirectoryPicker({ mode: 'readwrite' })
  localStorage.setItem('tang-last-folder', '已授权')
}

export async function saveSlide(index: number, patches: WysiwygPatch[]) {
  if (import.meta.env.DEV) {
    // 开发模式：调用 Vite dev server API
    await fetch('/api/save-slide', { method: 'POST', body: JSON.stringify({ slideIndex: index, patches }) })
  } else {
    // 生产模式：File System Access API 直接写本地文件
    if (!dirHandle) throw new Error('请先打开项目文件夹')
    const slidesDir = await dirHandle.getDirectoryHandle('slides')
    const filename  = `slide-${String(index + 1).padStart(3, '0')}.html`
    const fileHandle = await slidesDir.getFileHandle(filename, { create: false })
    const writable  = await fileHandle.createWritable()
    const file      = await fileHandle.getFile()
    const html      = await file.text()
    const newHtml   = applyPatchesByLine(html, patches)  // 复用 @tang-slidex/editor 的纯函数
    await writable.write(newHtml)
    await writable.close()
  }
}
```

---

## 7. Electron 升级路径（预留）

PWA 与 Electron 共用同一套 React 组件，差异**仅在平台 API 层**（`platform/`）。

### 7.1 平台 API 接口

```ts
// packages/viewer/src/platform/index.ts
export interface PlatformAPI {
  /** 读取 slide HTML（开发：fetch；Electron：IPC） */
  readSlide(index: number): Promise<string>
  /** 写回 patches（开发：POST /api/save-slide；Electron：IPC） */
  savePatches(slideIndex: number, patches: WysiwygPatch[]): Promise<void>
  /** 撤销 */
  undo(slideIndex: number): Promise<void>
  /** 获取 slides 总数 */
  getConfig(): Promise<{ totalSlides: number; title: string }>
  /** 打开本地文件夹（Electron 专属） */
  openFolder?(): Promise<string>
}
```

### 7.2 Web 平台实现

```ts
// platform/web.ts
export const webPlatform: PlatformAPI = {
  async readSlide(i) {
    const res = await fetch(`/slides/slide-${pad(i)}.html?t=${Date.now()}`)
    return res.text()
  },
  async savePatches(index, patches) {
    const res = await fetch('/api/save-slide', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slideIndex: index, patches }),
    })
    if (!res.ok) throw new Error('保存失败')
  },
  async undo(index) {
    await fetch('/api/undo', { method: 'POST', body: JSON.stringify({ slideIndex: index }) })
  },
  async getConfig() {
    return window.__TANG_CONFIG__ ?? { totalSlides: 16, title: 'tang-slidex' }
  },
}
```

### 7.3 Electron 平台实现（预留骨架）

```ts
// platform/electron.ts（未来实现）
export const electronPlatform: PlatformAPI = {
  async readSlide(i) {
    return window.electronAPI.readSlide(i)   // preload expose
  },
  async savePatches(index, patches) {
    return window.electronAPI.savePatches(index, patches)
  },
  async undo(index) {
    return window.electronAPI.undo(index)
  },
  async getConfig() {
    return window.electronAPI.getConfig()
  },
  async openFolder() {
    return window.electronAPI.openFolder()
  },
}
```

### 7.4 新增 Electron 包时的步骤

1. 新增 `packages/viewer-electron/`（Electron 主进程 + preload script）
2. 主进程中复用 `slideSavePlugin` 的纯函数逻辑（`applyPatchesByLine`）处理文件读写
3. `packages/viewer/` 作为 Electron renderer 加载，引入 `platform/electron.ts`
4. `platform/index.ts` 根据 `window.electronAPI` 是否存在自动选择平台

---

## 8. Vite 配置与插件集成

```ts
// packages/viewer/vite.config.ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import {
  slideInspectorPlugin,
  slideSavePlugin,
  slideUndoPlugin,
} from '@tang-slidex/editor/vite-plugins'

export default defineConfig({
  root: '.',
  resolve: {
    alias: { '@': '/src' },
  },
  server: {
    port: 3000,
    watch: { include: ['slides/**'] },
  },
  plugins: [
    react(),
    slideInspectorPlugin(),  // ① 行号注入（开发模式）
    slideSavePlugin(),         // ② 行级写回
    slideUndoPlugin(),         // ③ 撤销
    VitePWA({ /* 见第 6 节 */ }),
  ],
  build: {
    rollupOptions: {
      output: {
        // 拆分 vendor chunks，改善缓存命中率
        manualChunks: {
          'react-vendor': ['react', 'react-dom'],
          'zustand':      ['zustand'],
          'dnd-kit':      ['@dnd-kit/core', '@dnd-kit/sortable'],
        },
      },
    },
  },
})
```

---

## 9. 迁移策略

### 9.1 渐进式迁移，不破坏现有示例

- `examples/tech-intro/index.html` 继续保留，作为**最简参考实现**（无框架纯 HTML 展示 tang-slidex 的零依赖特性）
- 新建 `packages/viewer/` 作为**正式标准实现**
- 两者共享同一套 `slides/*.html`，不需要改 slide 文件格式

### 9.2 分阶段实施计划

| 阶段 | 目标 | 关键产出 | 预估周期 |
|------|------|---------|---------|
| **Phase 1** | 脚手架搭建 | React + Vite + Zustand + PWA 骨架；能跑起来 | 1 天 |
| **Phase 2** | 演示模式完整可用 | TopBar + StageArea + NavBar + 键盘翻页；SlideRunner 接入 | 1 天 |
| **Phase 3** | 编辑模式骨架 | TopBar 工具组 + EditManager 接入 + 选中框 + patch 保存 | 1 天 |
| **Phase 4** | 左侧 SlidePanel | iframe 缩略图 + 点击跳转 + 当前页高亮 | 1 天 |
| **Phase 5** | 右侧 RightPanel | StyleTab + LayoutTab + 与 EditManager 联动 | 2 天 |
| **Phase 6** | PWA 完整配置 | Manifest + SW + 离线测试 + 安装提示 | 1 天 |
| **Phase 7** | 拖拽排序 + AI Tab | dnd-kit 排序 + SelectionManager + AI 侧边栏占位 | 2 天 |

### 9.3 旧版 `index.html` 的定位调整

迁移完成后，`examples/tech-intro/index.html` 精简为：
- 保留 SlideRunner 加载逻辑（~100 行）
- 保留最基础的导航 UI（上一页/下一页/页码）
- **移除** EditUI / PropsPanel / EditManager 等编辑逻辑（这些统一由 `packages/viewer` 承担）
- 作为"tang-slidex 无框架展示示例"，体现框架的零依赖特性

---

## 10. 技术选型汇总

| 模块 | 技术 | 版本 | 理由 |
|------|------|------|------|
| UI 框架 | React | 19.x | 生态成熟，Electron 兼容，与未来路径一致 |
| TypeScript | TypeScript | 5.x | 全量类型安全 |
| 构建工具 | Vite | 6.x | 已在用，插件体系沿用 |
| 状态管理 | Zustand | 5.x | 轻量无样板，适合中等复杂度 |
| 样式方案 | CSS Modules | — | 不引入 Tailwind，减少包体；与 slide 样式隔离 |
| PWA | vite-plugin-pwa | 0.21.x | 基于 Workbox，声明式缓存配置 |
| 缩略图（MVP） | `<iframe>` + CSS scale | — | 最简实现，零额外依赖 |
| 拖拽排序 | @dnd-kit/core | 6.x | 轻量、无障碍友好、无 jQuery 依赖 |
| 图标 | lucide-react | — | SVG 图标，按需 tree-shake |
| 单元测试 | Vitest + React Testing Library | — | 与 Vite 生态统一 |

---

## 11. 约束与注意事项

1. **slide HTML 文件格式不变**：所有 `slides/*.html` 是纯 HTML，viewer 只是消费者，不修改 slide 格式规范

2. **`EditManager` 保持命令式**：不重写为 React 组件，通过 hook + ref 桥接；这样 `@tang-slidex/editor` 包可以独立在无 React 环境中使用

3. **`slide-host` 不进入 React VDOM**：`<div id="slide-host">` 的内容由 SlideRunner 全权管理，React 只管理外层布局。选中框（`SelectionOverlay`）是 React 组件，但定位通过 `getBoundingClientRect` + absolute 实现

4. **Scale 计算需适配三栏布局**：原来 `scale = min(window.innerWidth, window.innerHeight)` 不再适用，需改为 `ResizeObserver` 监听中间舞台容器的实际宽高

5. **PWA 生产模式保存**：File System Access API 仅支持 Chrome/Edge，Safari 和 Firefox 支持有限。未来 Electron 版本可绕过此限制

6. **演示模式性能**：演示模式切换时，React 卸载 SlidePanel 和 RightPanel 组件，避免 16 个 iframe 缩略图占用内存/CPU

7. **首屏加载**：React + Zustand + dnd-kit bundle 约 150-200KB gzip，需配合 code splitting 和 PWA precache 保证首次访问速度

---

## 12. 实际实现与方案差异（落地记录）

> 本节记录重构完成后与原方案的关键偏差，作为后续维护参考。

### 12.1 居中方案：CSS Flex 替代 JS 计算 top/left

**原方案**：JS 手动计算 `left = (containerW - 1280*s) / 2`，设置 `position: absolute`。  
**实际实现**：改为 CSS Flexbox 居中，JS 只设 `transform: scale(s)`：

```css
/* StageArea.module.css */
.stageCanvas {
  display: flex;
  align-items: center;
  justify-content: center;
}
#slide-host {
  width: 1280px; height: 720px;
  flex-shrink: 0;
  transform-origin: center center;
}
```

**原因**：JS 计算 `top/left` 在模式切换时存在时序问题（ResizeObserver 不会因 mode 改变重新触发），且 CSS flex 居中更可靠。

### 12.2 缩放系数：1.0（不留边距）

**原方案**：`scale * 0.96`（留 4% 边距）。  
**实际实现**：`scale = min(containerW/1280, containerH/720) * 1.0`（铺满）。

演示模式下 PPT 应尽可能铺满视口，编辑模式下由右侧面板的固定宽度自然限制了舞台宽度，无需额外留边。

### 12.3 slideInspectorPlugin 路径参数化

**原方案**：插件内硬编码 `path.join(process.cwd(), urlPath)`。  
**实际实现**：新增 `slidesRoot` 参数，由 `vite.config.ts` 传入绝对路径：

```typescript
slideInspectorPlugin({ slidesRoot: path.resolve(__dirname, '../../examples/tech-intro/slides') })
```

**原因**：viewer 的 `process.cwd()` 是 `packages/viewer/`，而 slides 文件在 `examples/tech-intro/slides/`，路径不匹配导致行号注入失败、编辑链路断裂。

**同时注意插件顺序**：`slideInspectorPlugin` 必须注册在 `slidesProxyPlugin` 之前，否则 proxy 先截获请求，注入不生效。

### 12.4 examples/tech-intro 简化

重构完成后，`examples/tech-intro/` 的 `index.html`（1376 行）和 `vite.config.js` 已删除，所有功能由 `packages/viewer` 承接。该目录现在只保留：

```
examples/tech-intro/
├── package.json   ← tang-slidex 元数据（totalSlides / title / theme）
└── slides/        ← PPT HTML 源文件（16 页）
```

### 12.5 换页保持编辑状态

**原方案**：方案文档未详细说明。  
**实际实现**：

1. `useSlideRunner` 换页成功后 dispatch `tang:slide-loaded` 自定义事件
2. `useEditManager` 监听该事件：清空 `selectedEl` + `mgr.rebind()`（双重 rAF 等脚本执行完）
3. `EditManager.rebind()` 已存在于 editor 包中（`_cleanup(false)` + `_bindSlide()`）

这样换页后编辑模式保持 active，新 DOM 上的元素可立即被选中和编辑。
