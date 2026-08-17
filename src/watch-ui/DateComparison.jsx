import { useMemo, useState } from 'react'
import { DateTime } from 'luxon'
import { getCalendarDay } from '../calendar.js'
import { useWatch } from '../context/WatchContext.jsx'
import { GlassCard, CardLabel } from './GlassCard.jsx'
import { MoonPhaseIcon } from './icons.jsx'
import { cn } from './lib/utils.js'
import {
  buildDateComparison,
  formatComparisonDateLabel,
} from './dateComparison.js'

function defaultDateStrings(timezone) {
  const now = DateTime.now().setZone(timezone)
  return {
    a: now.set({ month: 6, day: 21 }).toFormat('yyyy-MM-dd'),
    b: now.set({ month: 12, day: 21 }).toFormat('yyyy-MM-dd'),
  }
}

function DateSlot({ label, value, onChange }) {
  return (
    <label className="flex min-w-0 flex-col gap-1.5">
      <span className="text-[0.68rem] font-medium uppercase tracking-[0.16em] text-muted-foreground">
        {label}
      </span>
      <input
        type="date"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 font-mono text-sm text-foreground outline-none transition-[border-color,background-color] focus:border-sun/35 focus:bg-white/[0.06]"
      />
    </label>
  )
}

function DayColumn({ title, dayData, dayLength, nightLength, hemisphere }) {
  if (!dayData) {
    return (
      <div className="rounded-xl border border-dashed border-white/10 bg-white/[0.02] px-3 py-6 text-center text-sm text-muted-foreground/70">
        Selecciona una fecha válida.
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3.5">
      <p className="text-[0.68rem] font-medium uppercase tracking-[0.16em] text-muted-foreground">
        {title}
      </p>
      <p className="mt-1 text-sm font-semibold tracking-tight text-foreground">
        {dayData.weekday}, {dayData.date}
      </p>

      <div className="mt-3 rounded-lg border border-sun/20 bg-sun/[0.06] p-3">
        <p className="text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-sun/85">
          Sol
        </p>
        <div className="mt-2 space-y-1.5">
          <MetricRow label="Día" value={dayLength} tone="sun" />
          <MetricRow label="Noche" value={nightLength} tone="sun" />
          <MetricRow label="Amanecer" value={dayData.sunrise} tone="muted" />
          <MetricRow label="Atardecer" value={dayData.sunset} tone="muted" />
        </div>
      </div>

      <div className="mt-3 rounded-lg border border-moon/20 bg-moon/[0.05] p-3">
        <p className="text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-moon/85">
          Luna
        </p>
        <div className="mt-2.5 flex items-center gap-3">
          <MoonPhaseIcon
            className="h-11 w-11 shrink-0 text-moon drop-shadow-[0_0_10px_oklch(0.92_0.02_250/0.35)]"
            phase={dayData.moonPhaseRaw ?? 0.5}
            hemisphere={hemisphere}
          />
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-foreground/95">
              {dayData.moonPhase}
            </p>
            <p className="mt-0.5 font-mono text-xs tabular-nums text-moon/80">
              {dayData.moonIllum} iluminada
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

function MetricRow({ label, value, tone }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-[0.75rem] text-muted-foreground">{label}</span>
      <span
        className={cn(
          'font-mono text-[0.8rem] tabular-nums font-medium',
          tone === 'sun' && 'text-sun/95',
          tone === 'muted' && 'text-foreground/70',
        )}
      >
        {value}
      </span>
    </div>
  )
}

export function DateComparison() {
  const { location } = useWatch()
  const { lat, lon, timezone } = location
  const defaults = useMemo(() => defaultDateStrings(timezone), [timezone])
  const [dateA, setDateA] = useState(defaults.a)
  const [dateB, setDateB] = useState(defaults.b)

  const luxonA = useMemo(
    () => DateTime.fromISO(dateA, { zone: timezone }).startOf('day'),
    [dateA, timezone],
  )
  const luxonB = useMemo(
    () => DateTime.fromISO(dateB, { zone: timezone }).startOf('day'),
    [dateB, timezone],
  )

  const dayA = useMemo(() => {
    if (!luxonA.isValid) return null
    return getCalendarDay(luxonA, lat, lon, timezone)
  }, [luxonA, lat, lon, timezone])

  const dayB = useMemo(() => {
    if (!luxonB.isValid) return null
    return getCalendarDay(luxonB, lat, lon, timezone)
  }, [luxonB, lat, lon, timezone])

  const labelA = luxonA.isValid ? formatComparisonDateLabel(luxonA) : 'Fecha A'
  const labelB = luxonB.isValid ? formatComparisonDateLabel(luxonB) : 'Fecha B'

  const comparison = useMemo(() => {
    if (!dayA || !dayB) {
      return {
        dayLengthMs: { formattedA: '—', formattedB: '—' },
        nightLengthMs: { formattedA: '—', formattedB: '—' },
        insights: [],
      }
    }
    return buildDateComparison(dayA, dayB, labelA, labelB)
  }, [dayA, dayB, labelA, labelB])

  const sameDate = dateA === dateB
  const hemisphere = lat < 0 ? 'south' : 'north'

  return (
    <GlassCard>
      <CardLabel>Comparador de fechas</CardLabel>
      <p className="mt-1 text-xs text-muted-foreground">
        Compara duración del día, de la noche y fase lunar en la ubicación activa
      </p>

      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <DateSlot label="Fecha A" value={dateA} onChange={setDateA} />
        <DateSlot label="Fecha B" value={dateB} onChange={setDateB} />
      </div>

      {sameDate ? (
        <p className="mt-4 rounded-xl border border-dashed border-white/10 bg-white/[0.02] px-4 py-6 text-center text-sm text-muted-foreground/70">
          Elige dos fechas distintas para ver la comparación.
        </p>
      ) : (
        <>
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <DayColumn
              title="Fecha A"
              dayData={dayA}
              dayLength={comparison.dayLengthMs.formattedA}
              nightLength={comparison.nightLengthMs.formattedA}
              hemisphere={hemisphere}
            />
            <DayColumn
              title="Fecha B"
              dayData={dayB}
              dayLength={comparison.dayLengthMs.formattedB}
              nightLength={comparison.nightLengthMs.formattedB}
              hemisphere={hemisphere}
            />
          </div>

          {comparison.insights.length > 0 ? (
            <div className="mt-4 rounded-xl border border-white/10 bg-white/[0.03] p-3.5">
              <p className="text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                Diferencias
              </p>
              <div className="mt-2.5 flex flex-col gap-2">
                {comparison.insights.map((insight) => (
                  <p
                    key={insight.id}
                    className={cn(
                      'rounded-lg border px-3 py-2 text-sm leading-snug',
                      insight.tone === 'sun' &&
                        'border-sun/20 bg-sun/[0.06] text-sun/90',
                      insight.tone === 'moon' &&
                        'border-moon/20 bg-moon/[0.06] text-moon/90',
                      insight.tone === 'neutral' &&
                        'border-white/10 bg-white/[0.03] text-muted-foreground',
                    )}
                  >
                    {insight.text}
                  </p>
                ))}
              </div>
            </div>
          ) : null}
        </>
      )}
    </GlassCard>
  )
}
