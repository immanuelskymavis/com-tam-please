import { TOTAL_DAYS } from '../content/days.ts'

/**
 * Where you are in the week. Five stages on a rail: done, here, still to come.
 *
 * It sits on the morning and closing cards at full size and on the counter board
 * in its compact form, so the answer to "how much is left?" is always one glance
 * away rather than something you have to remember.
 */
export function DayTrack({
  day,
  cleared,
  compact = false,
  failedDay,
}: {
  /** The day being played right now. */
  day: number
  /** How many days are banked. A replayed day is not one of them. */
  cleared: number
  compact?: boolean
  /** Marks the day that ended in three strikes, so a retry reads as a retry. */
  failedDay?: number
}) {
  const days = Array.from({ length: TOTAL_DAYS }, (_, i) => i + 1)
  // Counted off the day you're on, not off what's banked: a replayed day would
  // otherwise make the week look longer than it is.
  const after = Math.max(0, TOTAL_DAYS - day)

  return (
    <div className={`track ${compact ? 'track--compact' : ''}`}>
      <ol className="track__rail">
        {days.map((d) => {
          const done = d <= cleared
          const here = d === day && !done
          const failed = d === failedDay
          const state = failed ? 'is-failed' : done ? 'is-done' : here ? 'is-here' : 'is-todo'
          return (
            <li key={d} className={`track__stage ${state}`}>
              <span className="track__node">{done && !failed ? '✓' : d}</span>
              <span className="track__tick" aria-hidden="true" />
            </li>
          )
        })}
      </ol>
      <p className="track__caption">
        {compact ? (
          <>
            DAY {day} / {TOTAL_DAYS}
          </>
        ) : after === 0 ? (
          `Day ${day} of ${TOTAL_DAYS} · last one`
        ) : (
          `Day ${day} of ${TOTAL_DAYS} · ${after} more after today`
        )}
      </p>
    </div>
  )
}
