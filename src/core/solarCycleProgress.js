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

/**
 * Progreso del ciclo solar visible en la barra de Hora geométrica.
 * Misma lógica que `updateSolarArc` en `main.js` y `ui/solarArc.js`.
 */
export function computeSolarCycleProgress(snapshot) {
  if (!snapshot?.raw) {
    return { isDay: true, label: 'Día', progress: 0 }
  }

  const { now, sunriseToday, sunsetToday, activeSunset, activeNextSunrise } = snapshot.raw

  if (!sunriseToday || !sunsetToday || !activeSunset || !activeNextSunrise) {
    return { isDay: true, label: 'Día', progress: 0 }
  }

  const isDay = now >= sunriseToday && now < sunsetToday

  if (isDay) {
    return {
      isDay: true,
      label: 'Día',
      progress: clamp01(progressBetween(now, sunriseToday, sunsetToday)),
    }
  }

  return {
    isDay: false,
    label: 'Noche',
    progress: clamp01(progressBetween(now, activeSunset, activeNextSunrise)),
  }
}
