import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * Pointer-based drag for desk objects. HTML5 drag-and-drop is the wrong tool here —
 * it has its own drag image, ignores pointer capture, and cannot express "hold the
 * plate over the hatch". This just follows the pointer and asks, on release,
 * whether we're over a drop zone.
 */

export type DragState = {
  id: string
  /** Offset from the element's top-left, so it doesn't snap to the cursor. */
  dx: number
  dy: number
  x: number
  y: number
}

type Options = {
  /** Called on release while over an element matching this selector. */
  onDrop: (id: string, dropZone: string) => void
  /** Selectors that count as drop zones, checked in order. */
  zones: string[]
}

export function useDrag({ onDrop, zones }: Options) {
  const [drag, setDrag] = useState<DragState | null>(null)
  const [hoverZone, setHoverZone] = useState<string | null>(null)
  const dragRef = useRef<DragState | null>(null)
  dragRef.current = drag

  const zoneAt = useCallback(
    (x: number, y: number) => {
      // elementsFromPoint, not elementFromPoint: the dragged object itself sits
      // under the cursor and would otherwise mask everything beneath it.
      const stack = document.elementsFromPoint(x, y)
      for (const zone of zones) {
        if (stack.some((el) => el.closest(zone))) return zone
      }
      return null
    },
    [zones],
  )

  const start = useCallback((id: string, e: React.PointerEvent) => {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    ;(e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId)
    setDrag({
      id,
      dx: e.clientX - rect.left,
      dy: e.clientY - rect.top,
      x: e.clientX,
      y: e.clientY,
    })
  }, [])

  useEffect(() => {
    if (!drag) return

    const move = (e: PointerEvent) => {
      setDrag((d) => (d ? { ...d, x: e.clientX, y: e.clientY } : d))
      setHoverZone(zoneAt(e.clientX, e.clientY))
    }
    const end = (e: PointerEvent) => {
      const current = dragRef.current
      const zone = zoneAt(e.clientX, e.clientY)
      setDrag(null)
      setHoverZone(null)
      if (current && zone) onDrop(current.id, zone)
    }

    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', end)
    window.addEventListener('pointercancel', end)
    return () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', end)
      window.removeEventListener('pointercancel', end)
    }
  }, [drag, onDrop, zoneAt])

  return { drag, hoverZone, start }
}
