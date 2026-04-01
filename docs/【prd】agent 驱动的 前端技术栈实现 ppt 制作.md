# PRD：Agent 驱动的前端技术栈 PPT 制作框架

> **文档状态**：Draft  
> **作者**：jiaoxinheng  
> **最后更新**：2026-03-30

---

## 1. 背景与概述

当前主流 PPT 工具（PowerPoint、Keynote、Gamma 等）对 AI Agent 的支持严重不足——它们的核心设计范式是"人工操作"，AI 只能作为辅助插件。

与此同时，**AI Agent 写前端页面的能力已经极为成熟**，可以轻松生成高质量的 HTML / CSS / JS。浏览器作为渲染引擎，具备远超传统 PPT 软件的表现力（数据可视化、动画、交互）。

本项目的核心洞察：

> **与其让 AI 去适配有限的 PPT 工具，不如让 AI 直接用它最擅长的方式（写前端代码）来制作 PPT。**

本框架定位为：**首个专为 AI Agent 设计、前端技术栈原生的开源幻灯片框架**，全面拥抱 AI。

---

## 2. 目标用户

### 2.1 两个方向

| 方向 | 目标用户 | 定位 |
|------|----------|------|
| **对内（开发者版）** | 懂代码、懂 AI 原理的开发者 | 高自由度，提供底层能力和规范 |
| **对外（用户版）** | 普通用户、产品/运营/学生等 | 开箱即用，引导式 AI 对话完成 PPT |

### 2.2 优先级

**当前阶段优先开发者版（对内）**，夯实底层能力后，再基于底层能力封装用户版（对外）。

---

## 3. 产品定位与差异化

### 3.1 核心差异

| 对比项 | 本框架 | Slidev | Gamma | reveal.js |
|--------|--------|--------|-------|-----------|
| AI Agent 原生支持 | ✅ 核心设计 | ❌ | 部分 | ❌ |
| 前端技术栈自由度 | ✅ 完全自由 | Vue 绑定 | ❌ | HTML |
| 数据可视化集成 | ✅ ECharts/AntV/VisActor | 有限 | ❌ | ❌ |
| 动画能力 | ✅ GSAP/Framer | CSS | 内置 | CSS |
| 开源 | ✅ | ✅ | ❌ | ✅ |
| 导出分发 | HTML 单文件 + PDF | PDF/HTML | 云端 | HTML |

### 3.2 一句话定位

> "把 AI Agent 当成 PPT 设计师，把浏览器当成 PPT 播放器。"

---

## 4. 核心架构设计

### 4.1 整体流程

```
用户输入（自然语言/Markdown 草稿）
        ↓
【Skill: 立意引导】帮用户明确主题、亮点、受众
        ↓
生成 内容草稿 Markdown（Content Draft）
        ↓
【Skill: 执行规划】按 PPT 规范，生成执行 Markdown（Execution Plan）
  - 每一页有什么元素
  - 交互逻辑是什么
  - 文案是什么
  - 用什么可视化方案
  - 动画如何过渡
        ↓
【Agent: 代码生成】根据执行 Markdown，逐页生成 HTML 文件
        ↓
【框架: 渲染引擎】index.html 统一管理所有页面，浏览器直接渲染
        ↓
【Build: 打包导出】合并为自包含单 HTML 文件 / Puppeteer 截图转 PDF
```

### 4.2 文件结构规范

```
project/
├── content.md           # 用户的内容草稿（自然语言）
├── execution.md         # Agent 生成的执行计划（结构化 Markdown）
├── index.html           # 统一入口，管理所有页面
├── slides/
│   ├── slide-001.html   # 封面页
│   ├── slide-002.html   # 目录页
│   ├── slide-003.html   # 第 3 页（内容）
│   └── ...
├── assets/
│   ├── images/
│   ├── fonts/
│   └── data/            # 图表数据（JSON）
├── theme/
│   ├── base.css         # 基础 PPT 规范样式
│   └── custom.css       # 自定义主题
└── dist/
    ├── presentation.html  # 打包后的单文件
    └── presentation.pdf   # PDF 导出
```

### 4.3 执行 Markdown 规范（Execution Plan 格式）

```markdown
---
ppt-title: Q1 业务复盘报告
theme: corporate-blue
aspect-ratio: 16:9
total-pages: 8
---

## slide-001
type: cover
title: Q1 业务复盘报告
subtitle: 2026年第一季度
background: gradient(#1a1a2e, #16213e)
animation: fade-in 1s

## slide-002
type: toc
items:
  - 业务概览
  - 核心数据
  - 问题与机会
  - Q2 规划
animation: slide-up

## slide-003
type: data-chart
title: 核心业务指标
chart-lib: echarts
chart-type: bar
data-source: assets/data/q1-metrics.json
layout: left-text-right-chart
text: |
  Q1整体完成率达到 **127%**，
  其中...
animation: count-up
```

---

## 5. PPT 规范（Framework Standards）

Agent 生成的 HTML 页面**必须遵循**以下规范，以确保输出结果"像 PPT"：

### 5.1 页面尺寸规范

```css
/* 标准 PPT 比例 */
.slide {
  width: 1280px;
  height: 720px;   /* 16:9 */
  overflow: hidden;
  position: relative;
}

/* 备选比例 */
/* 4:3: 1024 × 768 */
/* A4竖版: 794 × 1123 */
```

### 5.2 字体与排版基准

| 元素 | 字号 | 字重 |
|------|------|------|
| 主标题 | 48-64px | 700 |
| 副标题 | 28-36px | 500 |
| 正文 | 20-24px | 400 |
| 注释/来源 | 14-16px | 300 |

规则：
- 单页文字不超过 **150 字**
- 单页要点不超过 **5 条**
- 留白面积不少于页面的 **30%**

### 5.3 动画过渡规范

```javascript
// 进场动画标准类
.animate-fade-in      { animation: fadeIn 0.6s ease }
.animate-slide-up     { animation: slideUp 0.5s ease }
.animate-scale-in     { animation: scaleIn 0.4s ease }
.animate-count-up     { /* 数字滚动动画 */ }

// 页面切换
transition: slide | fade | zoom | none
duration: 300-600ms
```

### 5.4 分页机制

- 每页对应 **独立 HTML 文件**（`slide-NNN.html`，三位数字编号）
- `index.html` 通过 iframe 或动态加载管理页面切换
- 键盘快捷键：`→/Space` 下一页，`←` 上一页，`F` 全屏

---

## 6. Skill 体系设计

### 6.1 面向用户的 Skill（引导类）

| Skill 名称 | 作用 |
|-----------|------|
| `ppt-brainstorm` | 帮用户明确 PPT 目的、受众、核心亮点 |
| `ppt-outline` | 基于主题生成章节结构和叙事逻辑 |
| `ppt-review` | 审阅生成结果，提供改进建议 |

### 6.2 面向 Agent 的 Skill（技术 SOP 类）

| Skill 名称 | 作用 |
|-----------|------|
| `ppt-standards` | PPT 规范文档（尺寸、排版、动画标准） |
| `slide-generator` | 逐页 HTML 生成 SOP，包含各类页面模板 |
| `chart-integration` | ECharts / AntV / VisActor 集成 SOP |
| `animation-guide` | GSAP / Framer Motion 动画最佳实践 |
| `build-export` | 打包单文件 HTML / Puppeteer 转 PDF 流程 |

### 6.3 优先级原则

> 优先使用开源 MCP / 社区 Skill，没有再自建。避免重复造轮子。

---

## 7. 编辑器（IDE 布局）

类似 Cursor 的三栏 IDE 布局：

```
┌────────────┬──────────────────────┬────────────────┐
│  文件面板   │      预览区域         │   AI 对话框    │
│            │                      │                │
│ 📁 slides/ │  ┌──────────────┐   │  💬 用户:      │
│  slide-001 │  │              │   │  "把第三页的   │
│  slide-002 │  │  实际 PPT    │   │  标题改成蓝色" │
│  slide-003 │  │  页面渲染    │   │                │
│            │  │  可交互      │   │  🤖 Agent:     │
│ 📁 assets/ │  │              │   │  "已修改，     │
│ 📄 index   │  └──────────────┘   │  预览已更新"   │
│ 📄 content │                      │                │
│ 📄 executi │  页码: 3/10  ← →    │  [发送消息...]  │
└────────────┴──────────────────────┴────────────────┘
```

### 7.1 核心交互

- **左栏**：文件树（每个 slide-NNN.html 对应一页 PPT），点击切换预览
- **中栏**：实际 HTML 渲染，支持全屏、翻页、交互体验
- **右栏**：AI 对话框，支持自然语言修改（"把第 3 页改成深色主题"）

### 7.2 AI 修改能力

- 精确修改：用户说第几页 → Agent 定位对应 `slide-NNN.html` → 修改后热更新预览
- 全局修改：主题色、字体、动画风格等批量修改
- 内容生成：根据对话补充新页面

---

## 8. 导出与分发

### 8.1 导出格式

| 格式 | 实现方式 | 适用场景 |
|------|----------|----------|
| **HTML 单文件** | 所有资源内联（Base64 图片）| 离线分享，双击即开 |
| **PDF** | Puppeteer 逐页截图 | 打印、邮件附件 |
| **在线链接** | 一键托管到 GitHub Pages / Vercel | 在线分享 |
| **.pptx** | （未来考虑）pptxgenjs 方案 | Office 兼容（非强需求） |

### 8.2 分发策略

**不懂技术的用户的分享方案**：
1. 一键构建 → 生成 `presentation.html`（自包含单文件）
2. 直接发送这个 HTML 文件，收件人双击浏览器打开即可
3. 或一键上传官方托管（对外产品提供），生成永久短链

---

## 9. 技术选型

### 9.1 核心依赖（按功能分类）

| 类别 | 技术 | 说明 |
|------|------|------|
| **编辑器 UI** | Electron / Web | 桌面或 Web 应用 |
| **数据可视化** | ECharts / AntV / VisActor | 图表组件，按需选用 |
| **动画** | GSAP / Framer Motion | 高性能动画 |
| **Markdown 解析** | unified / remark | 解析内容草稿 |
| **PDF 导出** | Puppeteer | 截图转 PDF |
| **HTML 打包** | Vite / 自定义脚本 | 内联所有资源 |
| **跨端** | Electron（桌面）/ RN（移动，未来）| 扩展支持 |

### 9.2 MCP / 外部 Skill 优先复用

- 网络搜索：优先复用现有 MCP Search Skill
- 文案撰写：复用现有写作类 Skill
- 代码生成：基于现有 Agent 代码生成能力

---

## 10. 非目标（Out of Scope，当前阶段）

- ❌ 实时协同编辑（多人同时编辑）
- ❌ .pptx 导入解析（将已有 PPT 转换）
- ❌ 移动端 RN 版本（未来支持）
- ❌ 普通用户版（对外产品，基于对内版本完成后再构建）
- ❌ 自建云存储托管服务（当前借助 GitHub Pages / Vercel）

---

## 11. 成功指标

| 指标 | 目标 |
|------|------|
| Agent 生成一份 10 页 PPT 的端到端时间 | < 3 分钟 |
| 生成质量（人工评分） | 满足"可直接使用"标准 ≥ 80% |
| 开发者上手时间（从 clone 到生成第一份 PPT） | < 15 分钟 |
| 导出 HTML 文件体积（10 页） | < 5MB（无大图情况）|

---

## 12. 已决策问题 ✅

### 12.1 执行 Markdown 格式规范

**决策：以纯自然语言（NLP）为主，Agent 辅助提炼结构。**

- 用户直接用自然语言写 `content.md`，无需遵循任何固定格式
- Agent 在此基础上提炼出执行计划（`execution.md`），可包含一定的结构约束
- 引入**反馈机制**：当用户思路混乱、文档描述有歧义时，Agent 主动介入引导，帮助用户修复和完善文档，而非直接报错

```
用户思路混乱时 → Agent 提问澄清 → 用户补充 → 重新提炼
                                          ↑ 循环直到清晰
```

### 12.2 index.html 页面切换机制

**决策：fetch + innerHTML + Shadow DOM 方案。**

放弃 iframe 的原因：PPT 核心体验是**流畅的页面切换动画**，iframe 的跨帧动画限制是天然弱项。

采用 Shadow DOM 解决 CSS 隔离问题，同时保留动画灵活性：

```javascript
async function navigateTo(slideIndex) {
  const res  = await fetch(`slides/slide-${String(slideIndex).padStart(3,'0')}.html`)
  const shadow = slideContainer.attachShadow({ mode: 'open' })
  shadow.innerHTML = await res.text()
  // GSAP 入场动画
  gsap.from(shadow.querySelector('.slide'), { opacity: 0, y: 30, duration: 0.4 })
}
```

| 优势 | 说明 |
|------|------|
| 流畅过渡动画 | GSAP / CSS 可直接作用于 slide 元素 |
| CSS 隔离 | Shadow DOM 防止样式污染 |
| 资源共享 | ECharts / GSAP 等库全局只加载一次 |
| 调试友好 | 统一 DevTools context |

### 12.3 Skill 发布形式

**决策：先集成在框架仓库，后续视生态需要独立为 npm 包。**

- 初期：所有 Skill 在 `packages/skills/` 目录下统一管理
- 成熟后：按功能拆分独立发布（如 `@tang-slidex/skill-chart`）

### 12.4 代码共享方式

**决策：Monorepo 架构。**

对内开发者框架与对外用户产品共享底层代码，通过 monorepo 统一管理版本和依赖。

### 12.5 PPT 模板库

**决策：内置若干模板，仅作引导参考，Agent 自由发挥为主。**

- 内置 3-5 套精品模板（商务汇报、技术分享、学术报告等）
- 模板作用：给 Agent 提供设计参考和风格示例，而非强制约束
- Agent 可以完全不用模板，根据用户需求自由创作
- 模板代码也是学习材料，展示框架规范的最佳实践

---

## 13. 项目结构规划（两个方向）

```
tang-slidex/                    # 主仓库
├── packages/
│   ├── core/                   # 核心规范、构建工具（对内）
│   ├── skills/                 # Skill 包（面向 Agent + 面向用户）
│   ├── editor/                 # IDE 编辑器（Electron/Web）
│   └── app/                    # 对外用户产品（开箱即用）
├── templates/                  # 内置 PPT 模板
├── docs/                       # 文档
└── examples/                   # 示例 PPT 项目
```

