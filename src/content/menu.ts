import { ASSETS } from '../lib/assets.ts'
/**
 * The stall's menu. Each dish carries its own photo, so the Axie can be handed the
 * thing it actually ordered. Prices are what a District 1 street stall charges.
 */
export type MenuKey =
  | 'comtam'
  | 'pho'
  | 'bun'
  | 'banhmi'
  | 'caphe'
  | 'che'
  | 'nuocmia'

export type MenuItem = {
  label: string
  price: number
  image: string
}

export const MENU: Record<MenuKey, MenuItem> = {
  comtam: { label: 'cơm tấm', price: 65_000, image: ASSETS.food.comtam },
  pho: { label: 'phở bò', price: 60_000, image: ASSETS.food.pho },
  bun: { label: 'bún thịt nướng', price: 55_000, image: ASSETS.food.bun },
  banhmi: { label: 'bánh mì', price: 25_000, image: ASSETS.food.banhmi },
  caphe: { label: 'cà phê sữa đá', price: 20_000, image: ASSETS.food.caphe },
  che: { label: 'chè', price: 25_000, image: ASSETS.food.che },
  nuocmia: { label: 'nước mía', price: 15_000, image: ASSETS.food.nuocmia },
}

export type TicketLine = { key: MenuKey; qty: number }

export const lineLabel = (l: TicketLine) => `${l.qty} × ${MENU[l.key].label}`
export const lineTotal = (l: TicketLine) => MENU[l.key].price * l.qty

/** Totals are computed, never authored — that removes a whole class of content bug. */
export const ticketTotal = (lines: TicketLine[]) =>
  lines.reduce((sum, l) => sum + lineTotal(l), 0)

/** The dish the Axie should be handed: the priciest thing on the ticket. */
export const heroDish = (lines: TicketLine[]): MenuItem =>
  MENU[lines.reduce((best, l) => (MENU[l.key].price > MENU[best.key].price ? l : best)).key]
