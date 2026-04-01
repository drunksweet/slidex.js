import { useUiStore } from './store/uiStore'
import { TopBar }     from './components/TopBar/TopBar'
import { SlidePanel } from './components/SlidePanel/SlidePanel'
import { StageArea }  from './components/StageArea/StageArea'
import { RightPanel } from './components/RightPanel/RightPanel'
import { StatusBar }  from './components/StatusBar/StatusBar'
import { Toast }      from './components/shared/Toast'
import styles from './App.module.css'

export function App() {
  const mode = useUiStore((s) => s.mode)

  return (
    <div className={styles.app} data-mode={mode}>
      <TopBar />
      {mode === 'edit' && <SlidePanel />}
      <StageArea />
      {mode === 'edit' && <RightPanel />}
      <StatusBar />
      <Toast />
    </div>
  )
}
