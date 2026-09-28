import { Button, Intent, Size } from '@axieinfinity/dango'
import { AxieStage } from './AxieStage.tsx'

/**
 * The title card. A stall front at night: awning, string lights, a hand-painted
 * board, and one Axie already waiting at the counter for you to open up.
 */
export function TitleScreen({ onStart }: { onStart: () => void }) {
  return (
    <div className="title">
      <div className="title__street" />
      <div className="title__awning" />
      <div className="title__bulbs" />

      <div className="title__inner">
        <div className="title__left">
          <span className="title__eyebrow">Quận 1 · Sài Gòn</span>

          <h1 className="title__name">
            <span className="title__line title__line--1">Cơm Tấm,</span>
            <span className="title__line title__line--2">
              Please
              <i className="title__stamp">Cô Ba</i>
            </span>
          </h1>

          <p className="title__blurb">
            Grandma left you the stall. Tourists pay by QR, and you never see the money
            land — you see their phone, and you decide whether to believe it.
          </p>

          <div className="title__meta">
            <span>
              <b>10</b> days
            </span>
            <span>
              <b>9</b> rules
            </span>
            <span>
              <b>41</b> customers
            </span>
          </div>

          <div className="title__cta">
            <Button
              text="Open the stall"
              intent={Intent.Primary}
              size={Size.Large}
              onClick={onStart}
            />
            <span className="title__hint">Hand over the plate to serve · stamp the phone to refuse</span>
          </div>

          <div className="title__foot">
            <span className="title__pm">
              <i className="title__pmMark" />
              paymoji
            </span>
            <span className="title__footText">Scan, check, done — if it's real</span>
          </div>
        </div>

        <div className="title__right">
          <div className="title__counterTop" />
          <div className="title__axie">
            <AxieStage axie="buba-beast" arrivalKey="title" reaction={null} mood="calm" />
          </div>
          <div className="title__counter">
            <span className="title__board">
              <b>65,000 ₫</b>
              <i>cơm tấm sườn</i>
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
