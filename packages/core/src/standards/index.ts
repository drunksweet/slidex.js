// PPT 规范常量
export const SLIDE_STANDARDS = {
  // 尺寸规范
  dimensions: {
    '16:9': { width: 1280, height: 720  },
    '4:3':  { width: 1024, height: 768  },
    'A4':   { width: 794,  height: 1123 },
  },

  // 字体规范
  typography: {
    title:    { size: '52px', weight: 700, lineHeight: 1.2, maxChars: 30  },
    subtitle: { size: '32px', weight: 500, lineHeight: 1.4, maxChars: 60  },
    body:     { size: '22px', weight: 400, lineHeight: 1.6, maxChars: 150 },
    caption:  { size: '15px', weight: 300, lineHeight: 1.5                },
  },

  // 排版规则
  layout: {
    maxBulletPoints:    5,
    minWhiteSpaceRatio: 0.3,   // 留白至少 30%
    safeZone: { top: 48, right: 64, bottom: 48, left: 64 }, // px 安全区
  },

  // 动画时长（ms）
  animation: {
    enter:      { min: 300, max: 600 },
    transition: { min: 300, max: 600 },
    countUp:    800,
  },

  // 支持的页面类型
  slideTypes: [
    'cover',        // 封面
    'toc',          // 目录
    'section',      // 章节分隔页
    'content',      // 纯文字内容
    'data-chart',   // 数据图表
    'comparison',   // 对比分析
    'quote',        // 引言
    'image-focus',  // 全图
    'ending',       // 结尾
  ],
} as const

export type AspectRatio    = keyof typeof SLIDE_STANDARDS.dimensions
export type SlideType      = typeof SLIDE_STANDARDS.slideTypes[number]
export type TransitionType = 'fade' | 'slide' | 'zoom' | 'none'
