---
name: slide-generator
description: tang-slidex 逐页 HTML 生成 SOP。当 Agent 需要根据 execution.md 生成 slide-NNN.html 文件时使用。必须配合 ppt-standards Skill 使用。
---

# Slide Generator（逐页 HTML 生成 SOP）

## 工作流程

```
1. 读取 execution.md，解析每页描述
2. 识别页面 type（cover / toc / content / data-chart 等）
3. 选择对应的 HTML 模板结构
4. 填充文案、图表配置、动画代码
5. 生成 slide-NNN.html，保存到 slides/ 目录
6. 所有页面生成完后，更新 tang-slidex.config.json 的 totalSlides
```

**重要**：每次生成前先读取 `ppt-standards` Skill 确认规范。

---

## 页面模板库

### 模板 1：封面页（type: cover）

```html
<!DOCTYPE html>
<html lang="zh">
<head>
  <meta charset="UTF-8">
  <style>
    .slide {
      width: 1280px; height: 720px; overflow: hidden;
      background: linear-gradient(135deg, var(--color-primary) 0%, var(--color-secondary) 100%);
      display: flex; flex-direction: column;
      justify-content: center; align-items: flex-start;
      padding: 80px 100px;
      position: relative;
    }
    .cover-badge {
      font-size: 14px; font-weight: 600; letter-spacing: 0.12em;
      text-transform: uppercase; color: rgba(255,255,255,0.7);
      background: rgba(255,255,255,0.15); padding: 6px 16px;
      border-radius: 999px; margin-bottom: 32px;
    }
    .cover-title {
      font-family: var(--font-heading, system-ui);
      font-size: 64px; font-weight: 800; color: #fff;
      line-height: 1.15; letter-spacing: -0.03em;
      margin-bottom: 24px; max-width: 800px;
    }
    .cover-subtitle {
      font-size: 26px; color: rgba(255,255,255,0.75);
      font-weight: 400; max-width: 600px; line-height: 1.5;
    }
    .cover-meta {
      position: absolute; bottom: 60px; left: 100px;
      font-size: 16px; color: rgba(255,255,255,0.5);
    }
    /* 装饰圆形 */
    .cover-circle {
      position: absolute; right: -80px; top: -80px;
      width: 480px; height: 480px; border-radius: 50%;
      background: rgba(255,255,255,0.06);
    }
    .cover-circle-2 {
      position: absolute; right: 100px; bottom: -120px;
      width: 300px; height: 300px; border-radius: 50%;
      background: rgba(255,255,255,0.04);
    }
  </style>
</head>
<body>
  <div class="slide" data-slide-id="001" data-slide-type="cover">
    <div class="cover-circle"></div>
    <div class="cover-circle-2"></div>

    <span class="cover-badge"><!-- 类别标签，如"技术分享" --></span>
    <h1 class="cover-title"><!-- 主标题 --></h1>
    <p class="cover-subtitle"><!-- 副标题/一句话描述 --></p>

    <div class="cover-meta">
      <!-- 作者 · 日期 -->
    </div>
  </div>
  <script>
    gsap.from('.cover-badge',    { y: -20, opacity: 0, duration: 0.5 })
    gsap.from('.cover-title',    { y:  30, opacity: 0, duration: 0.6, delay: 0.15 })
    gsap.from('.cover-subtitle', { y:  20, opacity: 0, duration: 0.5, delay: 0.3 })
    gsap.from('.cover-meta',     { opacity: 0, duration: 0.5, delay: 0.5 })
  </script>
</body>
</html>
```

---

### 模板 2：目录页（type: toc）

```html
<!DOCTYPE html>
<html lang="zh">
<head>
  <meta charset="UTF-8">
  <style>
    .slide {
      width: 1280px; height: 720px; overflow: hidden;
      background-color: var(--color-background);
      color: var(--color-text);
      padding: 64px 80px;
      display: grid; grid-template-columns: 1fr 2fr; gap: 64px;
      align-items: center;
    }
    .toc-left { }
    .toc-label {
      font-size: 13px; font-weight: 700; letter-spacing: 0.15em;
      text-transform: uppercase; color: var(--color-primary);
      margin-bottom: 20px;
    }
    .toc-heading {
      font-family: var(--font-heading);
      font-size: 48px; font-weight: 800;
      line-height: 1.2; color: var(--color-text);
    }
    .toc-list { list-style: none; padding: 0; }
    .toc-item {
      display: flex; align-items: center; gap: 20px;
      padding: 16px 0; border-bottom: 1px solid var(--color-border);
      cursor: default;
    }
    .toc-item:last-child { border-bottom: none; }
    .toc-number {
      font-size: 13px; font-weight: 700; color: var(--color-primary);
      font-family: var(--font-mono); min-width: 28px;
    }
    .toc-name {
      font-size: 22px; font-weight: 500; color: var(--color-text);
      flex: 1;
    }
    .toc-page {
      font-size: 14px; color: var(--color-text-muted);
      font-family: var(--font-mono);
    }
  </style>
</head>
<body>
  <div class="slide" data-slide-id="002" data-slide-type="toc">
    <div class="toc-left">
      <p class="toc-label">目录</p>
      <h1 class="toc-heading">CONTENTS</h1>
    </div>
    <ul class="toc-list">
      <!-- 循环生成：
      <li class="toc-item">
        <span class="toc-number">01</span>
        <span class="toc-name">章节名称</span>
        <span class="toc-page">P.03</span>
      </li>
      -->
    </ul>
  </div>
  <script>
    gsap.from('.toc-heading', { x: -30, opacity: 0, duration: 0.5 })
    gsap.from('.toc-item', {
      x: 40, opacity: 0, duration: 0.4,
      stagger: 0.08, delay: 0.2
    })
  </script>
</body>
</html>
```

---

### 模板 3：内容页（type: content）

```html
<!DOCTYPE html>
<html lang="zh">
<head>
  <meta charset="UTF-8">
  <style>
    .slide {
      width: 1280px; height: 720px; overflow: hidden;
      background-color: var(--color-background);
      color: var(--color-text);
      padding: 56px 80px;
    }
    .slide-tag {
      font-size: 12px; font-weight: 700; letter-spacing: 0.12em;
      text-transform: uppercase; color: var(--color-primary);
      margin-bottom: 16px;
    }
    .slide-title {
      font-family: var(--font-heading);
      font-size: 44px; font-weight: 700;
      line-height: 1.2; margin-bottom: 36px;
      color: var(--color-text);
    }
    .point-list { list-style: none; padding: 0; }
    .point-item {
      display: flex; align-items: flex-start; gap: 16px;
      margin-bottom: 24px;
    }
    .point-dot {
      width: 8px; height: 8px; border-radius: 50%;
      background: var(--color-primary);
      margin-top: 9px; flex-shrink: 0;
    }
    .point-text { font-size: 22px; line-height: 1.6; }
    .point-sub  { font-size: 18px; color: var(--color-text-muted); margin-top: 4px; }
  </style>
</head>
<body>
  <div class="slide" data-slide-id="NNN" data-slide-type="content">
    <p class="slide-tag"><!-- 章节标签 --></p>
    <h1 class="slide-title"><!-- 页面标题 --></h1>
    <ul class="point-list">
      <!-- 不超过 5 个要点：
      <li class="point-item">
        <div class="point-dot"></div>
        <div>
          <p class="point-text">要点文字</p>
          <p class="point-sub">补充说明（可选）</p>
        </div>
      </li>
      -->
    </ul>
  </div>
  <script>
    gsap.from('.slide-title', { y: -20, opacity: 0, duration: 0.45 })
    gsap.from('.point-item', {
      x: -30, opacity: 0, duration: 0.4,
      stagger: 0.1, delay: 0.2
    })
  </script>
</body>
</html>
```

---

### 模板 4：数据图表页（type: data-chart）

```html
<!DOCTYPE html>
<html lang="zh">
<head>
  <meta charset="UTF-8">
  <style>
    .slide {
      width: 1280px; height: 720px; overflow: hidden;
      background-color: var(--color-background);
      padding: 48px 64px;
      display: grid;
      grid-template-columns: 360px 1fr;
      gap: 48px; align-items: center;
    }
    .chart-side-title {
      font-family: var(--font-heading);
      font-size: 38px; font-weight: 700;
      line-height: 1.25; margin-bottom: 20px;
    }
    .chart-desc { font-size: 20px; color: var(--color-text-muted); line-height: 1.6; }
    .chart-metrics { margin-top: 32px; display: flex; flex-direction: column; gap: 20px; }
    .metric-item { }
    .metric-value {
      font-size: 48px; font-weight: 800;
      color: var(--color-primary); line-height: 1;
      font-family: var(--font-heading);
    }
    .metric-label { font-size: 16px; color: var(--color-text-muted); margin-top: 4px; }
  </style>
</head>
<body>
  <div class="slide" data-slide-id="NNN" data-slide-type="data-chart">
    <!-- 左侧：文字说明 -->
    <div>
      <h1 class="chart-side-title"><!-- 图表标题 --></h1>
      <p class="chart-desc"><!-- 一句话说明数据含义 --></p>
      <div class="chart-metrics">
        <!-- 关键数字（1-2个）
        <div class="metric-item">
          <div class="metric-value">127%</div>
          <div class="metric-label">目标完成率</div>
        </div>
        -->
      </div>
    </div>

    <!-- 右侧：ECharts 图表 -->
    <div id="chart-NNN-main" style="width: 100%; height: 540px;"></div>
  </div>

  <script>
    // ECharts 图表（全局 echarts 已加载）
    const chart = echarts.init(document.getElementById('chart-NNN-main'))
    chart.setOption({
      backgroundColor: 'transparent',
      color: ['var(--color-primary)', '#34d399', '#f59e0b', '#ec4899'],
      // ... 具体图表配置由 Agent 根据数据填写
    })

    // 动画
    gsap.from('.chart-side-title', { x: -30, opacity: 0, duration: 0.5 })
    gsap.from('.metric-value',     { textContent: 0, duration: 1.2, ease: 'power2.out',
                                     snap: { textContent: 1 }, delay: 0.3 })
    gsap.from('#chart-NNN-main',   { opacity: 0, scale: 0.95, duration: 0.6, delay: 0.2 })
  </script>
</body>
</html>
```

---

### 模板 5：结尾页（type: ending）

```html
<!DOCTYPE html>
<html lang="zh">
<head>
  <meta charset="UTF-8">
  <style>
    .slide {
      width: 1280px; height: 720px; overflow: hidden;
      background: linear-gradient(135deg, var(--color-primary) 0%, var(--color-secondary) 100%);
      display: flex; flex-direction: column;
      align-items: center; justify-content: center;
      text-align: center; position: relative;
    }
    .ending-title {
      font-family: var(--font-heading);
      font-size: 72px; font-weight: 800;
      color: #fff; letter-spacing: -0.03em;
      margin-bottom: 24px;
    }
    .ending-subtitle {
      font-size: 24px; color: rgba(255,255,255,0.75); max-width: 600px;
    }
    .ending-contact {
      position: absolute; bottom: 48px;
      display: flex; gap: 40px;
      font-size: 16px; color: rgba(255,255,255,0.6);
    }
  </style>
</head>
<body>
  <div class="slide" data-slide-id="NNN" data-slide-type="ending">
    <h1 class="ending-title">谢谢！</h1>
    <p class="ending-subtitle"><!-- 结语/联系方式提示 --></p>
    <div class="ending-contact">
      <!-- <span>📧 email@example.com</span> -->
    </div>
  </div>
  <script>
    gsap.from('.ending-title',    { scale: 0.8, opacity: 0, duration: 0.6, ease: 'back.out' })
    gsap.from('.ending-subtitle', { y: 20, opacity: 0, duration: 0.5, delay: 0.3 })
    gsap.from('.ending-contact',  { opacity: 0, duration: 0.5, delay: 0.6 })
  </script>
</body>
</html>
```

---

## 生成检查清单

生成每一页后，检查：

- [ ] `.slide` 宽高固定为 1280×720px
- [ ] 使用了 CSS 变量（`var(--color-primary)` 等）
- [ ] 文字总量不超过 150 字
- [ ] 有入场动画
- [ ] ECharts 图表 id 包含页码前缀（如 `chart-003-main`）
- [ ] 文件保存为 `slides/slide-NNN.html`（三位数字）
