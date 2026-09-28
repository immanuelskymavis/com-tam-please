import { useEffect, useState } from 'react'
import type { Receipt as ReceiptData } from '../game/types.ts'
import { dong } from '../lib/format.ts'

/**
 * The PayMoji receipt, as the customer holds it out across the counter.
 *
 * Branding is taken from paymoji.app itself: lime (#8fca2b / #c7e963) on near-black
 * (#14151a), Inter for everything. Copy follows the house tone of voice — sentence
 * case, no trailing periods on headings, numerals always, "Fees" and "Exchange rate"
 * rather than banking jargon.
 *
 * It stays warm and reassuring even when the payment is fake. A receipt that
 * telegraphs its own forgery is not a puzzle.
 */

const STATUS_COPY = {
  sent: { label: 'Sent', tone: 'good' },
  onItsWay: { label: 'On its way', tone: 'pending' },
  expired: { label: "This payment didn't go through", tone: 'bad' },
} as const

export function Receipt({
  data,
  frozenKey,
  compact = false,
}: {
  data: ReceiptData
  frozenKey: string
  /** Desk mode: the phone is one object among many, so trim the chrome. */
  compact?: boolean
}) {
  const status = STATUS_COPY[data.status]

  // A live receipt counts down. A screenshot (expiresIn === null) does not —
  // that stillness is the entire tell for the day-4 rule.
  const [remaining, setRemaining] = useState(data.expiresIn ?? 0)
  useEffect(() => {
    setRemaining(data.expiresIn ?? 0)
    if (data.expiresIn === null) return
    const id = setInterval(() => setRemaining((r) => (r > 0 ? r - 1 : 0)), 1000)
    return () => clearInterval(id)
  }, [frozenKey, data.expiresIn])

  const isFrozen = data.expiresIn === null

  return (
    <div className={`phone ${compact ? 'phone--compact' : ''}`}>
      {/* physical buttons, so it reads as a handset rather than a card */}
      <i className="phone__btn phone__btn--silent" aria-hidden="true" />
      <i className="phone__btn phone__btn--volup" aria-hidden="true" />
      <i className="phone__btn phone__btn--voldown" aria-hidden="true" />
      <i className="phone__btn phone__btn--power" aria-hidden="true" />

      <div className="phone__bezel">
        <div className={`receipt receipt--${status.tone}`}>
          <div className="phone__statusbar">
            <span className="phone__time">9:41</span>
            <span className="phone__island" aria-hidden="true" />
            <span className="phone__icons" aria-hidden="true">
              <i className="phone__cell" />
              <i className="phone__wifi" />
              <i className="phone__batt" />
            </span>
          </div>

          <div className="receipt__brand">
            <span className="receipt__mark" aria-hidden="true" />
            <span className="receipt__wordmark">paymoji</span>
            {data.fromStaticQr && <span className="receipt__chip">Printed QR</span>}
          </div>

          <div className="receipt__status">
            <h2 className="receipt__status-label">{status.label}</h2>
            {data.status === 'sent' && <p className="receipt__status-sub">{data.paidAtLabel}</p>}
            {data.status === 'expired' && (
              <p className="receipt__status-sub">The payment window closed before it settled</p>
            )}
          </div>

          <div className="receipt__amount">{dong(data.amount)}</div>

          <div className={`receipt__timer ${isFrozen ? 'is-frozen' : ''}`}>
            {isFrozen ? (
              <span className="receipt__timer-frozen">Expires in 0:57</span>
            ) : (
              <span>
                Expires in 0:{String(remaining).padStart(2, '0')}
                <i className="receipt__pulse" />
              </span>
            )}
          </div>


          <dl className="receipt__rows">
            <div className="receipt__row">
              <dt>To</dt>
              <dd>{data.merchantName}</dd>
            </div>
            <div className="receipt__row">
              <dt>Account</dt>
              <dd className="mono">{data.account}</dd>
            </div>
            <div className="receipt__row">
              <dt>Bank</dt>
              <dd>
                {data.bankName} <span className="mono receipt__bin">{data.bankBin}</span>
              </dd>
            </div>
            {data.currency !== 'VND' && (
              <div className="receipt__row receipt__row--flag">
                <dt>Settled in</dt>
                <dd className="mono">{data.currency}</dd>
              </div>
            )}
            <div className="receipt__row">
              <dt>Fees</dt>
              <dd>{dong(data.feeVnd)}</dd>
            </div>
            {data.usd != null && data.rate != null && (
              <>
                <div className="receipt__row">
                  <dt>You paid</dt>
                  <dd>${data.usd.toFixed(2)}</dd>
                </div>
                <div className="receipt__row">
                  <dt>Exchange rate</dt>
                  <dd className="mono">{data.rate.toLocaleString('en-US')} ₫/$</dd>
                </div>
              </>
            )}
            <div className="receipt__row">
              <dt>Transaction</dt>
              <dd className="mono">{data.txId}</dd>
            </div>
          </dl>

          {!compact && (
            <p className="receipt__footnote">
              You'll see the fees and rates before you pay — always
            </p>
          )}

          <span className="phone__home" aria-hidden="true" />
        </div>
      </div>
    </div>
  )
}
