import { useEffect, useMemo, useState } from 'react'
import { useWatch } from '../context/WatchContext.jsx'
import { GlassCard, CardLabel } from './GlassCard.jsx'
import { ChevronDownIcon, LocationIcon, SunIcon, MoonIcon } from './icons.jsx'
import { cn } from './lib/utils.js'
import {
  buildComparisonInsights,
  computeLocationMetrics,
  getLocationShortName,
} from './locationComparison.js'

export function LocationComparison() {
  const { savedLocations } = useWatch()
  const [locationAId, setLocationAId] = useState(savedLocations[0]?.id ?? '')
  const [locationBId, setLocationBId] = useState(savedLocations[1]?.id ?? '')
  const [tick, setTick] = useState(0)

  useEffect(() => {
    const id = setInterval(() => setTick((v) => v + 1), 1000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    if (!savedLocations.some((loc) => loc.id === locationAId)) {
      setLocationAId(savedLocations[0]?.id ?? '')
    }
    if (!savedLocations.some((loc) => loc.id === locationBId)) {
      setLocationBId(savedLocations[1]?.id ?? savedLocations[0]?.id ?? '')
    }
  }, [savedLocations, locationAId, locationBId])

  const locationA = savedLocations.find((loc) => loc.id === locationAId) ?? savedLocations[0]
  const locationB = savedLocations.find((loc) => loc.id === locationBId) ?? savedLocations[1]

  const insights = useMemo(() => {
    if (!locationA || !locationB) return []
    if (locationA.id === locationB.id) return []

    const metricsA = computeLocationMetrics(locationA)
    const metricsB = computeLocationMetrics(locationB)
    return buildComparisonInsights(locationA, locationB, metricsA, metricsB)
  }, [locationA, locationB, tick])

  const sameLocation = locationA && locationB && locationA.id === locationB.id

  return (
    <GlassCard className="!p-4">
      <CardLabel className="text-sun/80">Comparación entre ubicaciones</CardLabel>
      <p className="mt-1 text-xs text-muted-foreground">
        Selecciona dos ubicaciones guardadas para ver sus diferencias
      </p>

      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <LocationSlotPicker
          label="Ubicación A"
          value={locationAId}
          onChange={setLocationAId}
          savedLocations={savedLocations}
        />
        <LocationSlotPicker
          label="Ubicación B"
          value={locationBId}
          onChange={setLocationBId}
          savedLocations={savedLocations}
        />
      </div>

      {savedLocations.length < 2 ? (
        <p className="mt-4 rounded-xl border border-dashed border-white/10 bg-white/[0.02] px-4 py-6 text-center text-sm text-muted-foreground/70">
          Guarda al menos dos ubicaciones para comparar.
        </p>
      ) : sameLocation ? (
        <p className="mt-4 rounded-xl border border-dashed border-white/10 bg-white/[0.02] px-4 py-6 text-center text-sm text-muted-foreground/70">
          Selecciona dos ubicaciones distintas para ver la comparación.
        </p>
      ) : (
        <div className="mt-4 flex flex-wrap gap-2">
          {insights.map((insight) => (
            <ComparisonChip key={insight.id} insight={insight} />
          ))}
        </div>
      )}
    </GlassCard>
  )
}

function LocationSlotPicker({ label, value, onChange, savedLocations }) {
  const selected = savedLocations.find((loc) => loc.id === value)

  return (
    <label className="block">
      <span className="mb-1.5 block text-[0.7rem] font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      <div className="relative">
        <LocationIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-sun" />
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full appearance-none rounded-xl border border-white/10 bg-white/5 py-2.5 pl-9 pr-9 text-sm font-medium text-foreground transition-colors hover:bg-white/10 focus:border-sun/40 focus:outline-none focus:ring-1 focus:ring-sun/30"
        >
          {savedLocations.map((loc) => (
            <option key={loc.id} value={loc.id} className="bg-popover text-foreground">
              {getLocationShortName(loc.name)}
            </option>
          ))}
        </select>
        <ChevronDownIcon className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      </div>
      {selected ? (
        <span className="mt-1 block truncate text-[0.7rem] text-muted-foreground/80">
          {selected.coords}
        </span>
      ) : null}
    </label>
  )
}

function ComparisonChip({ insight }) {
  if (insight.tone === 'mixed') {
    return (
      <div
        className={cn(
          'inline-flex max-w-full items-center gap-2 rounded-2xl border px-3 py-2 text-sm leading-snug',
          insight.prominent && 'border-white/12 bg-white/[0.04]',
          !insight.prominent && 'border-white/8 bg-white/[0.02]',
        )}
      >
        <SunIcon className="h-3.5 w-3.5 shrink-0 text-golden" aria-hidden="true" />
        <span>
          En <span className="font-medium text-golden">{insight.dayName}</span> es de día, mientras que en{' '}
          <span className="font-medium text-blue-hour">{insight.nightName}</span> es de noche.
        </span>
        <MoonIcon className="h-3.5 w-3.5 shrink-0 text-blue-hour" aria-hidden="true" />
      </div>
    )
  }

  const toneClass =
    insight.tone === 'golden'
      ? 'border-golden/25 bg-golden/8 text-foreground'
      : insight.tone === 'day'
        ? 'border-golden/25 bg-golden/8 text-golden'
        : insight.tone === 'night'
          ? 'border-blue-hour/25 bg-blue-hour/8 text-blue-hour'
          : 'border-white/8 bg-white/[0.02] text-muted-foreground'

  const Icon = insight.tone === 'day' ? SunIcon : insight.tone === 'night' ? MoonIcon : null

  return (
    <div
      className={cn(
        'inline-flex max-w-full items-start gap-2 rounded-2xl border px-3 py-2 text-sm leading-snug',
        toneClass,
        insight.prominent && insight.tone === 'golden' && 'font-medium',
      )}
    >
      {Icon ? <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" /> : null}
      <span>{insight.text}</span>
    </div>
  )
}
