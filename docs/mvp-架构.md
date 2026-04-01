# tang-slidex MVP 架构文档

> **文档状态**：Updated  
> **作者**：jiaoxinheng  
> **最后更新**：2026-04-02  
> **版本**：MVP v0.2（Viewer 重构后）

---

## 目录

1. [产品定位](#1-产品定位)
2. [MVP 已实现功能清单](#2-mvp-已实现功能清单)
3. [整体架构分层](#3-整体架构分层)
4. [工程结构](#4-工程结构)
5. [核心模块详解](#5-核心模块详解)
   - 5.1 `@tang-slidex/viewer` — 展示交互层（React SPA）
   - 5.2 `@tang-slidex/editor` — 编辑引擎
   - 5.3 `@tang-slidex/core` — 运行时规范
   - 5.4 `@tang-slidex/skills` — Skill 体系
6. [渲染方案](#6-渲染方案)
7. [主题系统](#7-主题系统)
8. [PPT 规范约束](#8-ppt-规范约束)
9. [编辑模式（Edit Mode）](#9-编辑模式edit-mode)
10. [数据流与 Agent 协作](#10-数据流与-agent-协作)
11. [技术栈一览](#11-技术栈一览)
12. [尚未实现（规划中）](#12-尚未实现规划中)

---

## 1. 产品定位

**tang-slidex** 是一个"把 AI Agent 当成 PPT 设计师、把浏览器当成 PPT 播放器"的开源幻灯片框架。

核心设计哲学：
- **AI Agent 原生**：幻灯片的内容、样式、动画均由 AI Agent 生成 HTML 片段，不是 Markdown 渲染，而是直接的 HTML/CSS/JS
- **前端技术栈**：每一页 slide 就是一个独立的 HTML 文件，具备完整的前端表达能力（ECharts、GSAP 动画、自定义 CSS 等）
- **可视化编辑**：浏览器内 WYSIWYG，拖拽移动 + 文字编辑 + 行级写回源文件，零格式损耗
- **零依赖分发**：最终可导出为单个自包含 HTML 文件（规划中）
- **Skill 驱动**：通过 Skill 体系约束 Agent 的生成行为，保证质量

---

## 2. MVP 已实现功能清单

| 功能模块 | 状态 | 说明 |
|---------|------|------|
| **展示交互层（packages/viewer）** | ✅ 已实现 | React 19 + Zustand + PWA，三栏编辑器布局 |
| 幻灯片加载 & 渲染 | ✅ 已实现 | fetch + DOMParser 直接 DOM 注入，支持 script 执行 |
| 自适应缩放 | ✅ 已实现 | ResizeObserver + CSS flex 居中，scale 自适应容器 |
| 键盘控制 | ✅ 已实现 | 方向键/空格切换，E 编辑，Ctrl+S/Z |
| 点击翻页（演示模式） | ✅ 已实现 | 点击 slide 空白区域翻页，交互元素（表格/代码块/按钮）不触发 |
| URL Hash 同步 | ✅ 已实现 | `#0` `#1` ... 标记当前页 |
| 演示/编辑模式切换 | ✅ 已实现 | TopBar 模式切换，演示全屏 / 编辑三栏 |
| 右侧属性面板 | ✅ 已实现 | 样式（颜色/字号/背景/圆角/透明度）+ 布局（位移/对齐/层级） |
| 左侧 Slide 缩略图 | ✅ 已实现 | 展示 slide 列表，可点击跳转 |
| Vite HMR 热更新 | ✅ 已实现 | 保存 slide HTML 后浏览器自动重载当前页 |
| 代码块高亮 | ✅ 已实现 | highlight.js 语法高亮 |
| **编辑引擎（packages/editor）** | ✅ 已实现 | EditManager + Vite 插件 |
| 行号注入（slideInspectorPlugin） | ✅ 已实现 | 开发服务器拦截 slide 请求，注入 `data-tang-line` |
| 行级写回（slideSavePlugin） | ✅ 已实现 | POST /api/save-slide，精确行级替换，零格式损耗 |
| 撤销支持（slideUndoPlugin） | ✅ 已实现 | POST /api/undo，内存历史栈还原 |
| WYSIWYG 文字编辑 | ✅ 已实现 | contenteditable，blur 时记录 TextPatch |
| 元素拖拽移动 | ✅ 已实现 | CSS transform translate，scale 坐标换算 |
| 样式属性编辑 | ✅ 已实现 | font-size/color/opacity/border-radius/z-index 等 |
| 元素删除 | ✅ 已实现 | display:none + DeletePatch |
| 换页保持编辑状态 | ✅ 已实现 | tang:slide-loaded 事件，rebind() 重新绑定新 DOM |
| **Skill 体系** | ✅ 已实现 | — |
| Agent Skill - ppt-standards | ✅ 已实现 | 约束 Agent 生成规范的 slide HTML |
| Agent Skill - slide-generator | ✅ 已实现 | 逐页 HTML 生成 SOP + 5 种模板 |
| 用户 Skill - ppt-brainstorm | ✅ 已实现 | 帮用户梳理 PPT 立意和结构 |
| 示例项目（tech-intro） | ✅ 已实现 | 16 页完整 PPT 示例 |
| 构建工具（builder） | ⏳ 规划中 | 单文件 HTML 打包 + PDF 导出 |

---

## 3. 整体架构分层

```
┌─────────────────────────────────────────────────────────────────┐
│                        用户 / AI Agent                           │
│               自然语言 → content.md → execution.md              │
└───────────────────────────┬─────────────────────────────────────┘
                             │
┌───────────────────────────▼─────────────────────────────────────┐
│                  Skill 层（@tang-slidex/skills）                  │
│  ppt-brainstorm（用户引导）  |  ppt-standards / slide-generator   │
└───────────────────────────┬─────────────────────────────────────┘
                             │  slide-NNN.html（逐页生成）
┌───────────────────────────▼─────────────────────────────────────┐
│             展示交互层（@tang-slidex/viewer）                     │
│                    React 19 + PWA + Zustand                      │
│                                                                   │
│  ┌──────────┐  ┌──────────────────────────────┐  ┌───────────┐  │
│  │SlidePanel│  │        StageArea              │  │RightPanel │  │
│  │左侧缩略图│  │  1280×720 CSS flex 居中       │  │样式/布局  │  │
│  │          │  │  scale 自适应，直接 DOM 注入   │  │属性面板   │  │
│  └──────────┘  └──────────────────────────────┘  └───────────┘  │
│                                                                   │
│  TopBar（模式切换）  NavBar（翻页）  StatusBar（状态栏）          │
└───────────────────────────┬─────────────────────────────────────┘
                             │ hooks: useEditManager
┌───────────────────────────▼─────────────────────────────────────┐
│             编辑引擎（@tang-slidex/editor）                       │
│                                                                   │
│  EditManager（WYSIWYG）         SelectionManager（AI 辅助）       │
│  ├─ _bindSlide()               └─ 选区上下文信号                  │
│  ├─ applyStyleProp / move                                         │
│  └─ rebind()（换页重新绑定）                                       │
│                                                                   │
│  Vite Plugins                                                     │
│  ├─ slideInspectorPlugin → data-tang-line 行号注入                │
│  ├─ slideSavePlugin      → POST /api/save-slide 行级写回          │
│  └─ slideUndoPlugin      → POST /api/undo 历史栈还原              │
└───────────────────────────┬─────────────────────────────────────┘
                             │
┌───────────────────────────▼─────────────────────────────────────┐
│         PPT 内容（examples/tech-intro/slides/）                  │
│         slide-001.html … slide-016.html                          │
└─────────────────────────────────────────────────────────────────┘
```

---

## 4. 工程结构

```
tang-slidex/                         ← Monorepo 根
├── packages/
│   ├── viewer/                      ← @tang-slidex/viewer（展示交互层，已实现）
│   │   ├── src/
│   │   │   ├── components/
│   │   │   │   ├── TopBar/          ← 模式切换按钮
│   │   │   │   ├── SlidePanel/      ← 左侧缩略图面板
│   │   │   │   ├── StageArea/       ← 中间舞台 + NavBar
│   │   │   │   ├── RightPanel/      ← 右侧属性面板（StyleTab / LayoutTab）
│   │   │   │   └── StatusBar/       ← 底部状态栏
│   │   │   ├── hooks/
│   │   │   │   ├── useSlideRunner.ts   ← slide 加载 / 切换 / HMR
│   │   │   │   ├── useEditManager.ts   ← EditManager 生命周期 + 选中联动
│   │   │   │   └── useResizeObserver.ts
│   │   │   ├── store/
│   │   │   │   ├── slideStore.ts    ← current / total / scale
│   │   │   │   ├── editStore.ts     ← active / selectedEl / dirty
│   │   │   │   └── uiStore.ts       ← mode / showToast
│   │   │   └── App.tsx              ← 根布局（Grid：编辑三栏 / 演示全屏）
│   │   └── vite.config.ts           ← 插件集成：inspector + save + undo + proxy
│   │
│   ├── editor/                      ← @tang-slidex/editor（编辑引擎，已实现）
│   │   └── src/
│   │       ├── editManager.ts       ← WYSIWYG 编辑管理器
│   │       ├── selectionManager.ts  ← AI 辅助编辑选区管理
│   │       ├── patchHelpers.ts      ← getAnchor / cleanInjectAttrs
│   │       ├── types.ts             ← WysiwygPatch / AgentEditContext 等
│   │       └── vite-plugins/
│   │           ├── slideInspectorPlugin.ts  ← 行号注入（slidesRoot 参数化）
│   │           └── slideSavePlugin.ts       ← 行级写回 + 撤销
│   │
│   ├── core/                        ← @tang-slidex/core（运行时规范）
│   │   └── src/
│   │       ├── standards/           ← SLIDE_STANDARDS 规范常量
│   │       ├── theme/               ← 4 套内置主题 + injectTheme
│   │       └── styles/              ← base.css
│   │
│   └── skills/                      ← @tang-slidex/skills
│       ├── agent/
│       │   ├── ppt-standards/
│       │   └── slide-generator/
│       └── user/
│           └── ppt-brainstorm/
│
├── examples/
│   └── tech-intro/                  ← 16 页示例 PPT
│       ├── package.json             ← 元数据（totalSlides / title / theme）
│       └── slides/                  ← slide HTML 内容（唯一保留的内容）
│           ├── slide-001.html       ← 封面页
│           └── ...slide-016.html
│
├── docs/
├── turbo.json
├── pnpm-workspace.yaml
└── package.json                     ← 根 dev 脚本 → pnpm --filter @tang-slidex/viewer dev
```

**构建工具链**：
- 包管理：`pnpm` + `pnpm workspace`
- Monorepo 编排：`Turborepo`
- Viewer 开发：`Vite 6` + `React 19`
- 状态管理：`Zustand`
- 编辑器构建：`tsup`（ESM + `.d.ts`）

---

## 5. 核心模块详解

### 5.1 `@tang-slidex/viewer` — 展示交互层

React 19 SPA，是用户唯一的入口（`pnpm dev`）。

**两种布局模式（CSS Grid）：**

| 模式 | 布局 | 触发 |
|------|------|------|
| `present`（演示） | 单列全屏：TopBar + Stage + StatusBar | 默认 / E 键切换 |
| `edit`（编辑） | 三栏：SlidePanel + Stage + RightPanel | E 键 / TopBar 按钮 |

**核心 Hook：`useSlideRunner`**

```typescript
function init(cfg: { totalSlides, slidesDir })  // 初始化，加载第一页
function navigateTo(index, opts?)               // 跳转到指定页
function next() / prev()                         // 翻页
```

- `tang:slide-loaded` 自定义事件：换页完成后 dispatch，通知 EditManager rebind

**核心 Hook：`useEditManager`**

- 在 `#slide-host` 上监听 `mousedown`，向上找 `.slide` 直接子元素 → 设为 `selectedEl`
- 监听 `tang:slide-loaded` → `mgr.rebind()`（换页后重新绑定新 DOM）
- `onDragMove` → 更新选中框位置 + 对齐辅助线
- `onStateChange(false)` → 清空 `selectedEl`，隐藏 overlay

---

### 5.2 `@tang-slidex/editor` — 编辑引擎

与 React 解耦，纯 DOM 操作。

**`EditManager` 核心 API：**

| 方法 | 说明 |
|------|------|
| `enable()` | 进入编辑模式，调用 `_bindSlide()` |
| `disable()` | 退出编辑模式，还原所有快照 |
| `rebind()` | 换页后重新绑定（保持 active=true） |
| `applyStyleProp(el, prop, val)` | 应用样式属性，记录 StylePropPatch |
| `save()` | POST /api/save-slide |
| `undo()` | POST /api/undo |

**`_bindSlide()` 做了什么：**
1. 给叶子文本节点加 `contenteditable`
2. 给 `.slide` 直接子元素加 `mousedown`（拖拽）
3. 给 `pre code` 绑定代码块 textarea 编辑器

**Vite 插件（slidesRoot 参数化）：**

```typescript
// vite.config.ts 里的正确配置
const SLIDES_ROOT = path.resolve(__dirname, '../../examples/tech-intro/slides')

plugins: [
  slideInspectorPlugin({ slidesRoot: SLIDES_ROOT }), // ← 必须在 proxy 前面
  slideSavePlugin({ slidesRoot: SLIDES_ROOT }),
  slideUndoPlugin({ slidesRoot: SLIDES_ROOT }),
  slidesProxyPlugin(SLIDES_ROOT),                    // fallback
]
```

> ⚠️ **顺序要求**：`slideInspectorPlugin` 必须在 `slidesProxyPlugin` 之前注册，否则 proxy 会先截获请求，行号注入不生效。

**行号注入机制：**

```html
<!-- 注入前 -->
<div class="slide-title">标题</div>

<!-- 注入后（仅内存，不写回源文件）-->
<div class="slide-title" data-tang-line="42" data-tang-file="slides/slide-003.html">标题</div>
```

**行级写回流程：**

```
Ctrl+S
  → EditManager.save()
  → POST /api/save-slide { slideIndex, patches: WysiwygPatch[] }
  → slideSavePlugin：
      1. 读取 slide-NNN.html
      2. applyPatchesByLine(html, patches)  ← 按 data-tang-line 定位，行级替换
      3. cleanInjectAttrs(html)              ← 移除 data-tang-* 防止污染源文件
      4. fs.writeFileSync 写回
  → Vite HMR → tang-slide-update 事件 → 浏览器重载当前页
```

---

### 5.3 `@tang-slidex/core` — 运行时规范

提供规范常量和主题系统，供 slide HTML 和 Skill 引用。

```typescript
export { SLIDE_STANDARDS }   // 1280×720 / 安全区 / 字号规范 / 动画时长
export { themes, defaultTheme, injectTheme }
```

---

### 5.4 `@tang-slidex/skills` — Skill 体系

| Skill | 类型 | 功能 |
|-------|------|------|
| `ppt-standards` | Agent SOP | HTML 结构规范、尺寸约束、禁止事项 |
| `slide-generator` | Agent SOP | 逐页生成 SOP + 5 种页面模板 |
| `ppt-brainstorm` | 用户引导 | 3 步引导梳理 PPT 立意，输出 content.md |

---

## 6. 渲染方案

`packages/viewer` 采用 **fetch + DOMParser + 直接 DOM 注入** 方案：

```
fetch(`./slides/slide-NNN.html?t=${Date.now()}`)
  → DOMParser 解析
  → 注入 <style> 到 #slide-host
  → 注入 body 节点到 #slide-host（跳过 <script>）
  → requestAnimationFrame → new Function(scriptCode)()
  → highlight.js 高亮代码块
  → dispatch tang:slide-loaded 事件
```

**为什么不用 Shadow DOM？**

EditManager 需要直接操作 slide 内的 DOM 元素（`getBoundingClientRect`、`contentEditable`、事件绑定），Shadow DOM 的封闭性会阻碍这一点。

---

## 7. 主题系统

4 套内置主题（CSS 变量注入 `#slide-host`）：

| 主题名 | 风格 | 主色 |
|--------|------|------|
| `corporate-blue` | 商务蓝 | `#1a56db` |
| `dark-tech` | 暗色科技 | `#7c3aed` |
| `minimal` | 极简 | `#171717` |
| `vibrant` | 活力橙 | `#f97316` |

---

## 8. PPT 规范约束

```
页面尺寸：1280 × 720 px（16:9）
安全区：  top/bottom 48px，left/right 64px

字号规范：
  主标题   52px / 700
  副标题   32px / 500
  正文     22px / 400

每页文字 ≤ 150 字，要点 ≤ 5 条，留白 ≥ 30%
入场动画 300-600ms，ease / power2.out
```

---

## 9. 编辑模式（Edit Mode）

| 功能 | 交互方式 | 实现 |
|------|---------|------|
| 文本内联编辑 | 点击文字区域直接输入 | `contenteditable="true"` + blur → TextPatch |
| 元素拖拽移动 | 拖动块级元素 | `transform: translate(dx, dy)` + MovePatch |
| 样式属性修改 | 右侧面板输入 | `tang:apply-style` 事件 → StylePropPatch |
| 对齐辅助线 | 拖拽接近中轴自动出现 | 橙色 1px fixed 线 |
| 选中框 | 点击元素 | 蓝色 fixed 边框 + 元素标签 |
| 元素删除 | 右键或工具栏 ✕ | `display:none` + DeletePatch |
| 取消还原 | `Esc` | 从 `snapshots` Map 还原 |
| 保存回写 | `Ctrl+S` | 行级写回，格式零损耗 |
| 撤销 | `Ctrl+Z` | POST /api/undo，文件级回滚 |
| 换页保持编辑 | 自动 | tang:slide-loaded → rebind() |

---

## 10. 数据流与 Agent 协作

```
用户输入（自然语言）
      │
      ▼  [ppt-brainstorm Skill]
content.md（立意摘要 + 内容大纲）
      │
      ▼  [slide-generator Skill + ppt-standards Skill]
examples/<project>/slides/
  ├── slide-001.html   ← Agent 生成
  └── ... slide-NNN.html
      │
      ├─▶ [pnpm dev]  → localhost:3000（packages/viewer）
      │     演示模式：浏览 PPT
      │     编辑模式：可视化编辑 → Ctrl+S 写回源文件
      │
      └─▶ [规划中] pnpm build
            → 单文件 HTML 打包
            → PDF 导出
```

---

## 11. 技术栈一览

| 分类 | 技术 | 版本 |
|------|------|------|
| 包管理 | pnpm + workspace | 9.x |
| Monorepo 编排 | Turborepo | 2.x |
| UI 框架 | React | 19.x |
| 状态管理 | Zustand | 5.x |
| PWA | vite-plugin-pwa | 0.21.x |
| 开发服务器 | Vite | 6.x |
| 语言 | TypeScript | 5.7 |
| 动画库（全局） | GSAP | 3.12 |
| 图表库（全局） | ECharts | 5.5 |
| 代码高亮 | highlight.js | 11.11 |
| 测试 | Vitest | 3.x |

---

## 12. 尚未实现（规划中）

| 模块 | 计划功能 |
|------|---------|
| `@tang-slidex/builder` | HTML 内联打包（单文件导出）、Puppeteer PDF 导出、CLI |
| 浮动工具栏 | 选中元素后浮动显示 B/I/U/字号/颜色/对齐按钮 |
| AI 辅助编辑 | SelectionManager + AI 侧边栏（Phase 3） |
| Agent Skill - `ppt-outline` | content.md → execution.md 结构化执行计划 |
| Agent Skill - `chart-integration` | ECharts/AntV/VisActor 集成 SOP |
| 模板库 | business-report / pitch-deck / minimal 等 |
| 多比例支持 | 4:3、A4 尺寸 |
