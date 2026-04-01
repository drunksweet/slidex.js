export interface Theme {
  name:         string
  colors: {
    primary:    string
    secondary:  string
    background: string
    surface:    string
    text:       string
    textMuted:  string
    accent:     string
    border:     string
  }
  fonts: {
    heading: string
    body:    string
    mono:    string
  }
  borderRadius: string
  shadow:       string
}

// ─── 内置主题 ─────────────────────────────────────────────────────────────────

export const themes: Record<string, Theme> = {
  'corporate-blue': {
    name: 'Corporate Blue',
    colors: {
      primary:    '#1a56db',
      secondary:  '#1e429f',
      background: '#ffffff',
      surface:    '#f8faff',
      text:       '#111928',
      textMuted:  '#6b7280',
      accent:     '#dbeafe',
      border:     '#e5e7eb',
    },
    fonts: {
      heading: 'Inter',
      body:    'Inter',
      mono:    'JetBrains Mono',
    },
    borderRadius: '8px',
    shadow: '0 4px 24px rgba(26,86,219,0.08)',
  },

  'dark-tech': {
    name: 'Dark Tech',
    colors: {
      primary:    '#7c3aed',
      secondary:  '#5b21b6',
      background: '#0f172a',
      surface:    '#1e293b',
      text:       '#f1f5f9',
      textMuted:  '#94a3b8',
      accent:     '#1e1b4b',
      border:     '#334155',
    },
    fonts: {
      heading: 'Space Grotesk',
      body:    'Inter',
      mono:    'Fira Code',
    },
    borderRadius: '12px',
    shadow: '0 4px 32px rgba(124,58,237,0.15)',
  },

  'minimal': {
    name: 'Minimal',
    colors: {
      primary:    '#171717',
      secondary:  '#404040',
      background: '#fafafa',
      surface:    '#f5f5f5',
      text:       '#171717',
      textMuted:  '#737373',
      accent:     '#e5e5e5',
      border:     '#d4d4d4',
    },
    fonts: {
      heading: 'system-ui',
      body:    'system-ui',
      mono:    'ui-monospace',
    },
    borderRadius: '4px',
    shadow: '0 2px 8px rgba(0,0,0,0.06)',
  },

  'vibrant': {
    name: 'Vibrant',
    colors: {
      primary:    '#f97316',
      secondary:  '#ea580c',
      background: '#fff7ed',
      surface:    '#ffedd5',
      text:       '#1c1917',
      textMuted:  '#78716c',
      accent:     '#fed7aa',
      border:     '#fdba74',
    },
    fonts: {
      heading: 'Syne',
      body:    'DM Sans',
      mono:    'JetBrains Mono',
    },
    borderRadius: '16px',
    shadow: '0 4px 24px rgba(249,115,22,0.12)',
  },
}

export const defaultTheme = themes['corporate-blue']!

/**
 * 将 Theme 对象注入为 CSS 变量到指定根节点
 * 同时处理 Shadow DOM（:host）和普通 DOM（:root）
 */
export function injectTheme(
  theme: Theme,
  target: HTMLElement | ShadowRoot = document.documentElement,
): void {
  const style = document.createElement('style')
  style.setAttribute('data-tang-theme', theme.name)
  style.textContent = `
    :host, :root {
      /* 颜色 */
      --color-primary:    ${theme.colors.primary};
      --color-secondary:  ${theme.colors.secondary};
      --color-background: ${theme.colors.background};
      --color-surface:    ${theme.colors.surface};
      --color-text:       ${theme.colors.text};
      --color-text-muted: ${theme.colors.textMuted};
      --color-accent:     ${theme.colors.accent};
      --color-border:     ${theme.colors.border};

      /* 字体 */
      --font-heading:     '${theme.fonts.heading}', system-ui, sans-serif;
      --font-body:        '${theme.fonts.body}', system-ui, sans-serif;
      --font-mono:        '${theme.fonts.mono}', ui-monospace, monospace;

      /* 圆角 & 阴影 */
      --border-radius:    ${theme.borderRadius};
      --shadow:           ${theme.shadow};
    }
  `
  target.appendChild(style)
}

/**
 * 从 CSS 变量生成主题对象（用于主题读取）
 */
export function getComputedTheme(el: HTMLElement = document.documentElement): Partial<Theme['colors']> {
  const s = getComputedStyle(el)
  return {
    primary:    s.getPropertyValue('--color-primary').trim(),
    background: s.getPropertyValue('--color-background').trim(),
    text:       s.getPropertyValue('--color-text').trim(),
  }
}
