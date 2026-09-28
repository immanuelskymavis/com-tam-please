/**
 * Where every binary asset actually lives.
 *
 * Locally these are just the /public paths Vite serves. When this app is bundled
 * into a single-file artifact, there is no filesystem — every image, atlas and
 * skeleton is uploaded separately and gets its own opaque URL, so `window.__ASSETS__`
 * (injected before this bundle loads) overrides the defaults below with those URLs.
 *
 * The lookup is total and typed, so a manifest missing an entry is a build-time
 * error, not a runtime 404 discovered by a player.
 */

export type AxieSlug =
  | 'buba-beast'
  | 'olek-plant'
  | 'puffy-aquatic'
  | 'momo-bird'
  | 'pomodoro-bug'
  | 'venoki-reptile'
  | 'noir-aquatic'
  | 'xia-beast'

export type FoodSlug = 'comtam' | 'pho' | 'bun' | 'banhmi' | 'caphe' | 'che' | 'nuocmia'

export type SpineAsset = {
  json: string
  atlas: string
  png: string
  /** Filename the .atlas file's page line refers to — must match exactly. */
  imageName: string
}

export type AssetManifest = {
  axies: Record<AxieSlug, SpineAsset>
  food: Record<FoodSlug, string>
}

/**
 * Vite's base path: '/' in dev, '/<repo>/' in a GitHub Pages build. Everything in
 * /public is served beneath it, so these paths have to be built from it rather
 * than hardcoded absolute — an absolute p('axies/...') 404s on a project Pages site.
 */
const BASE = import.meta.env.BASE_URL || '/'
const p = (rel: string) => `${BASE}${rel}`.replace(/(?<!:)\/{2,}/g, '/')

const LOCAL: AssetManifest = {
  axies: {
    'buba-beast': { json: p('axies/buba-beast/skeleton.json'), atlas: p('axies/buba-beast/skeleton.atlas'), png: p('axies/buba-beast/buba.png'), imageName: 'buba.png' },
    'olek-plant': { json: p('axies/olek-plant/skeleton.json'), atlas: p('axies/olek-plant/skeleton.atlas'), png: p('axies/olek-plant/olek.png'), imageName: 'olek.png' },
    'puffy-aquatic': { json: p('axies/puffy-aquatic/skeleton.json'), atlas: p('axies/puffy-aquatic/skeleton.atlas'), png: p('axies/puffy-aquatic/03-puffy-aquatic.png'), imageName: '03-puffy-aquatic.png' },
    'momo-bird': { json: p('axies/momo-bird/skeleton.json'), atlas: p('axies/momo-bird/skeleton.atlas'), png: p('axies/momo-bird/12-momo-bird.png'), imageName: '12-momo-bird.png' },
    'pomodoro-bug': { json: p('axies/pomodoro-bug/skeleton.json'), atlas: p('axies/pomodoro-bug/skeleton.atlas'), png: p('axies/pomodoro-bug/06-pomodoro-bug.png'), imageName: '06-pomodoro-bug.png' },
    'venoki-reptile': { json: p('axies/venoki-reptile/skeleton.json'), atlas: p('axies/venoki-reptile/skeleton.atlas'), png: p('axies/venoki-reptile/07-dps-reptile.png'), imageName: '07-dps-reptile.png' },
    'noir-aquatic': { json: p('axies/noir-aquatic/skeleton.json'), atlas: p('axies/noir-aquatic/skeleton.atlas'), png: p('axies/noir-aquatic/noir.png'), imageName: 'noir.png' },
    'xia-beast': { json: p('axies/xia-beast/skeleton.json'), atlas: p('axies/xia-beast/skeleton.atlas'), png: p('axies/xia-beast/xia.png'), imageName: 'xia.png' },
  },
  food: {
    comtam: p('food/comtam.jpg'),
    pho: p('food/pho.jpg'),
    bun: p('food/bun.jpg'),
    banhmi: p('food/banhmi.jpg'),
    caphe: p('food/caphe.jpg'),
    che: p('food/che.jpg'),
    nuocmia: p('food/nuocmia.jpg'),
  },
}

declare global {
  interface Window {
    __ASSETS__?: Partial<AssetManifest>
  }
}

function resolved(): AssetManifest {
  const override = typeof window !== 'undefined' ? window.__ASSETS__ : undefined
  if (!override) return LOCAL
  return {
    axies: { ...LOCAL.axies, ...override.axies },
    food: { ...LOCAL.food, ...override.food },
  }
}

// Resolved once at module load. `window.__ASSETS__` must be set by a script tag
// that runs before this module does — true for both the Vite entry (no override,
// so this is a no-op) and the bundled artifact (override script ships first).
export const ASSETS = resolved()
