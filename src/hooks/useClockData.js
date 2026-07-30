import { useEffect, useMemo, useRef, useState } from 'react'
import { DateTime } from 'luxon'

import { computeDailyCelestial } from '../core/celestial.js'
import { computeClockSnapshot } from '../core/clockSnapshot.js'

export function useClockData(location) {
  const { timezone, lat, lon } = location

  const [nowLuxon, setNowLuxon] = useState(() => DateTime.now().setZone(timezone))

  useEffect(() => {
    setNowLuxon(DateTime.now().setZone(timezone))
    const id = setInterval(() => {
      setNowLuxon(DateTime.now().setZone(timezone))
    }, 1000)

    return () => clearInterval(id)
  }, [timezone])

  // Al cambiar de ubicación, React renderiza una vez antes de ejecutar el efecto
  // anterior. No permitimos que ese render mezcle la nueva ubicación con la zona
  // horaria anterior.
  const zonedNowLuxon = nowLuxon.zoneName === timezone
    ? nowLuxon
    : DateTime.now().setZone(timezone)

  const dailyRef = useRef({ key: null, daily: null })
  const dayKey = `${timezone}|${lat.toFixed(4)}|${lon.toFixed(4)}|${zonedNowLuxon.toFormat('yyyy-MM-dd')}`

  if (dailyRef.current.key !== dayKey) {
    dailyRef.current = {
      key: dayKey,
      daily: computeDailyCelestial(zonedNowLuxon.toJSDate(), location),
    }
  }

  const snapshot = useMemo(() => {
    return computeClockSnapshot(zonedNowLuxon, location, dailyRef.current.daily)
  }, [zonedNowLuxon, location, dayKey])

  return { nowLuxon: zonedNowLuxon, snapshot }
}
