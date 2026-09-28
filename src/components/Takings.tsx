import { useEffect, useRef, useState } from 'react'
import { streakMultiplier } from '../game/scoring.ts'

/**
 * The run total, counting up.
 *
 * A number that just swaps value reads as a label; one that rolls up to it reads
 * as money landing in the till. The roll is short and eased so it lands well
 * before the next customer, and it respects prefers-reduced-motion.
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
    <div className={`takings ${gained ? 'is-up' : ''} ${lost ? 'is-down' : ''}`}>
      <span className="takings__label">Takings</span>
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

      {streak >= 2 && (
        <span className="takings__streak" title="Consecutive correct calls">
          🔥 {streak}
          <i>×{streakMultiplier(streak).toFixed(2)}</i>
        </span>
      )}
    </div>
  )
}
