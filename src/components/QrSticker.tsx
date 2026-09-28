import { useEffect, useState } from 'react'
import QR from 'qrcode'
import { stallQr } from '../lib/vietqr.ts'

/**
 * The stall's own VietQR, taped to the counter. Generated from a genuine NAPAS
 * payload with a valid CRC16, so it scans with a real banking app — the account
 * number is deliberately fake.
 *
 * On sticker days the payload is static (no amount field), which is exactly why
 * the customer has to type the amount themselves.
 */
export function QrSticker({ amount, isStatic }: { amount: number; isStatic: boolean }) {
  const [src, setSrc] = useState<string | null>(null)
  const payload = stallQr(isStatic ? undefined : amount, isStatic ? undefined : 'Com tam')

  useEffect(() => {
    let cancelled = false
    QR.toDataURL(payload, {
      margin: 1,
      width: 160,
      color: { dark: '#13161B', light: '#FFFFFF' },
      errorCorrectionLevel: 'M',
    })
      .then((url) => !cancelled && setSrc(url))
      .catch((e) => console.error('[QrSticker]', e))
    return () => {
      cancelled = true
    }
  }, [payload])

  return (
    <div className={`sticker ${isStatic ? 'sticker--printed' : ''}`}>
      {src && <img src={src} alt="Cô Ba Cơm Tấm VietQR" className="sticker__img" />}
      <div className="sticker__meta">
        <strong>Cô Ba Cơm Tấm</strong>
        <span>{isStatic ? 'Printed sticker — no amount' : `Asking ${amount.toLocaleString('en-US')} ₫`}</span>
        <span className="sticker__hint">{isStatic ? 'They type it themselves' : 'Amount is baked in'}</span>
      </div>
    </div>
  )
}
