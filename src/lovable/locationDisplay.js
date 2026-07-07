import { getDisplayTimezone, getTimezoneFallbackLabel, getGeographicOceanName } from '../core/timezoneDisplay.js'

export const MATCH_TOLERANCE = 0.05

export function matchSavedLocation(location, savedLocations) {
  return savedLocations.find(
    (loc) =>
      Math.abs(location.lat - loc.lat) < MATCH_TOLERANCE &&
      Math.abs(location.lon - loc.lon) < MATCH_TOLERANCE,
  )
}

export function formatCoordsShort(lat, lon) {
  const latStr = `${Math.abs(lat).toFixed(2)}° ${lat >= 0 ? 'N' : 'S'}`
  const lonStr = `${Math.abs(lon).toFixed(2)}° ${lon >= 0 ? 'E' : 'O'}`
  return `${latStr}, ${lonStr}`
}

/**
 * Unified display label for the active location.
 * Priority: saved name → geocoded name → friendly IANA tz → coordinates.
 */
export function getActiveLocationLabel({ location, locationName, savedLocations }) {
  const savedMatch = matchSavedLocation(location, savedLocations)
  if (savedMatch) return savedMatch.name
  if (locationName) return locationName
  return getTimezoneFallbackLabel(location.timezone, location.lat, location.lon)
}

/** Interim label while geocoding is in progress. */
export function getLoadingLocationLabel({ location }) {
  const { lat, lon, timezone } = location
  // For ocean points show ocean name immediately rather than an Etc/GMT zone
  if (timezone?.startsWith('Etc/')) {
    const ocean = getGeographicOceanName(lat, lon)
    if (ocean) return ocean
  }
  const displayTz = getDisplayTimezone(timezone, lat, lon)
  if (displayTz && !displayTz.startsWith('Etc/')) return displayTz
  return getTimezoneFallbackLabel(timezone, lat, lon)
}

export function getActiveLocationName(location, savedLocations, fallback) {
  return matchSavedLocation(location, savedLocations)?.name ?? fallback
}
