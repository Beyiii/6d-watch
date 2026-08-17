import { computeSolarCycleProgress } from '../core/solarCycleProgress.js'
import { useWatch } from '../context/WatchContext.jsx'
import { GlassCard, CardLabel } from './GlassCard.jsx'
import { SunriseIcon, SunsetIcon } from './icons.jsx'
import { cn } from './lib/utils.js'

const DAY_GRADIENT = 'linear-gradient(90deg, oklch(0.78 0.16 55), oklch(0.88 0.15 80))'
const NIGHT_GRADIENT = 'linear-gradient(90deg, oklch(0.92 0.03 245), oklch(0.68 0.10 265))'

/** Formato legible para el próximo evento (corto o con días en polos). */
export function formatUntilNextEventLabel(ms) {
  if (typeof ms !== 'number' || !Number.isFinite(ms) || ms < 0) return null

  const totalMinutes = Math.max(0, Math.round(ms / 60000))
  const days = Math.floor(totalMinutes / (24 * 60))
  const hours = Math.floor((totalMinutes % (24 * 60)) / 60)
  const minutes = totalMinutes % 60

  if (days > 0) {
    const dayUnit = days === 1 ? 'día' : 'días'
    if (minutes > 0) {
      return `${days} ${dayUnit} ${hours} h ${minutes} min`
    }
    return `${days} ${dayUnit} ${hours} h`
  }

  if (hours > 0) {
    return `${hours} h ${minutes} min`
  }

  return `${minutes} min`
}

export function getNextDayNightEvent(snapshot) {
  const window = snapshot?.raw?.solarWindow
  if (!window) return null

  const untilMs = window.untilNextTransitionMs
  if (typeof untilMs !== 'number' || !Number.isFinite(untilMs) || untilMs < 0) {
    return null
  }

  const isDay = Boolean(window.sunUpNow)
  return {
    isDay,
    kind: isDay ? 'sunset' : 'sunrise',
    label: isDay ? 'Atardecer' : 'Amanecer',
    untilMs,
    untilLabel: formatUntilNextEventLabel(untilMs),
    at: window.windowEnd instanceof Date ? window.windowEnd : null,
  }
}

export function DayProgressCard({ className }) {
  const { snapshot } = useWatch()
  const { isDay, label, progress, isPolar } = computeSolarCycleProgress(snapshot)
  const pct = isPolar ? null : Math.round(progress * 100)

  return (
    <GlassCard className={cn('!p-4', className)}>
      <CardLabel>Progreso del día</CardLabel>
      <div className="mt-3 space-y-2">
        <div className="flex items-center justify-between gap-3 text-sm">
          <span className={cn('font-medium', isDay ? 'text-sun/90' : 'text-blue-hour')}>
            {label}
          </span>
          {pct != null ? (
            <span className="font-mono tabular-nums text-foreground/90">{pct}%</span>
          ) : null}
        </div>
        {pct != null ? (
          <>
            <div className="h-2 overflow-hidden rounded-full bg-white/5">
              <div
                className="h-full rounded-full transition-[width] duration-500 ease-out"
                style={{
                  width: `${pct}%`,
                  background: isDay ? DAY_GRADIENT : NIGHT_GRADIENT,
                }}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              {isDay ? 'Avance de la luz diurna' : 'Avance de la noche'}
            </p>
          </>
        ) : null}
      </div>
    </GlassCard>
  )
}

export function NextEventCard({ className }) {
  const { snapshot } = useWatch()
  const event = getNextDayNightEvent(snapshot)

  if (!event?.untilLabel) {
    return (
      <GlassCard className={cn('!p-3.5', className)}>
        <CardLabel>Próximo evento</CardLabel>
        <p className="mt-2 text-sm text-muted-foreground">
          No hay un próximo cambio día/noche disponible.
        </p>
      </GlassCard>
    )
  }

  const warm = event.kind === 'sunset'
  const Icon = warm ? SunsetIcon : SunriseIcon

  return (
    <GlassCard
      className={cn(
        '!p-3.5',
        warm ? 'border-golden/25 bg-golden/[0.05]' : 'border-blue-hour/25 bg-blue-hour/[0.06]',
        className,
      )}
    >
      <div className="flex items-center gap-2">
        <span
          className={cn(
            'grid h-7 w-7 place-items-center rounded-md',
            warm ? 'bg-golden/15 text-golden' : 'bg-blue-hour/15 text-blue-hour',
          )}
        >
          <Icon className="h-3.5 w-3.5" aria-hidden="true" />
        </span>
        <CardLabel className={warm ? 'text-golden' : 'text-blue-hour'}>
          Próximo evento
        </CardLabel>
      </div>

      <div className="mt-2.5 flex items-baseline justify-between gap-3">
        <p
          className={cn(
            'text-base font-semibold tracking-tight',
            warm ? 'text-golden' : 'text-blue-hour',
          )}
        >
          {event.label}
        </p>
        <p className="shrink-0 font-mono text-sm tabular-nums text-foreground/85">
          en {event.untilLabel}
        </p>
      </div>
    </GlassCard>
  )
}
