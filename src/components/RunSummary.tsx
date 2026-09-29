import { useState } from 'react'
import { Button, Intent, Size } from '@axieinfinity/dango'
import {
  rankFor,
  shareOfMax,
  shareText,
  STAR_THRESHOLDS,
  starsFor,
  type RunStats,
} from '../game/scoring.ts'

/**
 * End of the run. The number is the point of the screen, so it gets the room —
 * everything else is the receipt that explains how it got there.
 */
export function RunSummary({
  stats,
  totalDays,
  onReplay,
}: {
  stats: RunStats
  totalDays: number
  onReplay: () => void
}) {
  const [copied, setCopied] = useState(false)
  const rank = rankFor(stats)
  const stars = starsFor(stats)
  const pctOfMax = shareOfMax(stats)
  const url = typeof window === 'undefined' ? '' : window.location.origin + window.location.pathname
  const accuracy =
    stats.correct + stats.wrong > 0
      ? Math.round((stats.correct / (stats.correct + stats.wrong)) * 100)
      : 0

  async function share() {
    const text = shareText(stats, totalDays, url)
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2400)
    } catch {
      // Clipboard can be refused (permissions, insecure context). Fall back to a
      // selectable textarea so the player can still copy it by hand.
      const box = document.getElementById('share-fallback') as HTMLTextAreaElement | null
      if (box) {
        box.hidden = false
        box.value = text
        box.focus()
        box.select()
      }
    }
  }

  return (
    <div className="summary">
      <div className="summary__sheet">
        <span className="summary__kicker">
          {stats.daysCleared >= totalDays
            ? `All ${totalDays} days done`
            : `Closed on day ${stats.dayReached}`}
        </span>

        <Stars earned={stars} />

        <div className="summary__total">
          <span className="summary__totalNum">{stats.score.toLocaleString('en-US')}</span>
          <span className="summary__dong">₫</span>
        </div>
        <p className="summary__rank">
          <b>{rank.title}</b>
          <span>{rank.blurb}</span>
        </p>

        {/* The bar is what the stars are actually measured against, so show it. */}
        <div className="summary__meter" role="img" aria-label={`${Math.round(pctOfMax * 100)}% of a perfect week`}>
          <div className="summary__meterTrack">
            <i style={{ width: `${Math.min(100, pctOfMax * 100)}%` }} />
            {STAR_THRESHOLDS.map((t) => (
              <u key={t} style={{ left: `${t * 100}%` }} />
            ))}
          </div>
          <span className="summary__meterCap">
            {Math.round(pctOfMax * 100)}% of a perfect week ({stats.maxScore.toLocaleString('en-US')} ₫)
          </span>
        </div>

        <dl className="summary__grid">
          <div>
            <dt>Correct calls</dt>
            <dd>{stats.correct}</dd>
          </div>
          <div>
            <dt>Mistakes</dt>
            <dd className={stats.wrong > 0 ? 'is-bad' : ''}>{stats.wrong}</dd>
          </div>
          <div>
            <dt>Walked out</dt>
            <dd>{stats.walkouts}</dd>
          </div>
          <div>
            <dt>Accuracy</dt>
            <dd>{accuracy}%</dd>
          </div>
          <div>
            <dt>Best streak</dt>
            <dd className="is-hot">🔥 {stats.bestStreak}</dd>
          </div>
          <div>
            <dt>Days cleared</dt>
            <dd>
              {stats.daysCleared}
              <span className="summary__of">/{totalDays}</span>
            </dd>
          </div>
        </dl>

        <div className="summary__actions">
          <Button
            text={copied ? 'Copied' : 'Copy result'}
            intent={Intent.Primary}
            size={Size.Large}
            onClick={share}
          />
          <Button text="Run it again" intent={Intent.Default} size={Size.Large} onClick={onReplay} />
        </div>

        <textarea id="share-fallback" className="summary__fallback" readOnly hidden rows={8} />
      </div>
    </div>
  )
}

/**
 * Three stars, filled by how close the run came to its own ceiling. They land
 * one at a time — the point of a star screen is the beat between each one.
 */
function Stars({ earned }: { earned: number }) {
  return (
    <div className="stars" role="img" aria-label={`${earned} out of 3 stars`}>
      {[1, 2, 3].map((i) => (
        <span
          key={i}
          className={`stars__s ${i <= earned ? 'is-won' : ''}`}
          style={{ animationDelay: `${120 + i * 260}ms` }}
        >
          ★
        </span>
      ))}
    </div>
  )
}
