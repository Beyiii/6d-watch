import { DateTime } from 'luxon'
import { computeDailyCelestial } from './celestial.js'
import { computeGeometricHour, formatGeometricTime, splitGeometricHMS } from './geometricTime.js'
import { formatDuration, formatDurationDHMS, formatDurationLong, formatTimeDual } from './timeFormat.js'

// Crea un "snapshot" listo para UI a partir de ahora + ubicación.
// No toca DOM (pero sí formatea strings para mostrar).
export function computeClockSnapshot(nowLuxon, location, dailyCelestial = null) {
  const { lat, lon, timezone } = location
  const now = nowLuxon.toJSDate()

  const isValidDate = (d) => d instanceof Date && Number.isFinite(d.getTime())

  const { sunTimesToday, sunTimesYesterday, nextSunrise, solarEvents, lunarData, solarWindow } =
    dailyCelestial ?? computeDailyCelestial(now, location)

  const sunriseToday = isValidDate(sunTimesToday.sunrise) ? sunTimesToday.sunrise : null
  const sunsetToday = isValidDate(sunTimesToday.sunset) ? sunTimesToday.sunset : null

  const civilTime = nowLuxon.toFormat('HH:mm:ss')
  const dateLong = nowLuxon.setLocale('es').toFormat("cccc dd 'de' LLLL, yyyy")

  // En casos polares (o extremos), SunCalc puede no entregar amanecer/atardecer “hoy”.
  // En vez de abortar, usamos una ventana extendida (previo evento ↔ próximo evento) para
  // que la hora geométrica avance lentamente durante varios días.
  const polar = solarWindow?.isPolar ?? (!sunriseToday || !sunsetToday)

  const windowKind = solarWindow?.windowKind ?? null
  const windowStart = solarWindow?.windowStart ?? null
  const windowEnd = solarWindow?.windowEnd ?? null

  const isBeforeSunrise = sunriseToday ? now < sunriseToday : false
  const sunsetYesterday = sunTimesYesterday.sunset ?? null

  // Compatibilidad con el arco solar (UI existente): sigue usando el patrón “sunset activo”.
  const activeSunset = isBeforeSunrise ? sunsetYesterday : sunsetToday
  const activeNextSunrise = isBeforeSunrise ? sunriseToday : nextSunrise

  // Para la hora geométrica preferimos la ventana extendida (si está completa).
  // Si falta, caemos al cálculo original día/noche con sunriseToday/sunset/nextSunrise.
  const geometricHour = (windowStart && windowEnd)
    ? (() => {
        if (windowKind === 'day') {
          const progress = (now.getTime() - windowStart.getTime()) / (windowEnd.getTime() - windowStart.getTime())
          return 6 + progress * 12
        }

        const progress = (now.getTime() - windowStart.getTime()) / (windowEnd.getTime() - windowStart.getTime())
        const gh = 18 + progress * 12
        return gh >= 24 ? gh - 24 : gh
      })()
    : computeGeometricHour(now, sunriseToday, activeSunset, activeNextSunrise)

  const geometricTime = formatGeometricTime(geometricHour)
  const geoHms = splitGeometricHMS(geometricHour)

  // Duraciones (con soporte >24h en polos)
  const dayLengthMs = (polar && solarWindow?.prevSunrise && solarWindow?.nextSunset)
    ? solarWindow.nextSunset.getTime() - solarWindow.prevSunrise.getTime()
    : (sunriseToday && sunsetToday ? sunsetToday.getTime() - sunriseToday.getTime() : null)

  const nightLengthMs = (polar && solarWindow?.prevSunset && solarWindow?.nextSunrise)
    ? solarWindow.nextSunrise.getTime() - solarWindow.prevSunset.getTime()
    : (activeSunset && activeNextSunrise ? activeNextSunrise.getTime() - activeSunset.getTime() : null)

  const dayLength = dayLengthMs != null ? formatDurationLong(dayLengthMs) : '—'
  const nightLength = nightLengthMs != null ? formatDurationLong(nightLengthMs) : '—'

  const MS_PER_DAY = 24 * 60 * 60 * 1000
  const formatUntilNextEvent = (ms) => {
    if (typeof ms !== 'number' || !Number.isFinite(ms)) return '—'
    return formatDurationDHMS(ms)
  }

  const polarStatus = (() => {
    if (!polar || !solarWindow) return null
    const until = solarWindow.untilNextTransitionMs
    if (solarWindow.windowKind === 'day') {
      return {
        kind: 'polar-day',
        statusLine: `Día polar (próximo atardecer en ${formatUntilNextEvent(until)})`,
        durationLine: `Duración del día: ${formatDurationDHMS(solarWindow.windowDurationMs)}`,
      }
    }
    return {
      kind: 'polar-night',
      statusLine: `Noche polar (próximo amanecer en ${formatUntilNextEvent(until)})`,
      durationLine: `Duración de la noche: ${formatDurationDHMS(solarWindow.windowDurationMs)}`,
    }
  })()

  const sunrise = formatTimeDual(sunriseToday, timezone)
  const sunset = formatTimeDual(sunsetToday, timezone)
  const solarNoon = formatTimeDual(solarEvents.solarNoon, timezone)
  const moonrise = formatTimeDual(lunarData.moonrise, timezone)
  const moonset = formatTimeDual(lunarData.moonset, timezone)

  const ghAMStart = formatTimeDual(solarEvents.goldenHourMorningStart, timezone)
  const ghAMEnd = formatTimeDual(solarEvents.goldenHourMorningEnd, timezone)
  const ghPMStart = formatTimeDual(solarEvents.goldenHourEveningStart, timezone)
  const ghPMEnd = formatTimeDual(solarEvents.goldenHourEveningEnd, timezone)
  const bhAMStart = formatTimeDual(solarEvents.blueHourMorningStart, timezone)
  const bhAMEnd = formatTimeDual(solarEvents.blueHourMorningEnd, timezone)
  const bhPMStart = formatTimeDual(solarEvents.blueHourEveningStart, timezone)
  const bhPMEnd = formatTimeDual(solarEvents.blueHourEveningEnd, timezone)

  return {
    polar,
    location,
    ui: {
      locationLine1: timezone,
      locationLine2: `Lat ${lat.toFixed(4)} · Lon ${lon.toFixed(4)}`,
      dateLong,
      civilTime,
      geometricTime,
    },
    solarCycle: polarStatus,
    solar: {
      sunrise,
      sunset,
      solarNoon,
      maxElevationDeg: solarEvents.maxElevationDeg,
      dayLength,
      nightLength,
    },
    lunar: {
      phaseName: lunarData.phaseName,
      illumination: lunarData.illumination,
      moonrise,
      moonset,
    },
    specialLight: {
      goldenAM: { start: ghAMStart, end: ghAMEnd },
      goldenPM: { start: ghPMStart, end: ghPMEnd },
      blueAM: { start: bhAMStart, end: bhAMEnd },
      bluePM: { start: bhPMStart, end: bhPMEnd },
    },
    raw: {
      now,
      sunriseToday,
      sunsetToday,
      activeSunset,
      activeNextSunrise,
      nextSunrise,
      solarEvents,
      lunarData,
      solarWindow,
      geometricHour,
      geoHms,
    },
  }
}
