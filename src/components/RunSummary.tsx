import { useState } from 'react'
import { Button, Intent, Size } from '@axieinfinity/dango'
import { rankFor, shareText, type RunStats } from '../game/scoring.ts'

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
  const rank = rankFor(stats.score)
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

        <div className="summary__total">
          <span className="summary__totalNum">{stats.score.toLocaleString('en-US')}</span>
          <span className="summary__dong">₫</span>
        </div>
        <p className="summary__rank">
          <b>{rank.title}</b>
          <span>{rank.blurb}</span>
        </p>

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
