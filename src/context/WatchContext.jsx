import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { DateTime } from 'luxon'
import tzLookup from '@photostructure/tz-lookup'
import { useClockData } from '../hooks/useClockData.js'
import { getCalendarDay } from '../calendar.js'
import { geocodeReverse, cacheLocationName } from '../geocode.js'
import { getTimezoneFallbackLabel, getGeographicOceanName } from '../core/timezoneDisplay.js'

export const INITIAL_LOCATION = {
  lat: -33.4489,
  lon: -70.6693,
  timezone: tzLookup(-33.4489, -70.6693),
}

export const DEFAULT_SAVED_LOCATIONS = [
  { id: 'scl', name: 'Santiago, Chile', coords: '33.45° S, 70.66° O', lat: -33.4489, lon: -70.6693 },
  { id: 'mad', name: 'Madrid, España', coords: '40.42° N, 3.70° O', lat: 40.4168, lon: -3.7038 },
  { id: 'nyc', name: 'Nueva York, EE. UU.', coords: '40.71° N, 74.01° O', lat: 40.7128, lon: -74.006 },
  { id: 'tyo', name: 'Tokio, Japón', coords: '35.68° N, 139.69° E', lat: 35.6762, lon: 139.6503 },
]

const LS_KEY = '6dw-saved-locations'
const MATCH_TOLERANCE = 0.05

function loadSavedLocations() {
  try {
    const raw = localStorage.getItem(LS_KEY)
    if (raw) return JSON.parse(raw)
  } catch {}
  return DEFAULT_SAVED_LOCATIONS
}

function persistSavedLocations(list) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(list))
  } catch {}
}

function findInSaved(saved, lat, lon) {
  return saved.find(
    (loc) =>
      Math.abs(loc.lat - lat) < MATCH_TOLERANCE &&
      Math.abs(loc.lon - lon) < MATCH_TOLERANCE,
  )
}

const WatchContext = createContext(null)

export function computeDayProgress(snapshot) {
  if (!snapshot?.raw) return 0
  const { now, sunriseToday, sunsetToday } = snapshot.raw
  if (!sunriseToday || !sunsetToday) return 0
  const t = now.getTime()
  const sr = sunriseToday.getTime()
  const ss = sunsetToday.getTime()
  if (t < sr) return 0
  if (t >= ss) return 1
  return (t - sr) / (ss - sr)
}

export function progressInWindow(now, start, end) {
  if (!now || !start || !end) return 0
  const t = now.getTime()
  const s = start.getTime()
  const e = end.getTime()
  if (t <= s) return 0
  if (t >= e) return 1
  return (t - s) / (e - s)
}

export function WatchProvider({ children }) {
  const [location, setLocation] = useState(INITIAL_LOCATION)
  const [savedLocations, setSavedLocations] = useState(loadSavedLocations)

  // Human-readable name for the current location.
  // null  = resolving (geocoding in progress)
  // string = resolved (could be city name or timezone fallback)
  const [locationName, setLocationName] = useState(null)

  // Keep a ref to savedLocations so the onSelectLocation callback (useCallback with no deps)
  // can read the latest list without being recreated on every save/delete.
  const savedLocationsRef = useRef(savedLocations)
  useEffect(() => {
    savedLocationsRef.current = savedLocations
  }, [savedLocations])

  // Abort controller ref to cancel stale geocoding requests.
  const geocodeAbortRef = useRef(null)

  const { snapshot, nowLuxon } = useClockData(location)

  const [calendarMonth, setCalendarMonth] = useState(() =>
    DateTime.now().setZone(INITIAL_LOCATION.timezone).startOf('month'),
  )
  const [selectedDate, setSelectedDate] = useState(() =>
    DateTime.now().setZone(INITIAL_LOCATION.timezone).startOf('day'),
  )

  // Geocode a position and update locationName.
  // If the position is already in savedLocations, uses the saved name directly.
  const resolveLocationName = useCallback((lat, lon, timezone) => {
    const saved = findInSaved(savedLocationsRef.current, lat, lon)
    if (saved) {
      setLocationName(saved.name)
      return
    }

    // Unsaved position — ask Nominatim.
    setLocationName(null) // loading
    geocodeAbortRef.current?.abort()
    const controller = new AbortController()
    geocodeAbortRef.current = controller

    geocodeReverse(lat, lon, controller.signal).then((name) => {
      if (controller.signal.aborted) return
      if (name) {
        cacheLocationName(lat, lon, name)
        setLocationName(name)
        return
      }
      // Geocoding returned nothing — use ocean name or timezone label
      const fallback = timezone?.startsWith('Etc/')
        ? (getGeographicOceanName(lat, lon) ?? getTimezoneFallbackLabel(timezone, lat, lon))
        : getTimezoneFallbackLabel(timezone, lat, lon)
      setLocationName(fallback)
    })
  }, [])

  // Geocode initial location on mount.
  useEffect(() => {
    resolveLocationName(INITIAL_LOCATION.lat, INITIAL_LOCATION.lon, INITIAL_LOCATION.timezone)
    return () => geocodeAbortRef.current?.abort()
  }, [resolveLocationName])

  const onSelectLocation = useCallback((lat, lon) => {
    const timezone = tzLookup(lat, lon)
    setLocation({ lat, lon, timezone })
    const now = DateTime.now().setZone(timezone)
    setSelectedDate(now.startOf('day'))
    setCalendarMonth(now.startOf('month'))
    resolveLocationName(lat, lon, timezone)
  }, [resolveLocationName])

  const addSavedLocation = useCallback((name, lat, lon) => {
    const absLat = Math.abs(lat).toFixed(2)
    const absLon = Math.abs(lon).toFixed(2)
    const coords = `${absLat}° ${lat >= 0 ? 'N' : 'S'}, ${absLon}° ${lon >= 0 ? 'E' : 'O'}`
    const newLoc = { id: `custom-${Date.now()}`, name, coords, lat, lon }
    setSavedLocations((prev) => {
      const updated = [...prev, newLoc]
      persistSavedLocations(updated)
      return updated
    })
    cacheLocationName(lat, lon, name)
    // Update name immediately if this is the current location.
    setLocationName((prev) => {
      const isCurrent =
        Math.abs(location.lat - lat) < MATCH_TOLERANCE &&
        Math.abs(location.lon - lon) < MATCH_TOLERANCE
      return isCurrent ? name : prev
    })
  }, [location.lat, location.lon])

  const removeSavedLocation = useCallback((id) => {
    setSavedLocations((prev) => {
      const updated = prev.filter((loc) => loc.id !== id)
      persistSavedLocations(updated)
      return updated
    })
  }, [])

  const calendarDayData = useMemo(() => {
    const { lat, lon, timezone } = location
    return getCalendarDay(selectedDate.setZone(timezone), lat, lon, timezone)
  }, [location, selectedDate])

  const timezoneLabel = useMemo(() => {
    return `${location.timezone} · Lat ${location.lat.toFixed(4)} · Lon ${location.lon.toFixed(4)}`
  }, [location])

  const dayProgress = useMemo(() => computeDayProgress(snapshot), [snapshot])

  const value = useMemo(
    () => ({
      location,
      locationName,
      setLocation,
      onSelectLocation,
      savedLocations,
      addSavedLocation,
      removeSavedLocation,
      snapshot,
      nowLuxon,
      calendarMonth,
      setCalendarMonth,
      selectedDate,
      setSelectedDate,
      calendarDayData,
      timezoneLabel,
      dayProgress,
    }),
    [
      location,
      locationName,
      onSelectLocation,
      savedLocations,
      addSavedLocation,
      removeSavedLocation,
      snapshot,
      nowLuxon,
      calendarMonth,
      selectedDate,
      calendarDayData,
      timezoneLabel,
      dayProgress,
    ],
  )

  return <WatchContext.Provider value={value}>{children}</WatchContext.Provider>
}

export function useWatch() {
  const ctx = useContext(WatchContext)
  if (!ctx) {
    throw new Error('useWatch must be used within WatchProvider')
  }
  return ctx
}
