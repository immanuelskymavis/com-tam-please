import { AxieStage, type Reaction } from './AxieStage.tsx'

/**
 * The hatch. The Axie stands behind it, the counter is drawn *over* them so they
 * are physically on the far side of the glass, and the dish lands on the ledge when
 * you hand it across.
 */

export type Mood = 'calm' | 'restless' | 'annoyed'

export function Booth({
  axie,
  arrivalKey,
  reaction,
  mood,
  patience,
  dialogue,
  dish,
  handedOver,
  isArmed,
  isDropTarget,
}: {
  axie: string
  arrivalKey: string
  reaction: Reaction | null
  mood: Mood
  /** 0–1. Drives the bar over the hatch and how twitchy they get. */
  patience: number
  dialogue: string
  dish: { label: string; image: string }
  handedOver: boolean
  /** Plate is in hand — show the hatch as a live target. */
  isArmed: boolean
  /** Plate is actually over the hatch. */
  isDropTarget: boolean
}) {
  return (
    <div className={`booth ${isArmed ? 'is-armed' : ''} ${isDropTarget ? 'is-target' : ''}`}>
      <div className="booth__wall" />

      {/* the opening itself */}
      <div className="booth__hatch" data-hatch>
        <div className="booth__interior">
          <AxieStage axie={axie} arrivalKey={arrivalKey} reaction={reaction} mood={mood} />
        </div>

        {handedOver && (
          <img key={`${arrivalKey}-dish`} className="dish" src={dish.image} alt={dish.label} />
        )}

        {/* drawn over the Axie: they are behind the counter, not in front of it */}
        <div className="booth__counter">
          <div className="booth__counter-top" />
          <div className="booth__counter-face" />
        </div>

        <div className="booth__glare" />

        {isArmed && (
          <div className={`booth__drop ${isDropTarget ? 'is-over' : ''}`}>
            {isDropTarget ? 'Let go' : 'Hand it over'}
          </div>
        )}
      </div>

      <div className="booth__patience" title="How long they'll wait">
        <i style={{ width: `${Math.max(0, Math.min(1, patience)) * 100}%` }} data-mood={mood} />
      </div>

      <div className="booth__speech">{dialogue}</div>
    </div>
  )
}
