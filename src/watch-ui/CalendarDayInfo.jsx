import { useWatch } from '../context/WatchContext.jsx'
import { cn } from './lib/utils.js'
import {
  getActiveLocationLabel,
  getLoadingLocationLabel,
  matchSavedLocation,
} from './locationDisplay.js'
import {
  LocationIcon,
  MoonIcon,
  SunIcon,
  SunriseIcon,
} from './icons.jsx'

function GlowDot({ tone }) {
  const toneClass =
    tone === 'golden'
      ? 'bg-golden shadow-[0_0_8px] shadow-golden'
      : 'bg-blue-hour shadow-[0_0_8px] shadow-blue-hour'

  return <span className={cn('h-2 w-2 shrink-0 rounded-full', toneClass)} aria-hidden="true" />
}

function AccentSquare({ tone }) {
  const toneClass =
    tone === 'sun'
      ? 'bg-sun/80 shadow-[0_0_6px_oklch(0.85_0.17_75/0.35)]'
      : 'bg-moon/80 shadow-[0_0_6px_oklch(0.92_0.02_250/0.35)]'

  return <span className={cn('mt-1.5 h-1.5 w-1.5 shrink-0 rounded-[2px]', toneClass)} aria-hidden="true" />
}

function InfoRow({ label, value, tone = 'neutral' }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="flex items-start gap-2 min-w-0">
        {tone !== 'neutral' ? <AccentSquare tone={tone} /> : null}
        <span className="text-[0.78rem] text-muted-foreground">{label}</span>
      </div>
      <span
        className={cn(
          'shrink-0 text-right font-mono text-[0.84rem] tabular-nums font-medium',
          tone === 'sun' && 'text-sun/95',
          tone === 'moon' && 'text-moon/95',
          tone === 'neutral' && 'text-foreground/90',
        )}
      >
        {value}
      </span>
    </div>
  )
}

function SpecialLightRow({ label, value, tone }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex items-center gap-2 min-w-0">
        <GlowDot tone={tone} />
        <span
          className={cn(
            'text-[0.78rem] font-medium',
            tone === 'golden' ? 'text-golden' : 'text-blue-hour',
          )}
        >
          {label}
        </span>
      </div>
      <span className="shrink-0 text-right font-mono text-[0.84rem] tabular-nums text-foreground/90">
        {value}
      </span>
    </div>
  )
}

export function CalendarDayInfo({ dayData }) {
  const { location, locationName, savedLocations } = useWatch()
  const savedMatch = matchSavedLocation(location, savedLocations)
  const isLoading = !savedMatch && locationName === null
  const locationLabel = isLoading
    ? getLoadingLocationLabel({ location })
    : getActiveLocationLabel({ location, locationName, savedLocations })

  if (!dayData) {
    return (
      <p className="text-sm text-muted-foreground">
        Selecciona una fecha para ver la información.
      </p>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="space-y-2">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[0.68rem] uppercase tracking-[0.16em] text-muted-foreground">
              {dayData.weekday}
            </p>
            <p className="mt-1 text-xl font-semibold tracking-tight text-foreground">
              {dayData.date}
            </p>
          </div>
          <div className="inline-flex items-center rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[0.72rem] font-medium text-foreground/85">
            {dayData.season}
          </div>
        </div>

        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <LocationIcon className="h-3.5 w-3.5 shrink-0 text-sun" aria-hidden="true" />
          <span className={cn('truncate', isLoading && 'animate-pulse')}>{locationLabel}</span>
        </div>
      </div>

      <section className="rounded-xl border border-sun/20 bg-sun/[0.06] p-3.5">
        <div className="mb-3 flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-md bg-sun/15 text-sun">
            <SunIcon className="h-3.5 w-3.5" aria-hidden="true" />
          </span>
          <h4 className="text-[0.72rem] font-semibold uppercase tracking-[0.16em] text-sun/85">
            Sol
          </h4>
        </div>
        <div className="flex flex-col gap-2.5">
          <InfoRow label="Amanecer" value={dayData.sunrise} tone="sun" />
          <InfoRow label="Atardecer" value={dayData.sunset} tone="sun" />
          <InfoRow label="Mediodía solar" value={dayData.solarNoon} tone="sun" />
          <InfoRow label="Elevación máxima" value={dayData.maxElevation} tone="sun" />
          <div className="mt-0.5 flex flex-col gap-2.5 border-t border-sun/15 pt-2.5">
            <InfoRow label="Día" value={dayData.dayLength} tone="sun" />
            <InfoRow label="Noche" value={dayData.nightLength} tone="sun" />
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-white/10 bg-white/[0.03] p-3.5">
        <div className="mb-3 flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-md bg-white/[0.06] text-foreground/80">
            <SunriseIcon className="h-3.5 w-3.5 text-golden" aria-hidden="true" />
          </span>
          <h4 className="text-[0.72rem] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            Luz especial
          </h4>
        </div>
        <div className="flex flex-col gap-2.5">
          <SpecialLightRow label="Golden AM" value={dayData.goldenHourMorning} tone="golden" />
          <SpecialLightRow label="Golden PM" value={dayData.goldenHourEvening} tone="golden" />
          <SpecialLightRow label="Blue AM" value={dayData.blueHourMorning} tone="blue" />
          <SpecialLightRow label="Blue PM" value={dayData.blueHourEvening} tone="blue" />
        </div>
      </section>

      <section className="rounded-xl border border-moon/20 bg-moon/[0.05] p-3.5">
        <div className="mb-3 flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-md bg-moon/10 text-moon">
            <MoonIcon className="h-3.5 w-3.5" aria-hidden="true" />
          </span>
          <h4 className="text-[0.72rem] font-semibold uppercase tracking-[0.16em] text-moon/85">
            Luna
          </h4>
        </div>
        <div className="flex flex-col gap-2.5">
          <InfoRow
            label="Fase"
            value={`${dayData.moonPhase} — ${dayData.moonIllum}`}
            tone="moon"
          />
          <InfoRow label="Salida" value={dayData.moonrise} tone="moon" />
          <InfoRow label="Puesta" value={dayData.moonset} tone="moon" />
        </div>
      </section>
    </div>
  )
}
