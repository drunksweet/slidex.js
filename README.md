<p align="center">
  <img src="https://img.shields.io/badge/tang--slidex-v0.3-7c3aed?style=for-the-badge" alt="version" />
  <img src="https://img.shields.io/badge/license-MIT-059669?style=for-the-badge" alt="license" />
  <img src="https://img.shields.io/badge/AI%20Native-✓-f59e0b?style=for-the-badge" alt="ai native" />
  <img src="https://img.shields.io/badge/pnpm-workspace-2563eb?style=for-the-badge" alt="pnpm" />
</p>

<h1 align="center">tang-slidex</h1>
<p align="center"><b>首个专为 AI Agent 设计、前端技术栈原生的开源幻灯片框架</b></p>
<p align="center">把 AI Agent 当成 PPT 设计师，把浏览器当成 PPT 播放器。</p>

---

## ✨ 为什么是 tang-slidex？

> 现有 PPT 工具的核心设计范式是"人工操作"，AI 只能作为辅助插件。  
> 而 **AI Agent 写前端页面的能力已经极为成熟**。

tang-slidex 的核心洞察：**与其让 AI 去适配有限的 PPT 工具，不如让 AI 直接用它最擅长的方式（写前端代码）来制作 PPT。**

每一页幻灯片就是一个独立的 HTML 文件，拥有无限的表现力——ECharts 数据图表、GSAP 流畅动画、Canvas 特效，一切前端能做的都能做。

---

## 🎯 现有能力（v0.3）

### 🤖 AI Agent 原生 · Skill 体系

内置三套 Agent SOP，让任何支持 Skill 的 AI 工具都能高质量地输出幻灯片：

| Skill | 类型 | 用途 |
|-------|------|------|
| `ppt-brainstorm` | 用户引导 | 引导用户明确主题、受众、核心亮点，生成内容草稿 |
| `ppt-standards` | Agent SOP | 严格定义 HTML 结构规范、CSS 变量、页面类型约束 |
| `slide-generator` | Agent SOP | 根据 execution.md 逐页生成符合规范的 HTML 文件 |

**典型工作流：**

```
用户描述 → ppt-brainstorm → content.md 草稿
content.md → Agent 规划 → execution.md（每页详细描述）
execution.md + ppt-standards + slide-generator → slide-001.html … slide-NNN.html
```

---

### 🎬 动画系统（v0.3 新增）

**双层动画协议**，覆盖从整页入场到逐元素逐步展现的完整场景：

#### Layer A — 页面入场动画（`tang.onLoad`）
```html
<script>
  tang.onLoad(() => {
    gsap.from('.title', { y: -20, opacity: 0, duration: 0.45 })
    gsap.from('.cards', { y: 30, opacity: 0, stagger: 0.1, delay: 0.2 })
  })
</script>
```

#### Layer B — 步骤动画（`data-step`）
点击时逐步显示，完美复现 PowerPoint 的"逐点展现"效果：
```html
<div data-step="1" data-animation="fade-up" data-duration="400">第一点</div>
<div data-step="2" data-animation="fade-right" data-duration="400" data-delay="80">第二点</div>
<div data-step="3" data-animation="zoom-in">第三点</div>
```

**10 种内置预设效果**：`fade` · `fade-up` · `fade-down` · `fade-left` · `fade-right` · `zoom-in` · `zoom-out` · `slide-up` · `slide-right` · `none`

全量配置支持：`data-animation` / `data-duration` / `data-delay` / `data-ease` / `data-stagger`

#### 可视化配置面板（AnimateTab）
- 无选中元素时：配置页面级入场动画（效果 / 时长 / 缓动）
- 选中元素时：为元素分配 data-step，实时预览效果
- 支持"框架托管模式"和"自定义脚本模式"切换

---

### ✏️ WYSIWYG 可视化编辑

浏览器内原地编辑，无缝保存回源文件：

- **文本内联编辑** — 双击任意文本元素进入 contenteditable，自动识别 TextNode
- **元素拖拽移动** — 鼠标按住拖拽，坐标经 scale 逆变换后精确记录
- **样式实时预览** — 颜色 / 字体 / 圆角 / 透明度 / 对齐方式，改即所见
- **行级写回** — `Ctrl+S` 仅修改对应行，不破坏文件格式；支持 `Ctrl+Z` 撤销
- **元素删除** — `Delete` 键删除元素，撤销恢复

**行级写回原理：** Vite 构建插件在开发时为每个 HTML 元素注入 `data-tang-line` 行号属性，编辑保存时精准定位并修改源文件对应行，真正的零格式损耗。

---

### 📊 数据可视化

每页 HTML 可直接使用全局预加载的图表库：

- **ECharts** — 折线图、柱状图、甘特图、自定义 Renderer
- **AntV / VisActor**（规划中）
- **Canvas / WebGL** — 原生粒子、3D 效果，完全自由

---

### 🖼️ 三栏编辑器 UI

```
┌─────────────┬──────────────────────────────┬──────────────────┐
│  Slide 缩略  │         舞台（1280×720）       │    右侧属性面板    │
│  图导航栏    │   scale 自适应到浏览器窗口      │  StyleTab        │
│             │   Shadow DOM 隔离各页样式      │  LayoutTab       │
│  step 步骤  │                               │  AnimateTab ✨    │
│  点 指示器  │   编辑模式：选中框 + 拖拽手柄   │  CodeBoxTab      │
└─────────────┴──────────────────────────────┴──────────────────┘
```

---

## 🚀 快速开始

### 环境要求

- Node.js ≥ 18
- pnpm ≥ 9

### 1. 克隆并安装

```bash
git clone https://github.com/drunksweet/slidex.js.git tang-slidex
cd tang-slidex
pnpm install
```

### 2. 启动 Viewer

```bash
pnpm dev
# → http://localhost:3000
```

> Viewer 默认加载 `examples/tech-intro/slides/` 里的 16 页示例 PPT（tang-slidex 自我介绍）。

### 3. 用 AI Agent 生成你的第一套 PPT

在支持 Skill/Tool 的 AI 工具（Cursor、Kwaipilot、Claude 等）中：

```
1. 加载 packages/skills/agent/ppt-standards/SKILL.md
2. 加载 packages/skills/agent/slide-generator/SKILL.md
3. 告诉 Agent：
   "根据以下内容生成 PPT，保存到 examples/my-ppt/slides/ 目录：
   [你的内容草稿]"
```

Agent 会自动规划每页内容并逐页生成 HTML 文件。

### 4. 切换到你的 PPT

修改 `packages/viewer/vite.config.ts`（或 Viewer 加载路径），指向你的 slides 目录即可。

---

## 🗂️ 项目结构

```
tang-slidex/
├── packages/
│   ├── viewer/              # 展示 & 编辑 UI（React 19 + Vite + Zustand）
│   │   └── src/
│   │       ├── components/  # TopBar · SlidePanel · StageArea · RightPanel
│   │       ├── hooks/       # useAnimationController · useSlideRunner · useEditManager
│   │       └── store/       # uiStore · animStore · editStore
│   ├── editor/              # 编辑引擎（EditManager + Vite 插件）
│   │   └── src/
│   │       ├── EditManager.ts         # WYSIWYG 核心：文字/拖拽/删除/patch
│   │       └── vite-plugins/
│   │           ├── slideInspectorPlugin  # 行号注入（data-tang-line）
│   │           ├── slideSavePlugin       # POST /api/save-slide 行级写回
│   │           └── slideUndoPlugin       # POST /api/undo 历史栈还原
│   ├── core/                # 运行时规范（尺寸常量 / tang runtime API）
│   └── skills/
│       ├── agent/
│       │   ├── ppt-standards/     # Agent SOP：HTML 规范约束
│       │   └── slide-generator/   # Agent SOP：逐页生成 SOP
│       └── user/
│           └── ppt-brainstorm/    # 用户引导：主题 → 内容草稿
├── examples/
│   └── tech-intro/
│       ├── slides/          # 示例 PPT（16 页 HTML），也是最佳实践参考
│       └── package.json     # 元数据（totalSlides / title / theme）
└── docs/                    # 技术方案文档
```

---

## 🧱 架构概览

```
用户 / AI Agent
      │
      ▼ 写 HTML
examples/<your-deck>/slides/
  slide-001.html  ← 每页是独立 HTML，可用全部前端技术
  slide-002.html     • GSAP 动画  • ECharts 图表
  ...                • Canvas    • data-step 步骤动画
      │
      ▼ 加载
packages/viewer         ← React SPA，开发时通过 Vite 插件注入行号
  StageArea             ← Shadow DOM 渲染 slide，scale 自适应
  AnimationController   ← 管理 data-step 步骤动画状态机
  EditManager           ← WYSIWYG 编辑，收集 WysiwygPatch[]
      │
      ▼ Ctrl+S
packages/editor/vite-plugins/slideSavePlugin
  ← 解析 WysiwygPatch[]，精准定位并行级写回 HTML 源文件
```

---

## 📐 slide HTML 规范（快速参考）

每页 slide 是一个独立 HTML 文件，必须满足：

```html
<!doctype html>
<html lang="zh">
<head>
  <meta charset="UTF-8" />
  <style>
    .slide {
      width: 1280px;   /* 固定，不可修改 */
      height: 720px;   /* 固定，不可修改 */
      overflow: hidden;
      background-color: var(--color-background, #0f172a);
      /* 主题 CSS 变量由框架注入，直接使用 var() */
    }
  </style>
</head>
<body>
  <div class="slide" data-slide-id="001" data-slide-type="cover">
    <!-- 内容 -->
  </div>

  <script>
    // GSAP、ECharts 等全局库已由框架预加载，直接用
    tang.onLoad(() => {
      gsap.from('.title', { y: -20, opacity: 0, duration: 0.5 })
    })
  </script>
</body>
</html>
```

**`data-slide-type` 可选值：** `cover` · `toc` · `section` · `content` · `data-chart` · `code` · `ending`

**全局可用 API：**
- `tang.onLoad(fn)` — 页面载入时执行，驱动入场动画
- `tang.onStep(n, fn)` — 第 n 步时执行自定义逻辑（规划中）
- `gsap` — GreenSock 动画库
- `echarts` — Apache ECharts 图表库

---

## 🛣️ Roadmap

| 阶段 | 状态 | 内容 |
|------|------|------|
| **Phase 1 · MVP** | ✅ 已完成 | Monorepo · SlideRunner · PPT 规范 · slide-generator Skill |
| **Phase 2 · Viewer** | ✅ 已完成 | React 三栏编辑器 · WYSIWYG 编辑 · 行级写回 · Undo/Redo |
| **Phase 3 · Animation** | ✅ 已完成 | GSAP 动画系统 · tang.onLoad 协议 · data-step 步骤动画 · AnimateTab 可视化面板 |
| **Phase 4 · Build & Export** | 🔜 规划中 | HTML 单文件打包 · PDF 导出 · CLI 工具 |
| **Phase 5 · AI Editor** | 🔜 规划中 | AI 对话框 · 自然语言改稿 · 多模态输入 |
| **Phase 6 · Ecosystem** | 🔜 规划中 | 社区模板 · npm 发布 · 更多 Skill |

---

## 🤝 如何贡献

欢迎各种形式的贡献！

### 最适合贡献的方向

1. **贡献示例 PPT** — 在 `examples/` 下新建目录，创作你的 HTML 幻灯片
2. **完善 Skill** — 改进 `packages/skills/` 中的 Agent SOP，让 AI 生成质量更高
3. **新增动画预设** — 在 `useAnimationController.ts` 的 `PRESETS` 中添加新效果
4. **实现 Phase 4 导出** — HTML 单文件打包 + Puppeteer PDF 导出
5. **编写文档** — 翻译、补充文档，完善 API 参考

### 开发工作流

```bash
# Fork 仓库后
git clone https://github.com/<your-name>/slidex.js.git
cd slidex.js
pnpm install

# 启动开发环境
pnpm dev

# 代码格式化
pnpm format:slides   # 格式化 slides HTML
```

提交 PR 前请确保：
- Prettier 格式通过（`pnpm format:check`）
- 新增的 slide HTML 遵循 ppt-standards 规范

---

## 📖 文档

| 文档 | 说明 |
|------|------|
| [PRD](./docs/【prd】agent%20驱动的%20前端技术栈实现%20ppt%20制作.md) | 产品需求与背景洞察 |
| [MVP 架构](./docs/mvp-架构.md) | 整体架构设计 |
| [Viewer 重构技术方案](./docs/viewer-重构技术方案.md) | React 三栏编辑器设计 |
| [编辑功能技术方案](./docs/编辑功能技术方案.md) | WYSIWYG + 行级写回 |
| [动画技术规范](./docs/动画技术规范.md) | 双层动画协议规范 |
| [动画功能调研](./docs/动画功能调研.md) | GSAP 选型调研 |

---

## 🆚 与同类框架对比

| | tang-slidex | Slidev | reveal.js | Gamma |
|---|---|---|---|---|
| AI Agent 原生 | ✅ 核心设计 | ❌ | ❌ | ⚡ 部分 |
| 前端技术栈自由度 | ✅ 完全自由 | Vue 绑定 | HTML | ❌ |
| 数据可视化 | ✅ ECharts 等 | 有限 | ❌ | ❌ |
| GSAP 动画 | ✅ 全量支持 | CSS | CSS | 内置 |
| 步骤动画 | ✅ data-step | ✅ | ✅ | ✅ |
| WYSIWYG 编辑 | ✅ 行级写回 | ❌ | ❌ | ✅ |
| 开源 | ✅ MIT | ✅ MIT | ✅ MIT | ❌ |

---

## License

MIT © [jiaoxinheng](https://github.com/drunksweet)
