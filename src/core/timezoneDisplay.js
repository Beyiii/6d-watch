import { DateTime } from 'luxon'

/**
 * Canonical IANA zones grouped by standard offset (minutes east of UTC, Jan reference).
 * Oceanic/island zones come first so the picker can prefer them for open-ocean coordinates.
 */
const CANONICAL_ZONES = {
  '-720': ['Pacific/Wallis'],
  '-660': ['Pacific/Pago_Pago', 'Pacific/Niue'],
  '-600': ['Pacific/Honolulu', 'Pacific/Tahiti', 'Pacific/Rarotonga'],
  '-570': ['Pacific/Marquesas'],
  '-540': ['Pacific/Gambier', 'America/Anchorage'],
  '-480': ['Pacific/Pitcairn', 'America/Los_Angeles', 'America/Vancouver'],
  '-420': ['America/Denver', 'America/Phoenix', 'America/Chihuahua'],
  '-360': ['Pacific/Galapagos', 'Pacific/Easter', 'America/Chicago', 'America/Mexico_City'],
  '-300': ['America/New_York', 'America/Toronto', 'America/Bogota', 'America/Lima'],
  '-240': ['America/Caracas', 'America/Santo_Domingo', 'America/La_Paz'],
  '-210': ['America/St_Johns'],
  '-180': ['America/Santiago', 'America/Argentina/Buenos_Aires', 'America/Sao_Paulo'],
  '-120': ['Atlantic/South_Georgia', 'America/Noronha'],
  '-60':  ['Atlantic/Azores', 'America/Godthab'],
  '0':   ['Atlantic/Reykjavik', 'Atlantic/St_Helena', 'Africa/Abidjan', 'Europe/London'],
  '60':  ['Africa/Lagos', 'Atlantic/South_Georgia', 'Europe/Madrid', 'Europe/Paris'],
  '120': ['Africa/Johannesburg', 'Europe/Helsinki', 'Africa/Cairo'],
  '180': ['Africa/Nairobi', 'Europe/Moscow', 'Asia/Baghdad'],
  '210': ['Asia/Tehran'],
  '240': ['Indian/Mauritius', 'Asia/Dubai', 'Asia/Baku'],
  '270': ['Asia/Kabul'],
  '300': ['Indian/Maldives', 'Asia/Karachi', 'Asia/Tashkent'],
  '330': ['Asia/Kolkata', 'Asia/Colombo'],
  '345': ['Asia/Kathmandu'],
  '360': ['Indian/Chagos', 'Asia/Dhaka', 'Asia/Almaty'],
  '390': ['Asia/Yangon'],
  '420': ['Asia/Bangkok', 'Asia/Ho_Chi_Minh'],
  '480': ['Asia/Shanghai', 'Asia/Singapore', 'Australia/Perth'],
  '525': ['Australia/Eucla'],
  '540': ['Asia/Tokyo', 'Asia/Seoul'],
  '570': ['Australia/Darwin', 'Pacific/Guam'],
  '600': ['Australia/Sydney', 'Australia/Brisbane', 'Pacific/Port_Moresby'],
  '630': ['Australia/Lord_Howe'],
  '660': ['Pacific/Guadalcanal', 'Pacific/Noumea'],
  '720': ['Pacific/Auckland', 'Pacific/Fiji'],
  '765': ['Pacific/Chatham'],
  '780': ['Pacific/Tongatapu', 'Pacific/Apia'],
  '840': ['Pacific/Kiritimati'],
}

// ── Ocean bounding helpers ──────────────────────────────────────────────────

/** True if the coordinate is likely in the Pacific Ocean (open water). */
function isLikelyPacific(lat, lon) {
  if (lat < -65 || lat > 70) return false
  if (lon >= -180 && lon <= -65) return true   // Eastern Pacific
  if (lon >= 130 && lon <= 180) return true    // Western Pacific
  return false
}

/**
 * True if the coordinate is likely in the Atlantic Ocean.
 * South Atlantic extends to the African coast (~20°E).
 * North Atlantic reaches to roughly 0° longitude (Greenwich/Iceland).
 */
function isLikelyAtlantic(lat, lon) {
  if (lat < -65 || lat > 75) return false
  if (lat < 0) {
    // South Atlantic: from ~South America coast (-55°W) to ~Africa coast (20°E)
    return lon >= -55 && lon <= 20
  }
  // North Atlantic: from Americas coast to roughly 0°–5°E (African/European coast)
  return lon >= -80 && lon <= 5
}

/**
 * True if the coordinate is likely in the Indian Ocean.
 * Starts at the African east coast (~20°E) to Australia/SE Asia (~130°E).
 */
function isLikelyIndian(lat, lon) {
  return lon >= 20 && lon <= 130 && lat >= -65 && lat <= 30
}

/** True if the coordinate is likely in the Arctic Ocean. */
function isLikelyArctic(lat) {
  return lat > 75
}

/** True if the coordinate is likely in the Southern/Antarctic Ocean. */
function isLikelySouthern(lat) {
  return lat < -60
}

// ── Name picker ────────────────────────────────────────────────────────────

function pickByCoords(candidates, lat, lon) {
  if (candidates.length === 1) return candidates[0]

  const inPacific = isLikelyPacific(lat, lon)
  const inAtlantic = isLikelyAtlantic(lat, lon)
  const inIndian = isLikelyIndian(lat, lon)

  const scored = candidates.map((zone) => {
    let score = 0

    if (inPacific) {
      if (zone.startsWith('Pacific/')) score += 20
      // Pacific/Easter and Pacific/Galapagos are good for East Pacific
      if (zone === 'Pacific/Easter' || zone === 'Pacific/Galapagos') score += 5
      // Avoid continental American cities for ocean points
      if (zone.startsWith('America/')) score -= 5
    } else if (inAtlantic) {
      if (zone.startsWith('Atlantic/')) score += 20
      if (zone.startsWith('America/')) score += 5 // Atlantic coast cities are OK
      if (zone.startsWith('Europe/') || zone.startsWith('Africa/')) score += 5
    } else if (inIndian) {
      if (zone.startsWith('Indian/')) score += 20
      if (zone.startsWith('Asia/') || zone.startsWith('Africa/') || zone.startsWith('Australia/')) score += 5
    } else {
      // Land/coast heuristic by longitude band
      if (lon >= -170 && lon < -30) {
        if (zone.startsWith('America/')) score += 10
        if (zone.startsWith('Pacific/')) score += 5
      } else if (lon >= -30 && lon < 60) {
        if (zone.startsWith('Europe/')) score += 10
        if (zone.startsWith('Africa/')) score += 8
        if (zone.startsWith('Atlantic/')) score += 5
      } else if (lon >= 60 && lon <= 180) {
        if (zone.startsWith('Asia/')) score += 10
        if (zone.startsWith('Australia/')) score += 8
        if (zone.startsWith('Pacific/')) score += 6
        if (zone.startsWith('Indian/')) score += 6
      }
    }

    // North/south disambiguation within the same prefix
    if (lat < -15) {
      if (zone.includes('Santiago') || zone.includes('Buenos_Aires') || zone.includes('Sao_Paulo')) score += 3
      if (zone.includes('Auckland') || zone.includes('Sydney')) score += 3
      if (zone.includes('South_Georgia')) score += 3
      if (zone.includes('Pago_Pago') || zone.includes('Tahiti')) score += 3
    } else if (lat > 30) {
      if (zone.includes('Tokyo') || zone.includes('Seoul') || zone.includes('Shanghai')) score += 2
      if (zone.includes('Paris') || zone.includes('London') || zone.includes('Madrid')) score += 2
    }

    return { zone, score }
  })

  scored.sort((a, b) => b.score - a.score)
  return scored[0]?.zone ?? candidates[0]
}

// ── Public API ─────────────────────────────────────────────────────────────

/**
 * Returns a human-friendly IANA timezone for UI display.
 * Only replaces Etc/GMT* zones; real named zones are returned unchanged.
 */
export function getDisplayTimezone(rawTz, lat, lon) {
  if (!rawTz || !rawTz.startsWith('Etc/')) return rawTz

  const ref = DateTime.fromObject({ year: 2024, month: 1, day: 15, hour: 12 }, { zone: rawTz })
  const offsetMin = ref.isValid ? ref.offset : DateTime.now().setZone(rawTz).offset

  const candidates = CANONICAL_ZONES[String(offsetMin)]
  if (!candidates?.length) return rawTz

  return pickByCoords(candidates, lat, lon)
}

/**
 * Geographic ocean/sea name derived from coordinates alone.
 * Returns null when the point is likely on land (named timezone available).
 * Only called for Etc/GMT timezone points.
 */
export function getGeographicOceanName(lat, lon) {
  if (isLikelySouthern(lat)) return 'Océano Antártico'
  if (isLikelyArctic(lat)) return 'Océano Ártico'

  if (isLikelyPacific(lat, lon)) {
    return lat >= 0 ? 'Océano Pacífico Norte' : 'Océano Pacífico Sur'
  }
  if (isLikelyAtlantic(lat, lon)) {
    return lat >= 0 ? 'Océano Atlántico Norte' : 'Océano Atlántico Sur'
  }
  if (isLikelyIndian(lat, lon)) {
    return 'Océano Índico'
  }

  return null
}

/**
 * Complete fallback label chain: ocean name → friendly IANA tz → coordinates.
 * Use only for Etc/GMT timezone points where geocoding returned nothing.
 */
export function getTimezoneFallbackLabel(rawTz, lat, lon) {
  // For Etc/GMT zones (open ocean), try geographic ocean name first
  if (rawTz?.startsWith('Etc/')) {
    const oceanName = getGeographicOceanName(lat, lon)
    if (oceanName) return oceanName
  }

  const displayTz = getDisplayTimezone(rawTz, lat, lon)
  if (displayTz && !displayTz.startsWith('Etc/')) return displayTz

  const latStr = `${Math.abs(lat).toFixed(2)}° ${lat >= 0 ? 'N' : 'S'}`
  const lonStr = `${Math.abs(lon).toFixed(2)}° ${lon >= 0 ? 'E' : 'O'}`
  return `${latStr}, ${lonStr}`
}
