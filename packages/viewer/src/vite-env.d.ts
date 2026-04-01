/// <reference types="vite/client" />

// CSS Modules — 让 TS 识别 import styles from '*.module.css'
declare module '*.module.css' {
  const classes: { readonly [key: string]: string }
  export default classes
}
