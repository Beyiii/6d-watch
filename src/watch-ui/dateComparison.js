import { formatDuration } from '../core/timeFormat.js'

function isFiniteMs(ms) {
  return typeof ms === 'number' && Number.isFinite(ms)
}

function getDayLengthMs(dayData) {
  const sunrise = dayData?.raw?.sunrise
  const sunset = dayData?.raw?.sunset
  if (!(sunrise instanceof Date) || !(sunset instanceof Date)) return null
  const ms = sunset.getTime() - sunrise.getTime()
  return isFiniteMs(ms) ? ms : null
}

function getNightLengthMs(dayData) {
  const sunset = dayData?.raw?.sunset
  const nextSunrise = dayData?.raw?.nextSunrise
  if (!(sunset instanceof Date) || !(nextSunrise instanceof Date)) return null
  const ms = nextSunrise.getTime() - sunset.getTime()
  return isFiniteMs(ms) ? ms : null
}

function formatDurationReadable(ms) {
  const totalMinutes = Math.round(Math.abs(ms) / 60000)
  const h = Math.floor(totalMinutes / 60)
  const m = totalMinutes % 60
  if (h === 0) return `${m} min`
  if (m === 0) return `${h} h`
  return `${h} h ${m} min`
}

/**
 * @returns {{
 *   dayLengthMs: number | null,
 *   nightLengthMs: number | null,
 *   insights: Array<{ id: string, text: string, tone: 'sun' | 'moon' | 'neutral' }>
 * }}
 */
export function buildDateComparison(dayA, dayB, labelA, labelB) {
  const dayLengthA = getDayLengthMs(dayA)
  const dayLengthB = getDayLengthMs(dayB)
  const nightLengthA = getNightLengthMs(dayA)
  const nightLengthB = getNightLengthMs(dayB)
  const insights = []

  if (dayLengthA != null && dayLengthB != null) {
    const diffMs = dayLengthA - dayLengthB
    const absMinutes = Math.round(Math.abs(diffMs) / 60000)

    if (absMinutes === 0) {
      insights.push({
        id: 'day-equal',
        text: 'Ambas fechas tienen la misma duración del día.',
        tone: 'neutral',
      })
    } else {
      const longerLabel = diffMs > 0 ? labelA : labelB
      const shorterLabel = diffMs > 0 ? labelB : labelA
      insights.push({
        id: 'day-diff',
        text: `El ${longerLabel} tiene ${formatDurationReadable(diffMs)} más de luz que el ${shorterLabel}.`,
        tone: 'sun',
      })
    }
  }

  if (nightLengthA != null && nightLengthB != null) {
    const diffMs = nightLengthA - nightLengthB
    const absMinutes = Math.round(Math.abs(diffMs) / 60000)

    if (absMinutes === 0) {
      insights.push({
        id: 'night-equal',
        text: 'Ambas fechas tienen la misma duración de la noche.',
        tone: 'neutral',
      })
    } else {
      const longerLabel = diffMs > 0 ? labelA : labelB
      insights.push({
        id: 'night-diff',
        text: `La noche es más larga el ${longerLabel} (${formatDurationReadable(diffMs)} más).`,
        tone: 'moon',
      })
    }
  }

  return {
    dayLengthMs: {
      a: dayLengthA,
      b: dayLengthB,
      formattedA: dayLengthA != null ? formatDuration(dayLengthA) : '—',
      formattedB: dayLengthB != null ? formatDuration(dayLengthB) : '—',
    },
    nightLengthMs: {
      a: nightLengthA,
      b: nightLengthB,
      formattedA: nightLengthA != null ? formatDuration(nightLengthA) : '—',
      formattedB: nightLengthB != null ? formatDuration(nightLengthB) : '—',
    },
    insights,
  }
}

export function formatComparisonDateLabel(luxonDate) {
  return luxonDate.setLocale('es').toFormat("d 'de' LLLL")
}
