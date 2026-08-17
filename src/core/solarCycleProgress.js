function clamp01(value) {
  return Math.max(0, Math.min(1, value))
}

function progressBetween(now, start, end) {
  if (!now || !start || !end) return 0
  const t = now.getTime()
  const s = start.getTime()
  const e = end.getTime()
  if (t <= s) return 0
  if (t >= e) return 1
  return (t - s) / (e - s)
}

function getPolarCycleState(snapshot) {
  const kind = snapshot?.solarCycle?.kind ?? snapshot?.raw?.solarWindow?.polarKind

  if (kind === 'polar-night') {
    return { isDay: false, label: 'Noche polar', progress: null, isPolar: true }
  }

  if (kind === 'polar-day') {
    return { isDay: true, label: 'Día polar', progress: null, isPolar: true }
  }

  if (snapshot?.polar) {
    const isDay = Boolean(snapshot.raw?.solarWindow?.sunUpNow)
    return {
      isDay,
      label: isDay ? 'Día polar' : 'Noche polar',
      progress: null,
      isPolar: true,
    }
  }

  return null
}

/**
 * Progreso del ciclo solar visible en la barra de Hora geométrica.
 * Misma lógica que `updateSolarArc` en `ui/solarArc.js`.
 * En día/noche polar no hay ciclo amanecer-atardecer convencional: `progress` es null.
 */
export function computeSolarCycleProgress(snapshot) {
  const polar = getPolarCycleState(snapshot)
  if (polar) return polar

  if (!snapshot?.raw) {
    return { isDay: true, label: 'Día', progress: 0, isPolar: false }
  }

  const { now, sunriseToday, sunsetToday, activeSunset, activeNextSunrise } = snapshot.raw

  if (!sunriseToday || !sunsetToday || !activeSunset || !activeNextSunrise) {
    return { isDay: true, label: 'Día', progress: 0, isPolar: false }
  }

  const isDay = now >= sunriseToday && now < sunsetToday

  if (isDay) {
    return {
      isDay: true,
      label: 'Día',
      progress: clamp01(progressBetween(now, sunriseToday, sunsetToday)),
      isPolar: false,
    }
  }

  return {
    isDay: false,
    label: 'Noche',
    progress: clamp01(progressBetween(now, activeSunset, activeNextSunrise)),
    isPolar: false,
  }
}
