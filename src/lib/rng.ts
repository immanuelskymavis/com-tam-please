/**
 * A small seeded PRNG, so a run is random between plays but reproducible within
 * one. Every day's content is derived from `hash(runSeed, day)` rather than from
 * a single rolling stream — that way replaying day 3 deals the same day 3, and
 * the headless sim and screenshot harness can pin a seed and get real content.
 */
export type Rng = () => number

export function mulberry32(seed: number): Rng {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** FNV-1a over the stringified parts. Mixes a run seed with a day number. */
export function hashSeed(...parts: (number | string)[]): number {
  let h = 0x811c9dc5
  for (const part of parts) {
    for (const ch of String(part)) {
      h ^= ch.charCodeAt(0)
      h = Math.imul(h, 0x01000193)
    }
    h ^= 0x2f
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}

export const pick = <T>(rng: Rng, items: readonly T[]): T =>
  items[Math.floor(rng() * items.length) % items.length]

export function shuffle<T>(rng: Rng, items: readonly T[]): T[] {
  const out = items.slice()
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

/** n distinct items. Falls back to repeats only if asked for more than exist. */
export function sample<T>(rng: Rng, items: readonly T[], n: number): T[] {
  if (n <= items.length) return shuffle(rng, items).slice(0, n)
  const out = shuffle(rng, items)
  while (out.length < n) out.push(pick(rng, items))
  return out
}

/** An 8-char lowercase hex transaction id, in the same shape PayMoji prints. */
export const hexId = (rng: Rng, len = 8): string => {
  let out = ''
  while (out.length < len) out += Math.floor(rng() * 16).toString(16)
  return out
}

export const intBetween = (rng: Rng, lo: number, hi: number) =>
  lo + Math.floor(rng() * (hi - lo + 1))
