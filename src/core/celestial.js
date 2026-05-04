import SunCalc from 'suncalc'
import { DateTime } from 'luxon'
import { getSolarEvents, getLunarData } from '../astronomy.js'

// Lógica "de dominio": calcula datos solares/lunares para el reloj en vivo.
// Determinista respecto a (nowJsDate, location). No toca DOM.
export function computeDailyCelestial(nowJsDate, location) {
  const { lat, lon, timezone } = location
  const nowLuxon = DateTime.fromJSDate(nowJsDate).setZone(timezone)

  const MS_PER_DAY = 24 * 60 * 60 * 1000
  const MAX_SEARCH_DAYS = 370

  const isValidDate = (d) => d instanceof Date && Number.isFinite(d.getTime())

  const getTimesForLocalDay = (dayLuxon) => {
    const noonJs = dayLuxon.set({ hour: 12, minute: 0, second: 0, millisecond: 0 }).toJSDate()
    return SunCalc.getTimes(noonJs, lat, lon)
  }

  const findPrevEvent = (eventName) => {
    const now = nowJsDate
    for (let i = 0; i <= MAX_SEARCH_DAYS; i += 1) {
      const day = nowLuxon.minus({ days: i })
      const times = getTimesForLocalDay(day)
      const candidate = times?.[eventName]
      if (isValidDate(candidate) && candidate.getTime() <= now.getTime()) return candidate
    }
    return null
  }

  const findNextEvent = (eventName) => {
    const now = nowJsDate
    for (let i = 0; i <= MAX_SEARCH_DAYS; i += 1) {
      const day = nowLuxon.plus({ days: i })
      const times = getTimesForLocalDay(day)
      const candidate = times?.[eventName]
      if (isValidDate(candidate) && candidate.getTime() >= now.getTime()) return candidate
    }
    return null
  }

  // Usamos mediodía local para que "hoy/ayer/mañana" tenga sentido en el timezone seleccionado.
  const today = nowLuxon
  const yesterday = nowLuxon.minus({ days: 1 })
  const tomorrow = nowLuxon.plus({ days: 1 })

  const sunTimesToday = getTimesForLocalDay(today)
  const sunTimesYesterday = getTimesForLocalDay(yesterday)
  const sunTimesTomorrow = getTimesForLocalDay(tomorrow)

  const nextSunrise = sunTimesTomorrow.sunrise ?? null

  const solarEvents = getSolarEvents(nowJsDate, lat, lon)
  const lunarData = getLunarData(nowJsDate, lat, lon)

  // Ventana solar (polar-aware): busca el amanecer/atardecer más cercano aunque esté a días.
  // Esto permite una hora geométrica "lenta" durante día/noche polar.
  const sunPosNow = SunCalc.getPosition(nowJsDate, lat, lon)
  const sunUpNow = sunPosNow.altitude >= 0

  const sunriseToday = isValidDate(sunTimesToday.sunrise) ? sunTimesToday.sunrise : null
  const sunsetToday = isValidDate(sunTimesToday.sunset) ? sunTimesToday.sunset : null

  const prevSunrise = isValidDate(sunriseToday) && sunriseToday.getTime() <= nowJsDate.getTime()
    ? sunriseToday
    : findPrevEvent('sunrise')

  const nextSunset = isValidDate(sunsetToday) && sunsetToday.getTime() >= nowJsDate.getTime()
    ? sunsetToday
    : findNextEvent('sunset')

  const prevSunset = isValidDate(sunsetToday) && sunsetToday.getTime() <= nowJsDate.getTime()
    ? sunsetToday
    : findPrevEvent('sunset')

  const nextSunriseWindow = isValidDate(sunriseToday) && sunriseToday.getTime() >= nowJsDate.getTime()
    ? sunriseToday
    : findNextEvent('sunrise')

  const windowKind = sunUpNow ? 'day' : 'night'
  const windowStart = sunUpNow ? prevSunrise : prevSunset
  const windowEnd = sunUpNow ? nextSunset : nextSunriseWindow

  const windowDurationMs = windowStart && windowEnd ? windowEnd.getTime() - windowStart.getTime() : null
  const untilNextTransitionMs = windowEnd ? windowEnd.getTime() - nowJsDate.getTime() : null

  const isPolar = !sunriseToday || !sunsetToday || (typeof windowDurationMs === 'number' && windowDurationMs > MS_PER_DAY)
  const polarKind = isPolar ? (sunUpNow ? 'polar-day' : 'polar-night') : null

  const solarWindow = {
    sunUpNow,
    windowKind,
    windowStart,
    windowEnd,
    windowDurationMs,
    untilNextTransitionMs,
    isPolar,
    polarKind,
    prevSunrise,
    nextSunset,
    prevSunset,
    nextSunrise: nextSunriseWindow,
  }

  return {
    sunTimesToday,
    sunTimesYesterday,
    nextSunrise,
    solarEvents,
    lunarData,
    solarWindow,
  }
}
