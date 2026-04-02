# CSS Style 编辑能力调研

> **文档状态**：Draft  
> **作者**：jiaoxinheng  
> **最后更新**：2026-04-02  
> **关联文档**：[编辑功能技术方案](./编辑功能技术方案.md)

---

## 概述

本文从「市面主流 PPT / 幻灯片工具」的产品角度出发，梳理用户期待的视觉编辑能力，并逐一映射到 **CSS 属性** 层面，评估 tang-slidex 的可实现性。

调研参考产品：PowerPoint 2021、WPS 演示、Keynote 14、Google Slides、Figma（设计稿）。

> **实现前提**：tang-slidex 每张 slide 是纯 HTML 文件，所有编辑最终落地为 `style="..."` 内联属性修改（通过 `WysiwygPatch: style-prop`）。因此只要能表达为 CSS 属性值，理论上都可以做。

---

## 一、文字 / 排版

### 1.1 基础字体

| 能力 | CSS 属性 | 当前状态 | 备注 |
|------|---------|---------|------|
| 文字颜色 | `color` | ✅ 已做 | StyleTab 颜色选择器 |
| 字号 | `font-size` | ✅ 已做 | StyleTab 数字输入 |
| 加粗 | `font-weight` | ✅ 已做 | TopBar B 按钮（toggle 700/normal） |
| 斜体 | `font-style` | ✅ 已做 | TopBar I 按钮 |
| 下划线 | `text-decoration` | ✅ 已做 | TopBar U 按钮 |
| 删除线 | `text-decoration: line-through` | ❌ 未做 | TopBar 补充按钮即可 |
| 字体族 | `font-family` | ❌ 未做 | 下拉选择预设字体（中文/英文/等宽） |
| 字重（精细） | `font-weight: 100~900` | ❌ 未做 | 下拉 Thin/Regular/Medium/Bold/Black |
| 字间距 | `letter-spacing` | ❌ 未做 | 数字滑块，单位 px 或 em |
| 行高 | `line-height` | ❌ 未做 | 数字输入，常用值 1.2 / 1.5 / 2.0 |
| 文字大小写 | `text-transform` | ❌ 未做 | uppercase / lowercase / capitalize |
| 文字渲染质量 | `-webkit-font-smoothing` | ❌ 低优先级 | 一般 slide 固定为 antialiased |

### 1.2 文字对齐

| 能力 | CSS 属性 | 当前状态 | 备注 |
|------|---------|---------|------|
| 水平对齐（左/中/右/两端） | `text-align` | ❌ 未做 | TopBar 补充 4 个对齐按钮 |
| 垂直对齐（盒子内） | `vertical-align` | ❌ 低优先级 | flex 场景用 `align-items` 更合适 |

### 1.3 文字装饰进阶

| 能力 | CSS 属性 | 当前状态 | 备注 |
|------|---------|---------|------|
| 文字阴影 | `text-shadow` | ❌ 未做 | `x y blur color` 四元组，可用简化 UI |
| 文字描边 | `-webkit-text-stroke` | ❌ 未做 | `width color`，常见于海报风 slide |
| 渐变文字 | `background-clip: text` + `background: gradient` | ❌ 未做 | 复杂，优先级低 |

---

## 二、背景 / 填充

| 能力 | CSS 属性 | 当前状态 | 备注 |
|------|---------|---------|------|
| 纯色背景 | `background-color` | ✅ 已做 | StyleTab 颜色选择器 |
| 透明度 | `opacity` | ✅ 已做 | StyleTab 滑块 |
| 线性渐变 | `background: linear-gradient(...)` | ❌ 未做 | 角度 + 多色标，Figma/PPT 均有 |
| 径向渐变 | `background: radial-gradient(...)` | ❌ 未做 | 圆心 + 多色标 |
| 图片背景 | `background-image: url(...)` | ❌ 未做 | 上传图片或输入 URL |
| 背景尺寸 | `background-size` | ❌ 未做 | cover / contain / 自定义 |
| 背景位置 | `background-position` | ❌ 未做 | 九宫格选点 |
| 背景重复 | `background-repeat` | ❌ 低优先级 | no-repeat 通常就够 |

---

## 三、边框

| 能力 | CSS 属性 | 当前状态 | 备注 |
|------|---------|---------|------|
| 边框颜色 | `border-color` | ❌ 未做 | 颜色选择器 |
| 边框宽度 | `border-width` | ❌ 未做 | 数字输入，单位 px |
| 边框样式 | `border-style` | ❌ 未做 | solid / dashed / dotted 下拉 |
| 圆角 | `border-radius` | ✅ 已做 | StyleTab 滑块 |
| 圆角（各边独立） | `border-top-left-radius` 等 | ❌ 低优先级 | 先做统一圆角 |
| 单边边框 | `border-top/right/bottom/left` | ❌ 低优先级 | 分别控制四边 |

> **组合建议**：边框的颜色、宽度、样式三属性可以组合为一个「边框」区块，复用 `border` shorthand。

---

## 四、阴影

| 能力 | CSS 属性 | 当前状态 | 备注 |
|------|---------|---------|------|
| 盒阴影 | `box-shadow` | ❌ 未做 | x / y / blur / spread / color，可内外阴影 |
| 多层阴影 | `box-shadow: s1, s2, ...` | ❌ 低优先级 | 先做单层 |
| 内阴影 | `box-shadow: inset ...` | ❌ 低优先级 | toggle inset |

---

## 五、变换（Transform）

| 能力 | CSS 属性 | 当前状态 | 备注 |
|------|---------|---------|------|
| 位移（X/Y） | `transform: translate(x, y)` | ✅ 已做 | SelectionBox 拖拽 + LayoutTab 精确输入 |
| 旋转 | `transform: rotate(deg)` | ✅ 已做 | SelectionBox 旋转手柄 |
| 缩放 | `transform: scale(x, y)` | ❌ 未做 | 数字输入，PPT 有"缩放"概念 |
| 水平翻转 | `transform: scaleX(-1)` | ❌ 未做 | 翻转按钮（对图片常用） |
| 垂直翻转 | `transform: scaleY(-1)` | ❌ 未做 | 同上 |
| 倾斜 | `transform: skew(x, y)` | ❌ 低优先级 | 设计感较强，偶有需求 |
| 变换原点 | `transform-origin` | ❌ 未做 | 影响旋转/缩放中心点，默认 center center |

---

## 六、尺寸 / 布局

| 能力 | CSS 属性 | 当前状态 | 备注 |
|------|---------|---------|------|
| 宽度 | `width` | ✅（拖拽 resize）| LayoutTab 缺少精确数字输入 |
| 高度 | `height` | ✅（拖拽 resize）| 同上 |
| 宽度精确输入 | `width` | ❌ 未做 | LayoutTab 补充 W 输入框 |
| 高度精确输入 | `height` | ❌ 未做 | LayoutTab 补充 H 输入框 |
| 最小宽/高 | `min-width / min-height` | ❌ 低优先级 | — |
| 内边距（整体） | `padding` | ❌ 未做 | 数字输入，影响文字与边框的距离 |
| 内边距（各边） | `padding-top/right/bottom/left` | ❌ 低优先级 | — |
| 溢出处理 | `overflow` | ❌ 低优先级 | hidden / visible |

---

## 七、Z 轴层级

| 能力 | CSS 属性 | 当前状态 | 备注 |
|------|---------|---------|------|
| 置于顶层（+10） | `z-index` | ✅ 已做 | LayoutTab 按钮 |
| 置于底层（-10） | `z-index` | ❌ 未做 | 补充"置于底层"按钮 |
| 精确 z-index 输入 | `z-index` | ❌ 未做 | 数字输入框 |
| 上移一层 / 下移一层 | `z-index ± 1` | ❌ 未做 | 参考 PPT 的"上移一层/下移一层" |

---

## 八、透明度 / 混合模式

| 能力 | CSS 属性 | 当前状态 | 备注 |
|------|---------|---------|------|
| 元素透明度 | `opacity` | ✅ 已做 | StyleTab 滑块 |
| 背景色透明度 | `rgba(...)` in `background-color` | ❌ 未做 | 颜色选择器带 Alpha 通道（RGBA） |
| 混合模式 | `mix-blend-mode` | ❌ 低优先级 | multiply / screen / overlay 等 |
| 背景混合 | `background-blend-mode` | ❌ 低优先级 | — |

---

## 九、滤镜（Filter）

| 能力 | CSS 属性 | 当前状态 | 备注 |
|------|---------|---------|------|
| 模糊 | `filter: blur(px)` | ❌ 未做 | 对元素自身模糊（含内容） |
| 亮度 | `filter: brightness(%)` | ❌ 未做 | 图片亮度调整 |
| 对比度 | `filter: contrast(%)` | ❌ 未做 | — |
| 饱和度 | `filter: saturate(%)` | ❌ 未做 | — |
| 灰度 | `filter: grayscale(%)` | ❌ 未做 | 图片黑白化 |
| 色调旋转 | `filter: hue-rotate(deg)` | ❌ 低优先级 | — |
| 背景模糊（毛玻璃） | `backdrop-filter: blur(px)` | ❌ 未做 | 见下方专项说明 |

### 9.1 毛玻璃效果（Frosted Glass）专项说明

毛玻璃是现代 slide 设计中非常流行的视觉效果（Keynote、Figma、Notion 均大量使用），在 tang-slidex 里也完全可以支持，但有若干细节需要了解清楚。

#### CSS 实现原理

毛玻璃的完整配方通常由 **4 条 CSS 属性**共同构成：

```css
/* 核心：模糊背后的内容（不是元素自身） */
backdrop-filter: blur(12px);

/* 半透明背景色（必须有，否则 blur 不可见） */
background-color: rgba(255, 255, 255, 0.15);

/* 可选：饱和度提升，增强通透感 */
backdrop-filter: blur(12px) saturate(160%);

/* 可选：细边框增加玻璃质感 */
border: 1px solid rgba(255, 255, 255, 0.25);
```

> ⚠️ **关键约束**：`backdrop-filter` 模糊的是**该元素后方的内容**，所以元素本身必须是半透明的（`background-color` 带 alpha），才能看到透过来的模糊效果。如果 `background-color: #000`（不透明），`backdrop-filter` 完全没有视觉效果。

#### `filter: blur()` vs `backdrop-filter: blur()` 的区别

| | `filter: blur()` | `backdrop-filter: blur()` |
|---|---|---|
| 模糊对象 | 元素自身（含文字/图片/子元素） | 元素**背后**的内容 |
| 典型用途 | 图片模糊、遮罩 | 毛玻璃卡片、浮层 |
| 背景透明度要求 | 无要求 | **必须半透明** |
| 浏览器支持 | 全支持 | 全支持（Chrome 76+，Safari 9+，Firefox 103+） |

#### 在 tang-slidex 中的实现方式

毛玻璃效果本质上是 **多属性联动**，建议在 StyleTab 里做一个「毛玻璃开关」，一键设置：

```typescript
// 一键开启毛玻璃（组合 patch）
function applyFrostedGlass(el: Element, blurPx = 12, bgAlpha = 0.15) {
  applyStyle(el, 'backdrop-filter',         `blur(${blurPx}px) saturate(160%)`)
  applyStyle(el, '-webkit-backdrop-filter', `blur(${blurPx}px) saturate(160%)`)  // Safari
  applyStyle(el, 'background-color',        `rgba(255,255,255,${bgAlpha})`)
  applyStyle(el, 'border',                  '1px solid rgba(255,255,255,0.2)')
}

// 一键关闭
function removeFrostedGlass(el: Element) {
  applyStyle(el, 'backdrop-filter',         '')
  applyStyle(el, '-webkit-backdrop-filter', '')
  // background-color / border 保留，让用户自行调整
}
```

#### UI 设计建议

在 StyleTab「外观」区块中增加：

```
┌────────────────────────────────────────┐
│ 外观                                    │
│  透明度  [====|----]  75%              │  opacity
│                                        │
│  ○ 毛玻璃效果  [开关]                   │
│    模糊程度  [====|----]  12px          │  backdrop-filter: blur
│    背景透明  [====|----]  15%           │  background-color rgba alpha
└────────────────────────────────────────┘
```

#### 注意事项

1. **`backdrop-filter` 需要元素有层叠上下文**（`position: absolute/fixed` 或 `z-index` 非 auto），tang-slidex 的 slide 元素通常已经满足。
2. **Safari 需要 `-webkit-backdrop-filter` 前缀**，写回时需要同时写两条属性。
3. **性能**：大面积 `backdrop-filter` 会触发 GPU 合成层，在大量元素上使用时可能有性能影响，但 slide 场景数量有限，问题不大。
4. **`filter: blur()` 不是毛玻璃**：它模糊的是元素自身，常见误区。如果用户想让图片本身变模糊，用 `filter: blur()`；想做半透明卡片，用 `backdrop-filter: blur()`。

---

## 十、光标 / 交互提示（UX 辅助）

> 这类属性在 slide 展示场景中价值有限，但编辑时偶有需求。

| 能力 | CSS 属性 | 当前状态 | 备注 |
|------|---------|---------|------|
| 鼠标指针样式 | `cursor` | ❌ 低优先级 | pointer / default / crosshair |
| 用户选中禁止 | `user-select` | ❌ 低优先级 | 演讲时防误选文字 |

---

## 十一、过渡动画（Transition）

> 属于**样式属性**范畴，但与 GSAP 动画不同，是 CSS 自驱动。

| 能力 | CSS 属性 | 当前状态 | 备注 |
|------|---------|---------|------|
| 过渡时长 | `transition-duration` | ❌ 未做 | hover 动效常用 |
| 过渡属性 | `transition-property` | ❌ 低优先级 | all / specific |
| 过渡曲线 | `transition-timing-function` | ❌ 低优先级 | ease / linear / cubic-bezier |

---

## 优先级汇总

### 🔴 高优先级（体验差距最大，用户最频繁操作）

| # | 能力 | CSS 属性 |
|---|------|---------|
| 1 | 文字水平对齐 | `text-align` |
| 2 | 字体族选择 | `font-family` |
| 3 | 行高 | `line-height` |
| 4 | 字间距 | `letter-spacing` |
| 5 | 删除线 | `text-decoration: line-through` |
| 6 | 边框（颜色 / 宽度 / 样式） | `border` shorthand |
| 7 | 盒阴影 | `box-shadow` |
| 8 | 宽高精确输入 | `width / height` in LayoutTab |
| 9 | 置于底层 | `z-index` 减操作 |
| 10 | 背景色 Alpha 通道 | `background-color: rgba(...)` |

### 🟡 中优先级（进阶用户需要，设计感增强）

| # | 能力 | CSS 属性 |
|---|------|---------|
| 1 | 线性渐变背景 | `background: linear-gradient(...)` |
| 2 | 文字阴影 | `text-shadow` |
| 3 | 元素缩放（scale） | `transform: scale(...)` |
| 4 | 水平/垂直翻转 | `transform: scaleX/scaleY(-1)` |
| 5 | 图片背景（url + size + position） | `background-image` 组合 |
| 6 | 内边距 | `padding` |
| 7 | 背景模糊（毛玻璃） | `backdrop-filter: blur(...)` |
| 8 | 模糊滤镜 | `filter: blur(...)` |
| 9 | 字重精细控制 | `font-weight: 100~900` |
| 10 | 大小写变换 | `text-transform` |

### 🟢 低优先级（特殊场景，或有替代方案）

| # | 能力 | CSS 属性 |
|---|------|---------|
| 1 | 渐变文字 | `background-clip: text` |
| 2 | 文字描边 | `-webkit-text-stroke` |
| 3 | 混合模式 | `mix-blend-mode` |
| 4 | CSS 过渡 | `transition` |
| 5 | 单边独立圆角 | `border-*-radius` |
| 6 | 倾斜变形 | `transform: skew(...)` |
| 7 | 亮度/对比度/饱和度滤镜 | `filter` |
| 8 | 溢出处理 | `overflow` |
| 9 | 变换原点 | `transform-origin` |
| 10 | 光标样式 | `cursor` |

---

## 实现映射说明

### 与现有 Patch 系统的对接

所有上述能力均通过已有的 `WysiwygPatch: style-prop` 类型实现，**不需要新增 Patch 类型**：

```typescript
// 示例：所有操作都走这一条路
{ type: 'style-prop', anchor, property: 'text-align',    value: 'center' }
{ type: 'style-prop', anchor, property: 'letter-spacing', value: '0.05em' }
{ type: 'style-prop', anchor, property: 'box-shadow',     value: '0 4px 16px rgba(0,0,0,0.3)' }
{ type: 'style-prop', anchor, property: 'border',         value: '2px solid #3b82f6' }
{ type: 'style-prop', anchor, property: 'filter',         value: 'blur(8px)' }
```

服务端 `setInlineStyleProp()` 已经支持任意属性的增删改，无需修改后端。

### UI 分区建议

基于上述调研，建议 `StyleTab` 按如下区块重组：

```
┌─────────────────────────────────┐
│ 文字                             │  color / font-size / font-weight
│   对齐  B I U S(删除线)          │  text-align / font-style / text-decoration
│   字体  字号  字重               │  font-family / font-size / font-weight
│   行高  字间距                   │  line-height / letter-spacing
├─────────────────────────────────┤
│ 填充                             │
│   纯色  渐变  图片               │  background-color / gradient / image
├─────────────────────────────────┤
│ 边框                             │
│   颜色  宽度  样式  圆角          │  border / border-radius
├─────────────────────────────────┤
│ 阴影                             │
│   盒阴影（x y blur spread color）│  box-shadow
│   文字阴影（x y blur color）     │  text-shadow
├─────────────────────────────────┤
│ 外观                             │
│   透明度  背景模糊  滤镜          │  opacity / backdrop-filter / filter
├─────────────────────────────────┤
│ 变换                             │  
│   缩放  翻转                     │  transform: scale / scaleX / scaleY
└─────────────────────────────────┘
```

---

## 参考：各产品能力对标

| 能力 | PowerPoint | WPS | Keynote | Google Slides | tang-slidex 现状 |
|------|:---:|:---:|:---:|:---:|:---:|
| 文字颜色 | ✅ | ✅ | ✅ | ✅ | ✅ |
| 字体族 | ✅ | ✅ | ✅ | ✅ | ❌ |
| 文字对齐 | ✅ | ✅ | ✅ | ✅ | ❌ |
| 行高 | ✅ | ✅ | ✅ | ✅ | ❌ |
| 字间距 | ✅ | ✅ | ✅ | ❌ | ❌ |
| 纯色填充 | ✅ | ✅ | ✅ | ✅ | ✅ |
| 渐变填充 | ✅ | ✅ | ✅ | ✅ | ❌ |
| 图片填充 | ✅ | ✅ | ✅ | ✅ | ❌ |
| 边框 | ✅ | ✅ | ✅ | ✅ | ❌ |
| 圆角 | ✅ | ✅ | ✅ | ✅ | ✅ |
| 阴影 | ✅ | ✅ | ✅ | ✅ | ❌ |
| 透明度 | ✅ | ✅ | ✅ | ✅ | ✅ |
| 水平翻转 | ✅ | ✅ | ✅ | ✅ | ❌ |
| 模糊滤镜 | ❌ | ❌ | ✅ | ❌ | ❌ |
| 毛玻璃背景 | ❌ | ❌ | ✅ | ❌ | ❌ |
| 精确宽高输入 | ✅ | ✅ | ✅ | ✅ | ❌ |
