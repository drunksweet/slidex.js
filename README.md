# tang-slidex

> 首个专为 AI Agent 设计、前端技术栈原生的开源幻灯片框架

把 AI Agent 当成 PPT 设计师，把浏览器当成 PPT 播放器。

## 特性

- 🤖 **AI Agent 原生** — 专为 AI Agent 设计，全面拥抱 AI 生成
- 🌐 **前端技术栈** — HTML / CSS / JS，浏览器原生渲染，无限表现力
- 📊 **数据可视化** — 原生支持 ECharts / AntV / VisActor
- ✨ **流畅动画** — GSAP / Framer Motion 动画支持
- ✏️ **可视化编辑** — 浏览器内 WYSIWYG 编辑，拖拽移动、文字编辑、行级写回源文件
- 📦 **零依赖分发** — 导出为单个自包含 HTML 文件（规划中）
- 🎯 **Skill 体系** — 面向 Agent 的技术 SOP + 面向用户的引导 Skill

## 快速开始

```bash
# 安装依赖（pnpm workspaces）
pnpm install

# 启动 Viewer（演示 + 编辑）
pnpm dev
# → http://localhost:3000
```

> **说明**：`pnpm dev` 启动的是 `packages/viewer`，默认加载 `examples/tech-intro/slides/` 里的 16 页示例 PPT。

## 项目结构

```
tang-slidex/
├── packages/
│   ├── viewer/      # 展示交互层（React 19 + PWA）演示 + 编辑 UI
│   ├── editor/      # 编辑引擎（EditManager + Vite 插件：行号注入、行级写回、撤销）
│   ├── core/        # 运行时规范（PPT 尺寸、主题、约束常量）
│   └── skills/      # Skill 体系（Agent SOP + 用户引导）
├── examples/
│   └── tech-intro/
│       ├── slides/  # 示例 PPT（16 页 HTML 文件）← 唯一需要的内容
│       └── package.json  # 元数据（totalSlides / title / theme）
└── docs/            # 文档
```

## 架构概览

```
用户 / AI Agent
      │
      ▼
packages/viewer        ← 演示 & 编辑入口（React SPA + PWA）
  ├── TopBar           ← 模式切换（演示 / 编辑）
  ├── SlidePanel       ← 左侧 slide 缩略图列表
  ├── StageArea        ← 中间舞台（1280×720 scale 自适应）
  ├── RightPanel       ← 右侧属性面板（样式 / 布局）
  └── StatusBar        ← 底部状态栏
      │
      ▼
packages/editor        ← 编辑引擎（不依赖 React）
  ├── EditManager      ← WYSIWYG 编辑（文字/拖拽/删除），收集 WysiwygPatch[]
  ├── SelectionManager ← AI 辅助编辑上下文
  └── vite-plugins/
      ├── slideInspectorPlugin  ← 行号注入（data-tang-line）
      ├── slideSavePlugin       ← POST /api/save-slide 行级写回
      └── slideUndoPlugin       ← POST /api/undo 历史栈还原
      │
      ▼
examples/tech-intro/slides/    ← PPT 源文件（slide-001.html … slide-NNN.html）
```

## 编辑工作流

1. 点击顶部 **编辑** 按钮进入编辑模式
2. 点击 slide 中的元素选中，拖拽移动 / 双击编辑文字
3. 右侧面板调整颜色、圆角、透明度、位置、对齐
4. `Ctrl+S` 保存 → 行级写回 HTML 源文件（无格式损耗）
5. `Ctrl+Z` 撤销上一次保存

## 文档

- [PRD](./docs/【prd】agent%20驱动的%20前端技术栈实现%20ppt%20制作.md)
- [MVP 架构](./docs/mvp-架构.md)
- [Viewer 重构技术方案](./docs/viewer-重构技术方案.md)
- [编辑功能技术方案](./docs/编辑功能技术方案.md)

## License

MIT
