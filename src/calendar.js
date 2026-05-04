import SunCalc from 'suncalc'
import { DateTime } from 'luxon'
import { getSolarEvents, getLunarData } from './astronomy.js'

// ─── getSeasonName() ──────────────────────────────────────────────────────────
// Retorna la estación del año para una fecha y hemisferio dados.
// Se determina por el mes, que es suficientemente preciso para uso cotidiano.
// El hemisferio se infiere de la latitud: negativo = sur, positivo = norte.

function getSeasonName(date, lat) {
  const month = date.month  // 1–12 (Luxon DateTime)

  const isSouthern = lat < 0

  // Estaciones astronómicas aproximadas por mes
  const northernSeason =
    month >= 3 && month <= 5 ? 'Primavera' :
    month >= 6 && month <= 8 ? 'Verano'    :
    month >= 9 && month <= 11 ? 'Otoño'    :
    'Invierno'

  // En el hemisferio sur las estaciones son opuestas
  const southernMap = {
    'Primavera': 'Otoño',
    'Verano':    'Invierno',
    'Otoño':     'Primavera',
    'Invierno':  'Verano',
  }

  return isSouthern ? southernMap[northernSeason] : northernSeason
}

// ─── formatDuration() ─────────────────────────────────────────────────────────
// Convierte milisegundos a "Xh YYm".

function formatDuration(ms) {
  const totalMinutes = Math.round(ms / 60000)
  const h  = Math.floor(totalMinutes / 60)
  const m  = totalMinutes % 60
  return `${h}h ${m.toString().padStart(2, '0')}m`
}

// ─── formatTime() ─────────────────────────────────────────────────────────────
// Formatea un Date a "HH:MM" en la zona horaria dada. Retorna '—' si es null.

function formatTime(date, timezone) {
  if (!date) return '—'
  return DateTime.fromJSDate(date).setZone(timezone).toFormat('HH:mm')
}

// ─── getCalendarDay() ─────────────────────────────────────────────────────────
// Función principal del módulo.
// Recibe una fecha (Luxon DateTime), coordenadas y timezone, y retorna
// todos los datos solares y lunares relevantes para ese día.
//
// Es una función pura: no depende de ningún estado global ni caché.
// Puede llamarse para cualquier fecha pasada, presente o futura.
//
// Retorna un objeto con todos los datos listos para mostrar (ya formateados),
// más los valores crudos (raw) para quien necesite hacer cálculos adicionales.

export function getCalendarDay(luxonDate, lat, lon, timezone) {
  // Usamos mediodía del día seleccionado como referencia para SunCalc.
  // Esto evita problemas de zona horaria donde el inicio del día en UTC
  // puede ser el día anterior en zonas UTC-.
  const noonJs = luxonDate.set({ hour: 12, minute: 0, second: 0 }).toJSDate()

  const times  = SunCalc.getTimes(noonJs, lat, lon)
  const solar  = getSolarEvents(noonJs, lat, lon)
  const lunar  = getLunarData(noonJs, lat, lon)

  const sunrise = times.sunrise
  const sunset  = times.sunset

  // Duración del día: diferencia entre sunset y sunrise del mismo día.
  // Duración de la noche: desde sunset hasta el sunrise del día siguiente.
  const tomorrow     = luxonDate.plus({ days: 1 }).set({ hour: 12 }).toJSDate()
  const nextSunrise  = SunCalc.getTimes(tomorrow, lat, lon).sunrise

  const dayLengthMs   = sunset  - sunrise
  const nightLengthMs = nextSunrise - sunset

  return {
    // ── Fecha ───────────────────────────────────────────────────────────────
    date:     luxonDate.toFormat('yyyy-MM-dd'),
    weekday:  luxonDate.setLocale('es').toFormat('cccc'),   // "lunes", "martes"…
    season:   getSeasonName(luxonDate, lat),

    // ── Sol ─────────────────────────────────────────────────────────────────
    sunrise:        formatTime(sunrise, timezone),
    sunset:         formatTime(sunset,  timezone),
    solarNoon:      formatTime(solar.solarNoon, timezone),
    maxElevation:   solar.maxElevationDeg + '°',
    dayLength:      formatDuration(dayLengthMs),
    nightLength:    formatDuration(nightLengthMs),

    // ── Luz especial ────────────────────────────────────────────────────────
    goldenHourMorning: `${formatTime(solar.goldenHourMorningStart, timezone)} → ${formatTime(solar.goldenHourMorningEnd, timezone)}`,
    goldenHourEvening: `${formatTime(solar.goldenHourEveningStart, timezone)} → ${formatTime(solar.goldenHourEveningEnd, timezone)}`,
    blueHourMorning:   `${formatTime(solar.blueHourMorningStart,   timezone)} → ${formatTime(solar.blueHourMorningEnd,   timezone)}`,
    blueHourEvening:   `${formatTime(solar.blueHourEveningStart,   timezone)} → ${formatTime(solar.blueHourEveningEnd,   timezone)}`,

    // ── Luna ────────────────────────────────────────────────────────────────
    moonPhase:      lunar.phaseName,
    moonPhaseRaw:   lunar.phase,       // [0, 1] por si se quiere dibujar un ícono
    moonIllum:      lunar.illumination + '%',
    moonrise:       formatTime(lunar.moonrise, timezone),
    moonset:        formatTime(lunar.moonset,  timezone),

    // ── Valores crudos (para cálculos externos) ──────────────────────────────
    raw: {
      sunrise,
      sunset,
      nextSunrise,
      solarEvents: solar,
      lunarData:   lunar,
    }
  }
}