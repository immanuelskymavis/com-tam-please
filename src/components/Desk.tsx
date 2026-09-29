import type { PointerEvent as ReactPointerEvent } from 'react'
import type { Rule } from '../game/types.ts'
import type { MenuItem, TicketLine } from '../content/menu.ts'
import { MENU } from '../content/menu.ts'
import { Receipt } from './Receipt.tsx'
import { QrSticker } from './QrSticker.tsx'
import type { Receipt as ReceiptData } from '../game/types.ts'

/**
 * Your side of the counter. Deliberately crowded: the POS terminal, the customer's
 * phone pushed across at you, the QR scanner, the rulebook, the warming tray, and
 * the working clutter of a stall that also has to cook.
 *
 * The two things you can pick up are the plate (hand it over to serve) and the
 * DENIED stamp (drop it on the phone to refuse).
 */

export function Desk({
  receipt,
  frozenKey,
  lines,
  total,
  isStaticQr,
  rules,
  newRuleIds,
  log,
  dish,
  plateHeld,
  stampHeld,
  stampArmed,
  stampOver,
  onGrab,
  rulebookOpen,
  onToggleRulebook,
  boardRate,
}: {
  receipt: ReceiptData
  frozenKey: string
  lines: TicketLine[]
  total: number
  isStaticQr: boolean
  rules: Rule[]
  newRuleIds?: string[]
  log: string[]
  dish: MenuItem
  plateHeld: boolean
  stampHeld: boolean
  /** Stamp is in hand — show the phone as a live target. */
  stampArmed: boolean
  /** Stamp is actually over the phone. */
  stampOver: boolean
  onGrab: (id: string, e: ReactPointerEvent) => void
  rulebookOpen: boolean
  onToggleRulebook: () => void
  boardRate: number
}) {
  return (
    <div className="desk">
      {/* ---- rulebook, hinged open like PP's ---- */}
      <div className={`rulebook ${rulebookOpen ? 'is-open' : ''}`}>
        <button className="rulebook__tab" onClick={onToggleRulebook}>
          {rulebookOpen ? 'CLOSE' : 'RULES'}
          <span className="rulebook__count">{rules.length}</span>
        </button>
        {rulebookOpen && (
          <div className="rulebook__page">
            <h4>Cô Ba — house rules</h4>
            <ol>
              {rules.map((r) => (
                <li key={r.id} className={newRuleIds?.includes(r.id) ? 'is-new' : ''}>
                  <strong>{r.label}</strong>
                  <span>{r.hint}</span>
                </li>
              ))}
            </ol>
            <p className="rulebook__board">
              Board rate today · <b>{boardRate.toLocaleString('en-US')} ₫/$</b>
            </p>
          </div>
        )}
      </div>

      {/* ---- the customer's phone, pushed across the counter ---- */}
      <div
        className={`desk__phone ${stampArmed ? 'is-armed' : ''} ${stampOver ? 'is-over' : ''}`}
        data-phone
      >
        <Receipt data={receipt} frozenKey={frozenKey} compact />
        {stampArmed && <span className="dropTag dropTag--stamp">Stamp here</span>}
      </div>

      {/* ---- your POS terminal ---- */}
      <div className="pos">
        <div className="pos__screen">
          <div className="pos__head">
            <span>CÔ BA POS</span>
            <span className="pos__dot" />
          </div>
          <ul className="pos__lines">
            {lines.map((l) => (
              <li key={l.key}>
                <span>
                  {l.qty}× {MENU[l.key].label}
                </span>
                <span>{(MENU[l.key].price * l.qty).toLocaleString('en-US')}</span>
              </li>
            ))}
          </ul>
          <div className="pos__total">
            <span>DUE</span>
            <span>{total.toLocaleString('en-US')} ₫</span>
          </div>
        </div>
        <div className="pos__keys">
          {Array.from({ length: 12 }).map((_, i) => (
            <i key={i} />
          ))}
        </div>
      </div>

      {/* ---- scanner + the stall's own QR ---- */}
      <div className="scanner">
        <div className="scanner__body">
          <div className="scanner__lens">
            <i className="scanner__laser" />
          </div>
          <span className="scanner__label">SCAN</span>
        </div>
        <QrSticker amount={total} isStatic={isStaticQr} />
      </div>

      {/* ---- today's transaction log, on a spike ---- */}
      <div className="deskLog">
        <h4>LOG</h4>
        {log.length === 0 ? (
          <p className="deskLog__empty">—</p>
        ) : (
          <ul>
            {log.map((id, i) => (
              <li key={`${id}-${i}`}>{id}</li>
            ))}
          </ul>
        )}
      </div>

      {/* ---- the two things you can pick up, same size, same affordance ---- */}
      <div className="tools">
        <div className="tools__rail" />

        <button
          className={`tool tool--plate ${plateHeld ? 'is-held' : ''}`}
          onPointerDown={(e) => onGrab('plate', e)}
          aria-label={`Hand over the ${dish.label}`}
        >
          <span className="tool__grab" aria-hidden="true" />
          <span className="tool__face">
            <img src={dish.image} alt="" draggable={false} />
          </span>
          <span className="tool__name">{dish.label}</span>
          <span className="tool__hint">drag to hatch</span>
        </button>

        <button
          className={`tool tool--stamp ${stampHeld ? 'is-held' : ''}`}
          onPointerDown={(e) => onGrab('stamp', e)}
          aria-label="Refuse this payment"
        >
          <span className="tool__grab" aria-hidden="true" />
          <span className="tool__face tool__face--stamp">
            <span className="tool__stampHead">DENIED</span>
          </span>
          <span className="tool__name">refuse</span>
          <span className="tool__hint">drag to phone</span>
        </button>
      </div>

      {/* ---- clutter: it is a food stall, not a desk ---- */}
      <div className="clutter">
        <i className="prop prop--pot" title="nồi nước dùng" />
        <i className="prop prop--chopsticks" title="đũa" />
        <i className="prop prop--chilli" title="ớt" />
        <i className="prop prop--sauce" title="nước mắm" />
        <i className="prop prop--herbs" title="rau thơm" />
        <i className="prop prop--bowls" title="bát" />
        <i className="prop prop--napkins" />
      </div>
    </div>
  )
}
