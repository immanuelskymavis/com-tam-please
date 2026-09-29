import { useEffect, useRef, useState } from 'react'
import { streakMultiplier } from '../game/scoring.ts'

/**
 * The weekly subtotal, counting up.
 *
 * A number that just swaps value reads as a label; one that rolls up to it reads
 * as money landing in the till. The roll is short and eased so it lands well
 * before the next customer, and it respects prefers-reduced-motion.
 *
 * The chip beside it is the live PayMoji bonus rate, because the multiplier is
 * the thing you can actually change mid-shift.
 */
export function Takings({ score, streak }: { score: number; streak: number }) {
  const [shown, setShown] = useState(score)
  const [delta, setDelta] = useState<number | null>(null)
  const frame = useRef<number>()
  const from = useRef(score)

  useEffect(() => {
    if (score === shown) return

    const gain = score - from.current
    setDelta(gain)

    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    if (reduce) {
      from.current = score
      setShown(score)
      return
    }

    const start = performance.now()
    const startValue = from.current
    const spread = score - startValue
    const ms = 620

    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / ms)
      // easeOutExpo — fast out of the gate, settles precisely.
      const eased = t === 1 ? 1 : 1 - Math.pow(2, -10 * t)
      setShown(Math.round(startValue + spread * eased))
      if (t < 1) frame.current = requestAnimationFrame(tick)
      else from.current = score
    }
    frame.current = requestAnimationFrame(tick)
    return () => {
      if (frame.current) cancelAnimationFrame(frame.current)
    }
  }, [score])

  // Clear the floating +/- after it has had time to read.
  useEffect(() => {
    if (delta === null) return
    const id = setTimeout(() => setDelta(null), 1400)
    return () => clearTimeout(id)
  }, [delta, score])

  const gained = delta !== null && delta > 0
  const lost = delta !== null && delta < 0

  return (
    <div
      className={`takings ${gained ? 'is-up' : ''} ${lost ? 'is-down' : ''} ${
        shown < 0 ? 'is-negative' : ''
      }`}
    >
      {/* The chip rides on the label's line: the board column has no spare
          height, and a chip that only appears on a streak would shunt the
          strike dots under the desk the moment it did. */}
      <span className="takings__head">
        <span className="takings__label">Week so far</span>
        {streak >= 2 && (
          <span
            className="takings__streak"
            title={`${streak} correct in a row — PayMoji is paying ×${streakMultiplier(streak).toFixed(2)}`}
          >
            <i className="takings__pm" aria-hidden="true" />
            paymoji
            <b>×{streakMultiplier(streak).toFixed(2)}</b>
          </span>
        )}
      </span>
      <span className="takings__value">
        {shown.toLocaleString('en-US')}
        <i>₫</i>
      </span>

      {delta !== null && delta !== 0 && (
        <span key={`${score}`} className={`takings__delta ${lost ? 'is-down' : ''}`}>
          {delta > 0 ? '+' : '−'}
          {Math.abs(delta).toLocaleString('en-US')}
        </span>
      )}
    </div>
  )
}
