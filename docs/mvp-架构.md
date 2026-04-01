# tang-slidex MVP 架构文档

> **文档状态**：Draft  
> **作者**：jiaoxinheng  
> **最后更新**：2026-04-01  
> **版本**：MVP v0.0.1

---

## 目录

1. [产品定位](#1-产品定位)
2. [MVP 已实现功能清单](#2-mvp-已实现功能清单)
3. [整体架构分层](#3-整体架构分层)
4. [工程结构](#4-工程结构)
5. [核心模块详解](#5-核心模块详解)
   - 5.1 `@tang-slidex/core` — 运行时引擎
   - 5.2 `@tang-slidex/skills` — Skill 体系
   - 5.3 `examples/tech-intro` — 示例宿主应用
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
- **零依赖分发**：最终可导出为单个自包含 HTML 文件（规划中）
- **Skill 驱动**：通过 Skill 体系约束 Agent 的生成行为，保证质量

---

## 2. MVP 已实现功能清单

| 功能模块 | 状态 | 说明 |
|---------|------|------|
| 幻灯片运行时引擎（SlideRunner） | ✅ 已实现 | fetch + Shadow DOM 渲染，页面切换导航 |
| 键盘控制 | ✅ 已实现 | 方向键/空格切换，F 全屏，Esc 退出全屏 |
| 页面切换动画 | ✅ 已实现 | fade / slide / zoom / none，GSAP 驱动，CSS fallback |
| URL Hash 同步 | ✅ 已实现 | `#0` `#1` ... 标记当前页 |
| 主题系统 | ✅ 已实现 | 4 套内置主题，CSS 变量注入 Shadow DOM |
| PPT 规范常量库 | ✅ 已实现 | 尺寸、排版、动画时长等约束 |
| 基础样式库（base.css） | ✅ 已实现 | 规范字号、布局类、动画类 |
| 浏览器内可视化编辑（Edit Mode） | ✅ 已实现 | 双击文字编辑、拖拽移动、删除、Ctrl+S 回写 |
| Vite HMR 热更新 | ✅ 已实现 | 保存 slide HTML 后浏览器自动刷新当前页 |
| 代码块 Viewer 高亮 | ✅ 已实现 | highlight.js 语法高亮 |
| Agent Skill - ppt-standards | ✅ 已实现 | 约束 Agent 生成规范的 slide HTML |
| Agent Skill - slide-generator | ✅ 已实现 | 逐页 HTML 生成 SOP + 5 种模板 |
| 用户 Skill - ppt-brainstorm | ✅ 已实现 | 帮用户梳理 PPT 立意和结构 |
| 示例项目（tech-intro） | ✅ 已实现 | 16 页完整 PPT 示例 |
| 构建工具（builder） | ⏳ 规划中 | 单文件 HTML 打包 + PDF 导出 |
| IDE 编辑器（editor） | ⏳ 规划中 | 三栏 Electron IDE |

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
│                                                                   │
│  ┌─────────────────────────┐   ┌──────────────────────────────┐  │
│  │   用户引导 Skills        │   │   Agent 技术 SOP Skills      │  │
│  │  ppt-brainstorm         │   │  ppt-standards               │  │
│  │  （立意/受众/核心观点）  │   │  slide-generator             │  │
│  └─────────────────────────┘   │  （5 种模板 + 生成检查清单）  │  │
│                                 └──────────────────────────────┘  │
└───────────────────────────┬─────────────────────────────────────┘
                             │  slide-NNN.html（逐页生成）
┌───────────────────────────▼─────────────────────────────────────┐
│                  核心层（@tang-slidex/core）                       │
│                                                                   │
│  ┌─────────────────┐  ┌──────────────────┐  ┌────────────────┐  │
│  │  SlideRunner    │  │  SLIDE_STANDARDS │  │  Theme Engine  │  │
│  │  导航 / 切换    │  │  尺寸/字体/布局  │  │  CSS 变量注入  │  │
│  │  动画 / Hash    │  │  规范常量        │  │  4 套内置主题  │  │
│  └─────────────────┘  └──────────────────┘  └────────────────┘  │
│                                                                   │
│  ┌──────────────────────────────────────────────────────────┐    │
│  │  渲染引擎：fetch + 直接 DOM 注入（示例中）               │    │
│  │  SlideRunner 版：fetch + Shadow DOM 隔离                  │    │
│  └──────────────────────────────────────────────────────────┘    │
└───────────────────────────┬─────────────────────────────────────┘
                             │
┌───────────────────────────▼─────────────────────────────────────┐
│                宿主应用（examples/tech-intro）                    │
│                                                                   │
│  index.html                                                       │
│  ├─ 全局库加载（GSAP + ECharts + highlight.js）                   │
│  ├─ 主题 CSS 变量注入                                             │
│  ├─ 幻灯片导航逻辑（navigateTo）                                  │
│  ├─ EditManager（浏览器内可视化编辑）                             │
│  ├─ CodeBoxManager（代码块 IDE 模式）                             │
│  └─ Vite HMR Client（WebSocket 监听热更新）                       │
│                                                                   │
│  vite.config.js                                                   │
│  ├─ slideHmrPlugin（监听 slides/*.html 变化推送 HMR）             │
│  └─ slideSavePlugin（中间件 POST /api/save-slide，JSDOM patch 回写）│
└─────────────────────────────────────────────────────────────────┘
```

---

## 4. 工程结构

```
tang-slidex/                         ← Monorepo 根
├── packages/
│   ├── core/                        ← @tang-slidex/core（已实现）
│   │   └── src/
│   │       ├── runner/              ← SlideRunner.ts
│   │       ├── standards/           ← SLIDE_STANDARDS 规范常量
│   │       ├── theme/               ← Theme 类型 + 4套主题 + injectTheme
│   │       ├── styles/              ← base.css（规范基础样式）
│   │       └── index.ts             ← 公开 API 入口
│   │
│   └── skills/                      ← @tang-slidex/skills（已实现）
│       ├── agent/
│       │   ├── ppt-standards/       ← Agent SOP：HTML 规范约束
│       │   └── slide-generator/     ← Agent SOP：逐页生成 + 5种模板
│       └── user/
│           └── ppt-brainstorm/      ← 用户引导：立意梳理
│
├── examples/
│   └── tech-intro/                  ← 完整示例项目（16页PPT）
│       ├── index.html               ← 宿主页（含EditManager、全局库加载）
│       ├── vite.config.js           ← Vite + HMR Plugin + Save Plugin
│       ├── package.json             ← tang-slidex 配置（主题、总页数等）
│       └── slides/
│           ├── slide-001.html       ← 封面页
│           ├── slide-002.html       ← 目录页
│           └── ...slide-016.html   ← 共 16 页独立 HTML
│
├── docs/                            ← 文档
├── turbo.json                       ← Turborepo 任务编排
├── pnpm-workspace.yaml
└── package.json
```

**构建工具链**：
- 包管理：`pnpm` + `pnpm workspace`  
- Monorepo 编排：`Turborepo`（任务缓存 + 并行构建）  
- Core 构建：`tsup`（ESM + `.d.ts`）  
- 示例开发：`Vite 6`

---

## 5. 核心模块详解

### 5.1 `@tang-slidex/core` — 运行时引擎

**对外暴露的 API：**

```typescript
// 规范常量
export { SLIDE_STANDARDS }
export type { AspectRatio, SlideType, TransitionType }

// 运行时引擎
export { SlideRunner }
export type { SlideRunnerOptions, NavigateOptions }

// 主题系统
export { themes, defaultTheme, injectTheme, getComputedTheme }
export type { Theme }
```

#### `SlideRunner` 核心能力

| 方法 | 说明 |
|------|------|
| `navigateTo(index, opts)` | 核心导航，重建 Shadow DOM + 执行入场动画 |
| `next() / prev()` | 前进/后退 |
| `currentIndex / total` | 状态读取 |

**内部机制：**
1. `fetchSlide(url)` — 支持两种模式：
   - **开发模式**：`fetch(url)` 直接请求 `slides/slide-NNN.html`
   - **内联模式（build后）**：从 `window.__TANG_SLIDES__` 读取预内联数据
2. `executeScripts(shadow)` — 手动重建 Shadow DOM 内的 `<script>` 标签（浏览器不自动执行）
3. `playEnterAnimation(root, type)` — 优先使用全局 GSAP，降级为纯 CSS transition

**键盘快捷键（自动绑定）：**

| 按键 | 行为 |
|------|------|
| `→` / `Space` | 下一页 |
| `←` | 上一页 |
| `↑` | 跳到第一页 |
| `↓` | 跳到最后一页 |
| `F` | 全屏 |
| `Esc` | 退出全屏 |

---

### 5.2 `@tang-slidex/skills` — Skill 体系

Skill 体系分两类：

#### Agent Skills（面向 AI Agent 的技术 SOP）

| Skill | 触发时机 | 核心内容 |
|-------|---------|---------|
| `ppt-standards` | Agent 生成/修改 slide HTML 前 | HTML 结构规范、尺寸约束（1280×720px）、字体规范、动画规范、ECharts 用法、禁止事项 |
| `slide-generator` | Agent 逐页生成 slide-NNN.html 时 | 生成工作流 SOP + 5种页面模板（cover/toc/content/data-chart/ending）+ 检查清单 |

#### User Skills（面向用户的引导）

| Skill | 触发时机 | 核心内容 |
|-------|---------|---------|
| `ppt-brainstorm` | 用户想做 PPT 但思路不清晰 | 3步引导（了解信息→挖掘核心观点→诊断混乱），输出立意摘要到 content.md |

---

### 5.3 `examples/tech-intro` — 示例宿主应用

这是当前 MVP 唯一完整的应用实现，包含以下能力（均在 `index.html` 中实现）：

#### 渲染层

- 使用 `DOMParser` 解析 HTML，将 `<style>` 和内容节点直接注入到 `#slide-host`（**非 Shadow DOM**，与 core 包中的 SlideRunner 方案不同）
- 脚本通过 `new Function(code)()` 执行，避免 Shadow DOM 脚本限制
- 页面切换时通过 CSS scale 适配窗口尺寸

#### 全局库

```html
<!-- 全局加载，所有 slide HTML 内可直接使用 -->
<script src="gsap@3.12.5"></script>       <!-- GSAP 动画 -->
<script src="echarts@5.5.0"></script>     <!-- 数据图表 -->
<script src="highlight.js@11.11.1"></script> <!-- 代码高亮 -->
```

#### Vite 插件

```
slideHmrPlugin
  └─ 监听 slides/*.html 文件变化
     → WebSocket 推送 tang-slide-update 事件
     → 浏览器端重载当前页（HMR Toast 提示）

slideSavePlugin
  └─ HTTP 中间件 POST /api/save-slide
     → 接收 { slideIndex, patches[] }
     → JSDOM 解析 HTML，按 selector 应用 patch
     → fs.writeFileSync 写回文件
     → 触发 Vite HMR
```

---

## 6. 渲染方案

MVP 中存在**两套渲染实现**（历史演化）：

| 位置 | 方案 | 隔离性 | 说明 |
|------|------|--------|------|
| `packages/core/SlideRunner.ts` | **fetch + Shadow DOM** | ✅ CSS/JS 完全隔离 | 官方核心实现，每次切页重建 Shadow Root |
| `examples/tech-intro/index.html` | **fetch + DOMParser + 直接注入** | ⚠️ 无隔离，全局共享 | 示例实现，支持 EditManager 直接操作 DOM |

示例采用直接注入方案的原因：EditManager 需要能够直接操作 slide 内的 DOM 元素进行编辑，Shadow DOM 的封闭性会阻碍这一点。 3765676767

**渲染流程（示例版）：**

```
navigateTo(index)
    │
    ├─ 1. codeBoxManager.destroy()   // 清理上一页 CodeMirror
    ├─ 2. fetch(`slides/slide-NNN.html?t=timestamp`)
    ├─ 3. DOMParser 解析 HTML
    ├─ 4. 注入 <style> + body 节点到 #slide-host
    ├─ 5. requestAnimationFrame → 执行 <script> 代码
    ├─ 6. highlight.js 高亮代码块
    ├─ 7. codeBoxManager.init()      // 初始化 IDE 代码块
    ├─ 8. 更新 URL Hash (#index)
    └─ 9. 如在编辑模式，重新绑定 editManager
```

---

## 7. 主题系统

**4 套内置主题：**

| 主题名 | 风格 | 主色 |
|--------|------|------|
| `corporate-blue` | 商务蓝 | `#1a56db` |
| `dark-tech` | 暗色科技 | `#7c3aed` |
| `minimal` | 极简 | `#171717` |
| `vibrant` | 活力橙 | `#f97316` |

**主题注入机制：**

主题以 CSS 变量形式注入到宿主元素，slide HTML 内直接使用 `var()` 引用，无需知道具体颜色值：

```css
/* 宿主注入 */
#slide-host {
  --color-primary: #7c3aed;
  --color-background: #0f172a;
  --font-heading: system-ui, sans-serif;
  /* ... */
}

/* slide HTML 内使用 */
.slide {
  background: var(--color-background);
  color: var(--color-text);
}
```

这使得**同一套 slide HTML 可以通过切换主题呈现完全不同的视觉效果**。

---

## 8. PPT 规范约束

`SLIDE_STANDARDS` 常量是整个框架的"规范锚点"，既用于 TypeScript 类型约束，也作为 Agent Skill 的核心参考文档。

```
页面尺寸：1280 × 720 px（16:9 标准）
安全区：  top/bottom 48px，left/right 64px
overflow: hidden（超出不显示）

字号规范：
  主标题   52px / 700 / 最多 30 字
  副标题   32px / 500 / 最多 60 字
  正文     22px / 400 / 最多 150 字
  大数字   80px+ / 800

排版规则：
  - 每页文字 ≤ 150 字
  - 要点列表 ≤ 5 条
  - 留白面积 ≥ 30%

动画规范：
  - 入场动画 300-600ms
  - 缓动：ease / power2.out
  - 每页至少 1 个动画，不超过 5 个

支持页面类型：
  cover / toc / section / content / data-chart
  comparison / quote / image-focus / ending
```

**`base.css` 预设类名（slide HTML 内可直接使用）：**

| 类名 | 用途 |
|------|------|
| `.slide` | 页面根容器（固定 1280×720，含安全区） |
| `.slide-title` / `.slide-subtitle` | 标题文字规范样式 |
| `.slide-metric` / `.slide-metric-label` | 大数字展示 |
| `.slide-card` | 卡片容器 |
| `.slide-badge` | 标签/Badge |
| `.slide-grid-2` / `.slide-grid-3` | 2列/3列网格布局 |
| `.slide-flex-center` | 垂直水平居中 |
| `.accent-line` | 主色装饰横线 |
| `.animate-fade-in` / `.animate-slide-up` | CSS 入场动画 |
| `.delay-100` ~ `.delay-600` | 动画延迟辅助类 |
| `.slide-page-number` | 页码指示器 |

---

## 9. 编辑模式（Edit Mode）

Edit Mode 是 MVP 中最复杂的功能，允许用户**在浏览器内直接可视化编辑当前幻灯片**，无需开代码编辑器。

### 功能列表

| 功能 | 交互方式 | 实现机制 |
|------|---------|---------|
| 文本内联编辑 | 双击文字区域 | `contenteditable="true"` |
| 元素拖拽移动 | 拖动块级元素 | CSS `transform: translate(dx, dy)` |
| 对齐辅助线 | 拖拽接近中轴自动出现 | 橙色 1px 线，中轴吸附 |
| 选中框 | 单击元素 | 蓝色绝对定位边框 + 元素类型标签 |
| 删除元素 | 选中后点 ✕ | `parentNode.removeChild` |
| 取消还原 | `Esc` 或取消按钮 | 从 `_snapshots` Map 还原所有修改 |
| 保存回写 | `Ctrl+S` 或保存按钮 | `POST /api/save-slide`，JSDOM patch |

### Patch 数据模型

```typescript
type Patch =
  | { type: 'text';   selector: string; value: string }
  | { type: 'code';   selector: string; value: string }
  | { type: 'move';   selector: string; dx: number; dy: number }
  | { type: 'resize'; selector: string; width: number; height: number }
  | { type: 'delete'; selector: string }
```

### 保存流程

```
Ctrl+S
  → EditManager.save()
  → POST /api/save-slide  { slideIndex, patches[] }
  → Vite slideSavePlugin
  → JSDOM 解析 slide-NNN.html
  → 按 selector 逐条应用 patch
  → fs.writeFileSync 写回文件
  → Vite HMR → tang-slide-update → 浏览器重载当前页
  → EditManager.disable()
```

---

## 10. 数据流与 Agent 协作

```
用户输入（自然语言）
      │
      ▼  [ppt-brainstorm Skill]
content.md（立意摘要 + 内容大纲）
      │
      ▼  [ppt-outline Skill，规划中]
execution.md（每页结构化描述：类型/标题/要点/图表配置）
      │
      ▼  [slide-generator Skill + ppt-standards Skill]
slides/
  ├── slide-001.html   ← Agent 生成，符合规范的完整 HTML 片段
  ├── slide-002.html
  └── ... slide-NNN.html
      │
      ├─▶ [pnpm dev]  开发预览
      │     Vite DevServer + HMR
      │     → 浏览器打开 localhost:5173
      │     → SlideRunner / navigateTo 渲染
      │
      └─▶ [规划中] pnpm build
            → builder 打包为 presentation.html（单文件）
            → Puppeteer → presentation.pdf
```

---

## 11. 技术栈一览

| 分类 | 技术 | 版本 |
|------|------|------|
| 包管理 | pnpm + workspace | 9.x |
| Monorepo 编排 | Turborepo | 2.x |
| Core 构建 | tsup | 8.x |
| 开发服务器 | Vite | 6.x |
| 语言 | TypeScript | 5.7 |
| 动画库（全局） | GSAP | 3.12 |
| 图表库（全局） | ECharts | 5.5 |
| 代码高亮 | highlight.js | 11.11 |
| HTML 操作（服务端） | JSDOM | 29.x |
| 测试 | Vitest | 3.x |
| 代码规范 | ESLint + Prettier | — |

---

## 12. 尚未实现（规划中）

以下是技术方案中规划但 MVP 阶段尚未实现的内容：

| 模块 | 计划功能 |
|------|---------|
| `@tang-slidex/builder` | HTML 内联打包（单文件导出）、Puppeteer PDF 导出、CLI 工具 |
| `@tang-slidex/editor` | Electron 三栏 IDE（文件树 + 预览区 + AI 对话框），类 Cursor 体验 |
| Agent Skill - `ppt-outline` | 从 content.md 生成 execution.md（结构化执行计划） |
| Agent Skill - `chart-integration` | ECharts/AntV/VisActor 图表集成 SOP |
| Agent Skill - `animation-guide` | 复杂动画创作指南 |
| Agent Skill - `build-export` | 构建导出操作 SOP |
| 用户 Skill - `ppt-review` | PPT 内容复查和优化建议 |
| 模板库 | business-report / tech-sharing / academic / pitch-deck / minimal |
| 多比例支持 | 4:3、A4 尺寸 |
| 单文件分发 | `window.__TANG_SLIDES__` 内联数据（SlideRunner 已预留接口） |
