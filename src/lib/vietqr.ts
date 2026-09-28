/**
 * VietQR (NAPAS) payload builder + parser.
 *
 * VietQR is EMVCo TLV: each field is a 2-digit tag, a 2-digit length, then the value.
 * The trailing CRC (tag 63) is CRC16-CCITT-FALSE over the whole payload *including* the
 * literal "6304" tag+length prefix.
 *
 * The detail the game is built on: a STATIC payload has no amount field (tag 54). A printed
 * sticker can't know what you ordered, so the payer types the amount themselves — which is
 * exactly where "accidental" underpayment lives. Dynamic payloads embed the amount.
 */

export const NAPAS_GUID = 'A000000727'
export const SERVICE_TRANSFER_TO_ACCOUNT = 'QRIBFTTA'
export const CURRENCY_VND = '704'

/** Bank BINs. Not exhaustive — just what the demo needs. */
export const BANK_BIN = {
  vietcombank: '970436',
  techcombank: '970407',
  bidv: '970418',
  vietinbank: '970415',
  mbbank: '970422',
  acb: '970416',
  vpbank: '970432',
  agribank: '970405',
} as const

export type BankName = keyof typeof BANK_BIN

/** BIN → the name that bank is actually allowed to print. */
export const BANK_LABEL: Record<string, string> = {
  '970436': 'Vietcombank',
  '970407': 'Techcombank',
  '970418': 'BIDV',
  '970415': 'VietinBank',
  '970422': 'MB Bank',
  '970416': 'ACB',
  '970432': 'VPBank',
  '970405': 'Agribank',
}

/** True when the printed bank name is the one that BIN belongs to. */
export const bankMatchesBin = (name: string, bin: string) =>
  BANK_LABEL[bin]?.toLowerCase() === name.trim().toLowerCase()

/** CRC16-CCITT-FALSE: poly 0x1021, init 0xFFFF, no final XOR. */
export function crc16(input: string): string {
  let crc = 0xffff
  for (const byte of new TextEncoder().encode(input)) {
    crc ^= byte << 8
    for (let i = 0; i < 8; i++) {
      crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, '0')
}

const tlv = (tag: string, value: string) =>
  `${tag}${String(value.length).padStart(2, '0')}${value}`

export type VietQrInput = {
  bank: BankName
  account: string
  /** Omit for a static (printed sticker) payload. Whole đồng only. */
  amount?: number
  merchantName?: string
  merchantCity?: string
  purpose?: string
}

export function buildVietQr(input: VietQrInput): string {
  const { bank, account, amount, merchantName, merchantCity, purpose } = input

  const merchantAccount =
    tlv('00', NAPAS_GUID) +
    tlv('01', tlv('00', BANK_BIN[bank]) + tlv('01', account)) +
    tlv('02', SERVICE_TRANSFER_TO_ACCOUNT)

  let payload =
    tlv('00', '01') +
    tlv('01', amount != null ? '12' : '11') + // 12 dynamic, 11 static
    tlv('38', merchantAccount) +
    tlv('53', CURRENCY_VND)

  if (amount != null) payload += tlv('54', String(Math.round(amount)))
  payload += tlv('58', 'VN')
  if (merchantName) payload += tlv('59', merchantName)
  if (merchantCity) payload += tlv('60', merchantCity)
  if (purpose) payload += tlv('62', tlv('08', purpose))

  payload += '6304'
  return payload + crc16(payload)
}

/** Shallow TLV parse. Nested templates (tags 38, 62) need a second call on the value. */
export function parseTlv(payload: string): Record<string, string> {
  const out: Record<string, string> = {}
  let i = 0
  while (i + 4 <= payload.length) {
    const tag = payload.slice(i, i + 2)
    const len = Number(payload.slice(i + 2, i + 4))
    if (!Number.isFinite(len)) break
    out[tag] = payload.slice(i + 4, i + 4 + len)
    i += 4 + len
  }
  return out
}

export function isCrcValid(payload: string): boolean {
  if (payload.length < 8) return false
  return crc16(payload.slice(0, -4)) === payload.slice(-4).toUpperCase()
}

export type DecodedVietQr = {
  isStatic: boolean
  amount: number | null
  bankBin: string | null
  account: string | null
  merchantName: string | null
  crcValid: boolean
}

export function decodeVietQr(payload: string): DecodedVietQr {
  const top = parseTlv(payload)
  const merchant = top['38'] ? parseTlv(top['38']) : {}
  const beneficiary = merchant['01'] ? parseTlv(merchant['01']) : {}
  return {
    isStatic: top['01'] === '11',
    amount: top['54'] ? Number(top['54']) : null,
    bankBin: beneficiary['00'] ?? null,
    account: beneficiary['01'] ?? null,
    merchantName: top['59'] ?? null,
    crcValid: isCrcValid(payload),
  }
}

/**
 * The stall's own QR, shown as set dressing on the counter.
 * Deliberately fake account number — never put a real one in a scannable code.
 */
export const CO_BA_STALL = {
  bank: 'vietcombank',
  account: '1017286654',
  merchantName: 'CO BA COM TAM',
  merchantCity: 'HO CHI MINH',
} as const satisfies Omit<VietQrInput, 'amount'>

export const stallQr = (amount?: number, purpose?: string) =>
  buildVietQr({ ...CO_BA_STALL, amount, purpose })
