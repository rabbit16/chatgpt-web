import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Slider } from 'antd'
import styles from './index.module.less'

function isDragHandleTarget(target: EventTarget | null) {
  if (!(target instanceof Element)) return false
  return Boolean(
    target.closest(
      'a, button, input, textarea, select, label, .ant-slider, .ant-pagination, .ant-select, .ant-input-number, .ant-checkbox, .ant-switch'
    )
  )
}

/** 表格内容比容器宽时，可以按住空白处左右拖，也可以拖顶部滑块。 */
export default function HorizontalDrag({ children, watch }: { children: ReactNode; watch?: unknown }) {
  const rootRef = useRef<HTMLDivElement>(null)
  const [scrollMax, setScrollMax] = useState(0)
  const [scrollLeft, setScrollLeft] = useState(0)

  const scroller = () => {
    const root = rootRef.current
    if (!root) return null
    return (root.querySelector('.ant-table-content') || root.querySelector('.ant-table-body')) as HTMLElement | null
  }

  useEffect(() => {
    const el = scroller()
    if (!el) return
    const measure = () => {
      setScrollMax(Math.max(0, el.scrollWidth - el.clientWidth))
      setScrollLeft(el.scrollLeft)
    }
    measure()
    const onScroll = () => setScrollLeft(el.scrollLeft)
    let drag: { x: number; left: number; active: boolean } | null = null

    const onPointerDown = (event: PointerEvent) => {
      if (event.button !== 0 || isDragHandleTarget(event.target)) return
      drag = { x: event.clientX, left: el.scrollLeft, active: false }
    }
    const onPointerMove = (event: PointerEvent) => {
      if (!drag) return
      const dx = event.clientX - drag.x
      if (!drag.active && Math.abs(dx) < 4) return
      drag.active = true
      el.classList.add(styles.dragging)
      el.scrollLeft = drag.left - dx
      event.preventDefault()
    }
    const end = () => {
      drag = null
      el.classList.remove(styles.dragging)
    }

    el.addEventListener('scroll', onScroll)
    el.addEventListener('pointerdown', onPointerDown)
    window.addEventListener('pointermove', onPointerMove)
    window.addEventListener('pointerup', end)
    window.addEventListener('pointercancel', end)
    const observer = new ResizeObserver(measure)
    observer.observe(el)
    if (el.firstElementChild) observer.observe(el.firstElementChild)
    window.addEventListener('resize', measure)
    return () => {
      el.removeEventListener('scroll', onScroll)
      el.removeEventListener('pointerdown', onPointerDown)
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerup', end)
      window.removeEventListener('pointercancel', end)
      observer.disconnect()
      window.removeEventListener('resize', measure)
    }
  }, [watch])

  return (
    <div>
      {scrollMax > 0 ? (
        <div className={styles.scrollBar}>
          <span>按住表格左右拖动</span>
          <div className={styles.scrollTrack}>
            <Slider
              min={0}
              max={scrollMax}
              step={1}
              value={Math.min(scrollLeft, scrollMax)}
              tooltip={{ formatter: () => '拖动查看右侧列' }}
              onChange={(next) => {
                const el = scroller()
                if (el) el.scrollLeft = next
                setScrollLeft(next)
              }}
            />
          </div>
        </div>
      ) : null}
      <div ref={rootRef} className={styles.root}>
        {children}
      </div>
    </div>
  )
}
