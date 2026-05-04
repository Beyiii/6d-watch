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

  const dailyRef = useRef({ key: null, daily: null })
  const dayKey = `${timezone}|${lat.toFixed(4)}|${lon.toFixed(4)}|${nowLuxon.toFormat('yyyy-MM-dd')}`

  if (dailyRef.current.key !== dayKey) {
    dailyRef.current = {
      key: dayKey,
      daily: computeDailyCelestial(nowLuxon.toJSDate(), location),
    }
  }

  const snapshot = useMemo(() => {
    return computeClockSnapshot(nowLuxon, location, dailyRef.current.daily)
  }, [nowLuxon, location, dayKey])

  return { nowLuxon, snapshot }
}
