---
name: ppt-standards
description: tang-slidex PPT 规范文档。当 Agent 需要生成或修改幻灯片 HTML 文件时，必须先加载此 Skill，确保输出符合框架规范。
---

# PPT 规范（ppt-standards）

本文档是 tang-slidex 框架的核心规范，**所有生成的 slide HTML 文件必须严格遵守**。

---

## 1. 页面结构规范

### 1.1 必须的根结构

每个 `slide-NNN.html` 文件必须包含以下结构：

```html
<!DOCTYPE html>
<html lang="zh">
<head>
  <meta charset="UTF-8">
  <style>
    /* 必须：引入 tang-slidex 规范 CSS 变量支持 */
    /* 主题 CSS 变量由 Shadow DOM 注入，直接使用 var() 即可 */

    .slide {
      width: 1280px;       /* 16:9 标准宽度，不可修改 */
      height: 720px;       /* 16:9 标准高度，不可修改 */
      overflow: hidden;
      position: relative;
      background-color: var(--color-background, #ffffff);
      color: var(--color-text, #111928);
      font-family: var(--font-body, system-ui, sans-serif);
      padding: 48px 64px;  /* 安全区边距，不可小于此值 */
    }
  </style>
</head>
<body>
  <div class="slide" data-slide-id="NNN" data-slide-type="[类型]">
    <!-- 页面内容 -->
  </div>

  <script>
    // 动画和交互代码
    // 注意：全局 gsap、echarts 等库已在 index.html 加载，可直接使用
  </script>
</body>
</html>
```

### 1.2 `data-slide-type` 取值

| 类型 | 说明 |
|------|------|
| `cover` | 封面页 |
| `toc` | 目录页 |
| `section` | 章节分隔页 |
| `content` | 纯文字/要点内容 |
| `data-chart` | 数据图表页 |
| `comparison` | 对比分析页 |
| `quote` | 引言/金句页 |
| `image-focus` | 全图页 |
| `ending` | 结尾/感谢页 |

---

## 2. 尺寸规范（不可违反）

```
页面尺寸：1280 × 720 px（16:9）
安全区：内边距 top/bottom 48px，left/right 64px
溢出处理：overflow: hidden（内容超出不显示，必须控制好）
```

---

## 3. 字体与排版规范

### 3.1 字号规则

| 元素 | 字号 | 字重 | 最大字符数 |
|------|------|------|-----------|
| 主标题 | 52px | 700 | 30 字 |
| 副标题 | 32px | 500 | 60 字 |
| 正文/要点 | 22px | 400 | 每行 40 字 |
| 注释/来源 | 15px | 300 | — |
| 大数字展示 | 80px+ | 800 | — |

### 3.2 黄金排版规则

- **每页文字总量不超过 150 字**
- **要点列表不超过 5 条**
- **留白面积不少于页面的 30%**（宁可内容少，不要塞满）
- 标题与正文之间留足间距（至少 24px）
- 重要数字单独放大展示（使用 `.slide-metric` 类）

### 3.3 可用 CSS 变量

```css
/* 颜色 */
var(--color-primary)     /* 主色 */
var(--color-secondary)   /* 辅色 */
var(--color-background)  /* 背景色 */
var(--color-surface)     /* 卡片背景 */
var(--color-text)        /* 主文字色 */
var(--color-text-muted)  /* 次要文字色 */
var(--color-accent)      /* 强调背景色 */
var(--color-border)      /* 边框色 */

/* 字体 */
var(--font-heading)  /* 标题字体 */
var(--font-body)     /* 正文字体 */
var(--font-mono)     /* 代码字体 */

/* 其他 */
var(--border-radius) /* 圆角 */
var(--shadow)        /* 阴影 */
```

---

## 4. 动画规范

### 4.1 动画原则

- **入场动画时长**：300-600ms
- **缓动函数**：`ease`、`power2.out`（GSAP）
- **延迟规律**：主标题先出现，内容依次延迟 100-200ms
- **不能无动画**：每页至少有一个元素有入场动画
- **不能太复杂**：同一页不超过 5 个独立动画

### 4.2 GSAP 使用方式（全局已加载）

```javascript
// index.html 已全局加载 GSAP，直接使用 gsap 对象
gsap.from('.slide-title',   { y: -30, opacity: 0, duration: 0.5 })
gsap.from('.slide-content', { y:  20, opacity: 0, duration: 0.5, delay: 0.2 })
gsap.from('.slide-chart',   { scale: 0.9, opacity: 0, duration: 0.6, delay: 0.35 })

// 数字滚动动画
gsap.from('.metric-number', {
  textContent: 0,
  duration: 1.2,
  ease: 'power2.out',
  snap: { textContent: 1 },
  delay: 0.4
})
```

### 4.3 CSS 动画类（无需 GSAP）

```html
<h1 class="animate-fade-in">标题</h1>
<p class="animate-slide-up delay-200">正文</p>
<div class="animate-scale-in delay-400">卡片</div>
```

---

## 5. 图表规范（ECharts）

ECharts 已在 index.html 全局加载，直接使用 `echarts` 对象：

```html
<!-- 必须指定明确的宽高 -->
<div id="chart-main" style="width: 640px; height: 420px;"></div>

<script>
  const chart = echarts.init(document.getElementById('chart-main'))
  chart.setOption({
    // 颜色建议使用主题色
    color: ['var(--color-primary)', 'var(--color-secondary)', '#34d399'],
    // 背景透明
    backgroundColor: 'transparent',
    // ... 其他配置
  })
</script>
```

**注意**：每页 ECharts 图表的 DOM id 必须唯一（加上页码前缀，如 `chart-003-main`）

---

## 6. 禁止事项

- ❌ 不允许引入外部 CSS 框架（Bootstrap、Tailwind 等）
- ❌ 不允许使用 `@import` 加载外部字体（会阻塞渲染）
- ❌ 不允许在 slide HTML 内再次加载 ECharts/GSAP（已全局加载）
- ❌ 不允许使用绝对定位堆叠超过 3 层（维护困难）
- ❌ 不允许 `font-size` 小于 14px（视觉可读性）
- ❌ 不允许一页超过 200 字文字内容

---

## 7. 文件命名规范

```
slides/slide-001.html  ← 第 1 页（封面）
slides/slide-002.html  ← 第 2 页（目录）
slides/slide-003.html  ← 第 3 页
...
slides/slide-NNN.html  ← 三位数字，左补零
```
