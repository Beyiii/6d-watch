import { DateTime } from 'luxon'
import tzLookup from '@photostructure/tz-lookup'
import { getSeasonName } from '../calendar.js'
import { computeDailyCelestial } from '../core/celestial.js'
import { computeClockSnapshot } from '../core/clockSnapshot.js'
import { computeGeometricCivilDeltaMinutes } from '../core/geometricTime.js'
import { formatDuration } from '../core/timeFormat.js'

function isValidDate(date) {
  return date instanceof Date && Number.isFinite(date.getTime())
}

function isBetween(now, start, end) {
  return isValidDate(now) && isValidDate(start) && isValidDate(end) && now >= start && now < end
}

export function savedLocationToWatchLocation(saved) {
  return {
    lat: saved.lat,
    lon: saved.lon,
    timezone: tzLookup(saved.lat, saved.lon),
  }
}

export function getHemisphere(lat) {
  return lat >= 0 ? 'north' : 'south'
}

export function getHemisphereLabel(lat) {
  return lat >= 0 ? 'Hemisferio Norte' : 'Hemisferio Sur'
}

export function getDayNightState(snapshot) {
  if (snapshot.solarCycle) {
    return snapshot.solarCycle.kind === 'polar-day'
      ? { label: 'Día', isDay: true }
      : { label: 'Noche', isDay: false }
  }

  const now = snapshot.raw.now
  const { sunriseToday, sunsetToday } = snapshot.raw

  if (isBetween(now, sunriseToday, sunsetToday)) {
    return { label: 'Día', isDay: true }
  }

  return { label: 'Noche', isDay: false }
}

function parseClockToMinutes(clock) {
  const parts = String(clock ?? '').split(':').map(Number)
  if (parts.length < 2 || parts.some((n) => !Number.isFinite(n))) return null
  return parts[0] * 60 + parts[1] + (parts[2] || 0) / 60
}

function clockDifferenceMinutes(minutesA, minutesB) {
  if (minutesA == null || minutesB == null) return null
  let diff = Math.abs(minutesA - minutesB)
  if (diff > 12 * 60) diff = 24 * 60 - diff
  return Math.round(diff)
}

function getDayLengthMs(snapshot) {
  const { sunriseToday, sunsetToday, solarWindow } = snapshot.raw
  if (snapshot.polar && solarWindow?.prevSunrise && solarWindow?.nextSunset) {
    return solarWindow.nextSunset.getTime() - solarWindow.prevSunrise.getTime()
  }
  if (isValidDate(sunriseToday) && isValidDate(sunsetToday)) {
    return sunsetToday.getTime() - sunriseToday.getTime()
  }
  return null
}

function getNightLengthMs(snapshot) {
  const { activeSunset, activeNextSunrise, solarWindow } = snapshot.raw
  if (snapshot.polar && solarWindow?.prevSunset && solarWindow?.nextSunrise) {
    return solarWindow.nextSunrise.getTime() - solarWindow.prevSunset.getTime()
  }
  if (isValidDate(activeSunset) && isValidDate(activeNextSunrise)) {
    return activeNextSunrise.getTime() - activeSunset.getTime()
  }
  return null
}

function formatMinutesDiff(minutes) {
  if (minutes == null || !Number.isFinite(minutes)) return null
  if (minutes === 0) return '0h 00m'
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return `${h}h ${m.toString().padStart(2, '0')}m`
}

export function getLocationShortName(name) {
  return String(name ?? 'Ubicación').split(',')[0].trim() || 'Ubicación'
}

export function computeLocationMetrics(savedLocation) {
  const location = savedLocationToWatchLocation(savedLocation)
  const nowLuxon = DateTime.now().setZone(location.timezone)
  const daily = computeDailyCelestial(nowLuxon.toJSDate(), location)
  const snapshot = computeClockSnapshot(nowLuxon, location, daily)

  const civilMinutes = parseClockToMinutes(snapshot.ui.civilTime)
  const geometricMinutes = snapshot.raw.geometricHour != null
    ? snapshot.raw.geometricHour * 60
    : null
  const civilGeometricDelta = computeGeometricCivilDeltaMinutes(
    snapshot.ui.civilTime,
    snapshot.raw.geometricHour,
  )

  return {
    shortName: getLocationShortName(savedLocation.name),
    hemisphere: getHemisphere(location.lat),
    season: getSeasonName(nowLuxon, location.lat),
    dayNight: getDayNightState(snapshot),
    civilMinutes,
    geometricMinutes,
    civilGeometricDeltaAbs: civilGeometricDelta != null ? Math.abs(civilGeometricDelta) : null,
    dayLengthMs: getDayLengthMs(snapshot),
    nightLengthMs: getNightLengthMs(snapshot),
  }
}

/**
 * @returns {Array<{ id: string, text: string, tone: 'golden' | 'day' | 'night' | 'neutral' | 'mixed', prominent?: boolean }>}
 */
export function buildComparisonInsights(savedA, savedB, metricsA, metricsB) {
  if (!savedA || !savedB || !metricsA || !metricsB) return []

  const nameA = metricsA.shortName
  const nameB = metricsB.shortName
  const insights = []

  const civilDiff = clockDifferenceMinutes(metricsA.civilMinutes, metricsB.civilMinutes)
  if (civilDiff != null) {
    insights.push({
      id: 'civil-time',
      text: civilDiff === 0
        ? 'La hora civil local coincide en ambas ubicaciones.'
        : `La hora civil difiere en ${formatMinutesDiff(civilDiff)}.`,
      tone: civilDiff === 0 ? 'neutral' : 'golden',
      prominent: civilDiff > 0,
    })
  }

  const geoDiff = clockDifferenceMinutes(metricsA.geometricMinutes, metricsB.geometricMinutes)
  if (geoDiff != null) {
    insights.push({
      id: 'geometric-time',
      text: geoDiff === 0
        ? 'La hora geométrica coincide en ambas ubicaciones.'
        : `La hora geométrica difiere en ${formatMinutesDiff(geoDiff)}.`,
      tone: geoDiff === 0 ? 'neutral' : 'golden',
      prominent: geoDiff > 0,
    })
  }

  if (metricsA.dayLengthMs != null && metricsB.dayLengthMs != null) {
    const diffMs = metricsA.dayLengthMs - metricsB.dayLengthMs
    if (diffMs === 0) {
      insights.push({
        id: 'day-length',
        text: 'Ambas ubicaciones comparten la misma duración del día.',
        tone: 'neutral',
      })
    } else {
      const longer = diffMs > 0 ? nameA : nameB
      const shorter = diffMs > 0 ? nameB : nameA
      insights.push({
        id: 'day-length',
        text: `${longer} tiene ${formatDuration(Math.abs(diffMs))} más de día que ${shorter}.`,
        tone: 'golden',
        prominent: true,
      })
    }
  }

  if (metricsA.nightLengthMs != null && metricsB.nightLengthMs != null) {
    const diffMs = metricsA.nightLengthMs - metricsB.nightLengthMs
    if (diffMs === 0) {
      insights.push({
        id: 'night-length',
        text: 'Ambas ubicaciones comparten la misma duración de la noche.',
        tone: 'neutral',
      })
    } else {
      const longer = diffMs > 0 ? nameA : nameB
      const shorter = diffMs > 0 ? nameB : nameA
      insights.push({
        id: 'night-length',
        text: `${longer} tiene ${formatDuration(Math.abs(diffMs))} más de noche que ${shorter}.`,
        tone: 'night',
      })
    }
  }

  const deltaA = metricsA.civilGeometricDeltaAbs
  const deltaB = metricsB.civilGeometricDeltaAbs
  if (deltaA != null && deltaB != null) {
    if (deltaA === deltaB) {
      insights.push({
        id: 'civil-geo-delta',
        text: 'El desfase entre hora civil y geométrica es similar en ambas ubicaciones.',
        tone: 'neutral',
      })
    } else {
      const greater = deltaA > deltaB ? nameA : nameB
      insights.push({
        id: 'civil-geo-delta',
        text: `El desfase entre hora civil y geométrica es mayor en ${greater}.`,
        tone: 'golden',
      })
    }
  }

  if (metricsA.hemisphere !== metricsB.hemisphere) {
    insights.push({
      id: 'hemisphere',
      text: 'Ambas ubicaciones están en hemisferios distintos.',
      tone: 'golden',
      prominent: true,
    })

    if (metricsA.season !== metricsB.season) {
      insights.push({
        id: 'season',
        text: `En ${nameA} es ${metricsA.season}, mientras que en ${nameB} es ${metricsB.season}.`,
        tone: 'neutral',
      })
    }
  } else {
    insights.push({
      id: 'hemisphere',
      text: 'Ambas ubicaciones comparten el mismo hemisferio.',
      tone: 'neutral',
    })
  }

  const { dayNight: stateA } = metricsA
  const { dayNight: stateB } = metricsB

  if (stateA.isDay && stateB.isDay) {
    insights.push({
      id: 'day-state',
      text: 'Ambas ubicaciones están de día.',
      tone: 'day',
      prominent: true,
    })
  } else if (!stateA.isDay && !stateB.isDay) {
    insights.push({
      id: 'day-state',
      text: 'Ambas ubicaciones están de noche.',
      tone: 'night',
      prominent: true,
    })
  } else {
    const dayLoc = stateA.isDay ? nameA : nameB
    const nightLoc = stateA.isDay ? nameB : nameA
    insights.push({
      id: 'day-state',
      text: `En ${dayLoc} es de día, mientras que en ${nightLoc} es de noche.`,
      tone: 'mixed',
      prominent: true,
      dayName: dayLoc,
      nightName: nightLoc,
    })
  }

  return insights
}
