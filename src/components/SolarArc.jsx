import { useEffect, useRef } from 'react'
import { DateTime } from 'luxon'

import { ensureSolarArcTemplate, setSolarArcFallback, updateSolarArc } from '../ui/solarArc.js'

export default function SolarArc({ location, snapshot }) {
  const rootRef = useRef(null)
  const rafRef = useRef(null)
  const latestRef = useRef({ location, snapshot })

  latestRef.current = { location, snapshot }

  useEffect(() => {
    ensureSolarArcTemplate(rootRef.current)
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }
  }, [])

  useEffect(() => {
    const root = rootRef.current
    if (!root) return

    const step = () => {
      const { location: currentLocation, snapshot: currentSnapshot } = latestRef.current
      const { lat, lon, timezone } = currentLocation
      const now = DateTime.now().setZone(timezone).toJSDate()

      if (currentSnapshot?.polar) {
        setSolarArcFallback(root)
      } else {
        updateSolarArc(root, {
          now,
          sunriseToday: currentSnapshot.raw.sunriseToday,
          sunsetToday: currentSnapshot.raw.sunsetToday,
          activeSunset: currentSnapshot.raw.activeSunset,
          activeNextSunrise: currentSnapshot.raw.activeNextSunrise,
          timezone,
          lat,
          lon,
          solarNoon: currentSnapshot.raw.solarEvents?.solarNoon || now,
        })
      }

      rafRef.current = requestAnimationFrame(step)
    }

    rafRef.current = requestAnimationFrame(step)

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }
  }, [])

  return <div id="solar-arc" ref={rootRef}></div>
}
