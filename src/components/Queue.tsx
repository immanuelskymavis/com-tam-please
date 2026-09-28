import { useState } from 'react'
import { AlleyStage } from './AlleyStage.tsx'

/**
 * The minimap strip above the booth — the pavement outside, seen wide.
 *
 * Everyone moves left to right: the queue walks in from the left, through the
 * stall in the middle, and out the other side to the stools, where they sit and
 * eat the thing they actually ordered. Anyone you refused never appears — they
 * left with nothing.
 */

const STRIP_W = 1280
const STRIP_H = 152

export function Queue({
  waiting,
  eating,
  atWindow,
}: {
  waiting: string[]
  eating: { axie: string; dish: string }[]
  atWindow: string
}) {
  const [seats, setSeats] = useState<{ x: number; dish: string }[]>([])

  return (
    <div className="map">
      <div className="map__label">
        <span className="map__dot" />
        Đường Đinh Liệt · live
      </div>

      <div className="alley">
        <div className="alley__sky" />
        <div className="alley__pavement" />

        {/* the stall they queue through, dead centre */}
        <div className="stallMap">
          <div className="stallMap__roof">
            <span className="stallMap__sign">CƠM TẤM CÔ BA</span>
          </div>
          <i className="stallMap__post stallMap__post--l" />
          <i className="stallMap__post stallMap__post--r" />
          <div className="stallMap__counter" />
          <div className="stallMap__glow" />
          <span className="stallMap__arrow" aria-hidden="true" />
        </div>

        {/* Stools go behind the Axies; their food goes in front. These have to be
            separate layers — nesting the plates inside the stools' stacking context
            would cap them below the Axie canvas no matter what z-index they carry. */}
        <div className="alley__stools">
          {seats.map((s, i) => (
            <i key={i} className="stool" style={{ left: `${s.x - 13}px` }} />
          ))}
        </div>

        <AlleyStage
          waiting={waiting}
          eating={eating}
          atWindow={atWindow}
          width={STRIP_W}
          height={STRIP_H}
          onSeats={setSeats}
        />

        <div className="alley__dishes">
          {seats.map((s, i) => (
            <img key={i} className="stoolDish" src={s.dish} alt="" style={{ left: `${s.x - 46}px` }} />
          ))}
        </div>

        <div className="alley__count">
          <span>{waiting.length === 0 ? 'Last one' : `${waiting.length} waiting`}</span>
          <span className="alley__served">{eating.length} fed</span>
        </div>
      </div>
    </div>
  )
}
