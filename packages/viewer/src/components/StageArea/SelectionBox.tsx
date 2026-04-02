/**
 * SelectionBox — 编辑模式下的选中框
 *
 * 结构：
 *   - 4 条 .edge（上/下/左/右细条）：mousedown → move（改 translate）
 *   - .handle × 8（4角 + 4边中点）：mousedown → resize（改 width/height）
 *   - .rotateHandle（top-center 上方）：mousedown → rotate（改 rotate deg）
 *   - data-label（左上角标签通过 CSS ::before）
 *
 * 两种模式（data-mode 属性驱动 CSS）：
 *   normal       — 正常：边框 + 8 handle + 旋转手柄全部激活
 *   text-editing — 文字编辑中：细虚线边框标记位置，所有手柄禁用（不抢焦点）
 *
 * 关键设计：中心区完全透穿（pointer-events: none on .box），
 * 只有边框条、手柄、旋转手柄接收事件，内部 contenteditable 正常可点。
 */
import { useRef, useEffect, useImperativeHandle, forwardRef } from 'react'
import type { ResizeDirection } from '@tang-slidex/editor'
import type { EditManager } from '@tang-slidex/editor'
import styles from './SelectionBox.module.css'

export interface SelectionBoxHandle {
  update(el: HTMLElement, mode?: 'normal' | 'text-editing'): void
  hide(): void
}

interface Props {
  managerRef: React.RefObject<EditManager | null>
  onDragMove?: (el: HTMLElement) => void
  onDragEnd?: () => void
}

const HANDLES: ResizeDirection[] = ['nw', 'n', 'ne', 'w', 'e', 'sw', 's', 'se']

export const SelectionBox = forwardRef<SelectionBoxHandle, Props>(
  function SelectionBox({ managerRef, onDragMove, onDragEnd }, ref) {
    const boxRef    = useRef<HTMLDivElement>(null)
    const targetRef = useRef<HTMLElement | null>(null)
    const modeRef   = useRef<'normal' | 'text-editing'>('normal')

    useImperativeHandle(ref, () => ({
      update(el: HTMLElement, mode: 'normal' | 'text-editing' = 'normal') {
        targetRef.current = el
        modeRef.current   = mode
        positionBox(el)
        const box = boxRef.current
        if (box) box.dataset.mode = mode
      },
      hide() {
        targetRef.current = null
        modeRef.current   = 'normal'
        if (boxRef.current) {
          boxRef.current.style.display = 'none'
          delete boxRef.current.dataset.mode
        }
      },
    }))

    function positionBox(el: HTMLElement) {
      const box = boxRef.current
      if (!box) return
      const rect = el.getBoundingClientRect()
      box.style.display = 'block'
      box.style.left    = `${rect.left   - 2}px`
      box.style.top     = `${rect.top    - 2}px`
      box.style.width   = `${rect.width  + 4}px`
      box.style.height  = `${rect.height + 4}px`
      const tag = el.tagName.toLowerCase()
      const cls = el.className?.split?.(' ').find((c: string) => c && !c.startsWith('tang-')) ?? ''
      box.dataset.label = cls ? `${tag}.${cls}` : tag
    }

    // ── 通用拖拽监听器工厂 ──────────────────────────────────────────────────
    function attachDragListeners() {
      const onMove = () => {
        if (targetRef.current) {
          positionBox(targetRef.current)
          onDragMove?.(targetRef.current)
        }
      }
      const onUp = () => {
        onDragEnd?.()
        document.removeEventListener('mousemove', onMove)
        document.removeEventListener('mouseup', onUp)
      }
      document.addEventListener('mousemove', onMove)
      document.addEventListener('mouseup', onUp)
    }

    // ── 边框条 → move ────────────────────────────────────────────────────────
    function onEdgeMouseDown(e: React.MouseEvent) {
      if (modeRef.current === 'text-editing') return  // 文字编辑中：禁用拖拽
      const mgr = managerRef.current
      const el  = targetRef.current
      if (!mgr || !el) return
      e.preventDefault()
      e.stopPropagation()
      mgr.startDrag(el, e.clientX, e.clientY)
      attachDragListeners()
    }

    // ── 手柄 → resize ────────────────────────────────────────────────────────
    function onHandleMouseDown(e: React.MouseEvent, dir: ResizeDirection) {
      if (modeRef.current === 'text-editing') return  // 文字编辑中：禁用手柄
      const mgr = managerRef.current
      const el  = targetRef.current
      if (!mgr || !el) return
      e.preventDefault()
      e.stopPropagation()
      mgr.startResize(el, e.clientX, e.clientY, dir)
      attachDragListeners()
    }

    // ── 旋转手柄 → rotate ────────────────────────────────────────────────────
    function onRotateMouseDown(e: React.MouseEvent) {
      if (modeRef.current === 'text-editing') return  // 文字编辑中：禁用旋转
      const mgr = managerRef.current
      const el  = targetRef.current
      if (!mgr || !el) return
      e.preventDefault()
      e.stopPropagation()
      mgr.startRotate(el, e.clientX, e.clientY)
      attachDragListeners()
    }

    // 换页后隐藏
    useEffect(() => {
      const onLoaded = () => {
        targetRef.current = null
        modeRef.current   = 'normal'
        const box = boxRef.current
        if (box) {
          box.style.display = 'none'
          delete box.dataset.mode
        }
      }
      document.addEventListener('tang:slide-loaded', onLoaded)
      return () => document.removeEventListener('tang:slide-loaded', onLoaded)
    }, [])

    return (
      <div ref={boxRef} className={styles.box} data-label="">
        {/* 4 条边框条 */}
        <div className={`${styles.edge} ${styles.edgeTop}`}    onMouseDown={onEdgeMouseDown} />
        <div className={`${styles.edge} ${styles.edgeBottom}`} onMouseDown={onEdgeMouseDown} />
        <div className={`${styles.edge} ${styles.edgeLeft}`}   onMouseDown={onEdgeMouseDown} />
        <div className={`${styles.edge} ${styles.edgeRight}`}  onMouseDown={onEdgeMouseDown} />

        {/* 8 个缩放手柄 */}
        {HANDLES.map(dir => (
          <div
            key={dir}
            className={`${styles.handle} ${styles[`handle${dir.toUpperCase()}`]}`}
            onMouseDown={(e) => onHandleMouseDown(e, dir)}
          />
        ))}

        {/* 旋转手柄：top-center 上方，通过连接线与选中框连接 */}
        <div className={styles.rotateLine} />
        <div
          className={styles.rotateHandle}
          onMouseDown={onRotateMouseDown}
          title="拖拽旋转"
        />
      </div>
    )
  }
)
