import { DateTime } from 'luxon'

export function formatTimeDual(date, timezone) {
  if (!date) return { local: '—', santiago: '—' }

  const local = DateTime.fromJSDate(date).setZone(timezone).toFormat('HH:mm')
  const santiago = DateTime.fromJSDate(date).setZone('America/Santiago').toFormat('HH:mm')

  return { local, santiago }
}

export function formatLocalTime(date, timezone) {
  if (!date) return '—'
  return DateTime.fromJSDate(date).setZone(timezone).toFormat('HH:mm')
}

export function formatDuration(ms) {
  const totalMinutes = Math.round(ms / 60000)
  const h = Math.floor(totalMinutes / 60)
  const m = totalMinutes % 60
  return `${h}h ${m.toString().padStart(2, '0')}m`
}

// Formatea duraciones largas como "12d 04h" cuando exceden 24h.
// Para duraciones menores, conserva el formato "Xh YYm".
export function formatDurationLong(ms) {
  if (typeof ms !== 'number' || !Number.isFinite(ms)) return '—'

  const absMs = Math.abs(ms)
  const MS_PER_HOUR = 60 * 60 * 1000
  const MS_PER_DAY = 24 * MS_PER_HOUR

  if (absMs < MS_PER_DAY) {
    return formatDuration(absMs)
  }

  const totalHours = Math.round(absMs / MS_PER_HOUR)
  const d = Math.floor(totalHours / 24)
  const h = totalHours % 24
  return `${d}d ${h.toString().padStart(2, '0')}h`
}

// Formatea duraciones con el máximo detalle razonable: "12d 04h 03m 12s".
// - No muestra unidades de mayor a menor que queden en cero al inicio.
// - Para >= 1 día, incluye siempre horas/minutos/segundos con padding.
// - Para < 1 día, muestra "Hh MMm SSs".
export function formatDurationDHMS(ms) {
  if (typeof ms !== 'number' || !Number.isFinite(ms)) return '—'

  const totalSeconds = Math.max(0, Math.floor(Math.abs(ms) / 1000))
  const d = Math.floor(totalSeconds / 86400)
  const h = Math.floor((totalSeconds % 86400) / 3600)
  const m = Math.floor((totalSeconds % 3600) / 60)
  const s = totalSeconds % 60

  if (d > 0) {
    return `${d}d ${h.toString().padStart(2, '0')}h ${m.toString().padStart(2, '0')}m ${s
      .toString()
      .padStart(2, '0')}s`
  }

  return `${h}h ${m.toString().padStart(2, '0')}m ${s.toString().padStart(2, '0')}s`
}
