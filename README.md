# tang-slidex

> 首个专为 AI Agent 设计、前端技术栈原生的开源幻灯片框架

把 AI Agent 当成 PPT 设计师，把浏览器当成 PPT 播放器。

## 特性

- 🤖 **AI Agent 原生** — 专为 AI Agent 设计，全面拥抱 AI 生成
- 🌐 **前端技术栈** — HTML / CSS / JS，浏览器原生渲染，无限表现力
- 📊 **数据可视化** — 原生支持 ECharts / AntV / VisActor
- ✨ **流畅动画** — GSAP / Framer Motion 动画支持
- 📦 **零依赖分发** — 导出为单个自包含 HTML 文件
- 🎯 **Skill 体系** — 面向 Agent 的技术 SOP + 面向用户的引导 Skill

## 快速开始

```bash
# 安装依赖
pnpm install

# 运行示例
cd examples/tech-intro
pnpm dev
```

## 项目结构

```
tang-slidex/
├── packages/
│   ├── core/        # 运行时引擎 + PPT 规范
│   ├── builder/     # 构建 & 导出工具（Phase 2）
│   ├── skills/      # Skill 体系
│   └── editor/      # IDE 编辑器（Phase 3）
├── templates/       # 内置 PPT 模板
├── examples/        # 示例项目
└── docs/            # 文档
```

## 文档

- [PRD](./docs/【prd】agent%20驱动的%20前端技术栈实现%20ppt%20制作.md)
- [技术方案](./docs/技术方案.md)

## License

MIT
