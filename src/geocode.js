/**
 * Reverse geocoding via Nominatim (OpenStreetMap).
 * Prefers Spanish/English names; falls back to romanized or local script.
 */

const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/reverse'
// zoom=10 → city level, avoids streets and buildings
const CITY_ZOOM = 10

// In-memory cache keyed by rounded coordinates (~1 km precision)
const nameCache = new Map()

function cacheKey(lat, lon) {
  return `${lat.toFixed(2)},${lon.toFixed(2)}`
}

// ── Script detection ───────────────────────────────────────────────────────

// Detects whether a string contains characters outside the Basic Latin / Latin Extended
// / common punctuation ranges — i.e. it uses Cyrillic, CJK, Arabic, Hebrew, etc.
const NON_LATIN_RE = /[^\u0000-\u024F\u1E00-\u1EFF]/

function isNonLatin(str) {
  return NON_LATIN_RE.test(str ?? '')
}

// ── Name preference helpers ────────────────────────────────────────────────

/**
 * Given a Nominatim namedetails object and a raw fallback string, returns the
 * most human-readable version: es → en → int_name / latin → alt_name → fallback.
 * Only substitutes when the fallback is non-Latin or a better option exists.
 */
function pickBestName(namedetails, fallback) {
  if (!namedetails && !fallback) return null
  if (!namedetails) return fallback

  const es   = namedetails['name:es']
  const en   = namedetails['name:en']
  const intl = namedetails['int_name']
  const lat  = namedetails['name:latin']
  const alt  = namedetails['alt_name']

  // Always prefer explicit Spanish translation
  if (es) return es
  // Then English
  if (en) return en
  // Then any romanized/international form
  if (intl && !isNonLatin(intl)) return intl
  if (lat && !isNonLatin(lat)) return lat
  if (alt && !isNonLatin(alt)) return alt

  // If fallback is non-Latin and we have nothing better, keep fallback (best available)
  return fallback ?? null
}

// ── Address component extractors ──────────────────────────────────────────

function pickCity(addr) {
  return (
    addr.city ||
    addr.town ||
    addr.village ||
    addr.municipality ||
    null
  )
}

function pickRegion(addr) {
  return (
    addr.state ||
    addr.region ||
    addr.province ||
    addr.county ||
    addr.state_district ||
    null
  )
}

// ── Main extractor ────────────────────────────────────────────────────────

function extractName(data) {
  const addr = data?.address
  if (!addr) return null

  // namedetails covers the primary clicked feature — useful when Accept-Language
  // couldn't localize the address components.
  const nd = data.namedetails ?? null

  const country = addr.country || null
  const cityRaw = pickCity(addr)
  const regionRaw = pickRegion(addr)

  // Attempt to improve city/region names using namedetails when they're non-Latin
  const city   = isNonLatin(cityRaw)   ? pickBestName(nd, cityRaw)   : cityRaw
  const region = isNonLatin(regionRaw) ? pickBestName(nd, regionRaw) : regionRaw

  // Country names are usually already localized by Accept-Language; improve only if non-Latin
  const countryClean = isNonLatin(country) ? pickBestName(nd, country) : country

  if (city && countryClean) return `${city}, ${countryClean}`
  if (city) return city

  if (region && countryClean) return `${region}, ${countryClean}`
  if (region) return region

  if (countryClean) return countryClean

  // Maritime / natural features
  const water = addr.ocean || addr.sea || addr.body_of_water || null
  if (water) return water

  if (data.category === 'natural' && data.name) {
    return pickBestName(nd, data.name)
  }
  if (data.category === 'natural' && data.display_name) {
    const name = data.display_name.split(',')[0].trim()
    if (name) return name
  }

  return null
}

// ── Public API ─────────────────────────────────────────────────────────────

/**
 * @param {number} lat
 * @param {number} lon
 * @param {AbortSignal | undefined} signal
 * @returns {Promise<string | null>}
 */
export async function geocodeReverse(lat, lon, signal) {
  const key = cacheKey(lat, lon)
  if (nameCache.has(key)) return nameCache.get(key)

  // accept-language as URL param is more reliable in Nominatim than the header alone
  const url =
    `${NOMINATIM_URL}?lat=${lat}&lon=${lon}` +
    `&format=json&zoom=${CITY_ZOOM}&addressdetails=1&namedetails=1&accept-language=es,en`

  let res
  try {
    res = await fetch(url, {
      signal,
      headers: {
        'User-Agent': '6D-Watch/1.0 (https://github.com/6d-watch)',
        'Accept-Language': 'es,en;q=0.9',
      },
    })
  } catch (err) {
    if (err?.name === 'AbortError') return null
    return null
  }

  if (!res.ok) return null

  try {
    const data = await res.json()
    const name = extractName(data)
    if (name) nameCache.set(key, name)
    return name
  } catch {
    return null
  }
}

/** Store a resolved name in cache (e.g. when user saves a location). */
export function cacheLocationName(lat, lon, name) {
  if (name) nameCache.set(cacheKey(lat, lon), name)
}
