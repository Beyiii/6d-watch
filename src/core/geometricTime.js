// Lógica pura: hora geométrica (sin dependencias de DOM/React)

// Convención:
//   Amanecer → 6 | Mediodía → 12 | Atardecer → 18 | Medianoche → 0
// Retorna un número decimal en [0, 24).
export function computeGeometricHour(now, sunrise, sunset, nextSunrise) {
  if (!now || !sunrise || !sunset || !nextSunrise) return null

  if (now >= sunrise && now < sunset) {
    const progressDay = (now - sunrise) / (sunset - sunrise)
    return 6 + progressDay * 12 // [6, 18)
  }

  const progressNight = (now - sunset) / (nextSunrise - sunset)
  const geometricHour = 18 + progressNight * 12 // [18, 30)

  return geometricHour >= 24 ? geometricHour - 24 : geometricHour
}

export function formatGeometricTime(geometricHour) {
  if (typeof geometricHour !== 'number' || !Number.isFinite(geometricHour)) return '--:--:--'

  const totalSeconds = Math.floor(geometricHour * 3600)
  const hh = Math.floor(totalSeconds / 3600)
  const mm = Math.floor((totalSeconds % 3600) / 60)
  const ss = totalSeconds % 60

  return [hh, mm, ss].map(n => n.toString().padStart(2, '0')).join(':')
}

export function splitGeometricHMS(geometricHour) {
  if (typeof geometricHour !== 'number' || !Number.isFinite(geometricHour)) {
    return { h: 0, m: 0, s: 0 }
  }

  const h = Math.floor(geometricHour)
  const m = Math.floor((geometricHour - h) * 60)
  const s = Math.floor(((geometricHour - h) * 60 - m) * 60)

  return { h, m, s }
}
