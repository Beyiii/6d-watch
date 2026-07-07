import { useState } from 'react'
import Map from '../../components/Map.jsx'
import { useWatch } from '../../context/WatchContext.jsx'
import { getSeasonName } from '../../calendar.js'
import { getDisplayTimezone } from '../../core/timezoneDisplay.js'
import { GlassCard, CardLabel } from '../GlassCard.jsx'
import { LocationManager } from '../LocationManager.jsx'
import { LocationComparison } from '../LocationComparison.jsx'
import { PlaceholderPanel, PageTitle } from '../Placeholder.jsx'
import SolarMapLegend from '../SolarMapLegend.jsx'
import { getActiveLocationLabel, getLoadingLocationLabel, matchSavedLocation } from '../locationDisplay.js'
import { SunIcon, MoonIcon } from '../icons.jsx'
import { cn } from '../lib/utils.js'
import {
  getDayNightState,
  getHemisphereLabel,
} from '../locationComparison.js'

export default function MapaPage() {
  const { location, onSelectLocation } = useWatch()

  return (
    <main className="flex flex-1 flex-col gap-5">
      <PageTitle
        title="Mapa"
        subtitle="Exploración geográfica del tiempo"
      />

      <div className="grid flex-1 grid-cols-1 gap-5 lg:grid-cols-[1fr_300px] lg:items-start">
        <div className="flex flex-col gap-5">
        <GlassCard className="!p-4">
          <CardLabel>Mapa principal</CardLabel>
          <p className="mt-1 text-xs text-muted-foreground">
            Haz clic en el mapa para cambiar la ubicación activa
          </p>
          <div className="map-page-host mt-4">
            <Map
              onSelectLocation={onSelectLocation}
              markerPosition={location}
              overlayMode="explore"
            />
          </div>
          <SolarMapLegend />
        </GlassCard>

        <LocationComparison />
        </div>

        <div className="flex flex-col gap-4">
        <ActiveLocationCard />

        <PlaceholderPanel
          label="Visualización global de luz y oscuridad"
          minHeight="min-h-[200px]"
          hint="Mapa mundial de fotoperiodo"
        />
        </div>
      </div>
    </main>
  )
}

function ActiveLocationCard() {
  const {
    location,
    locationName,
    savedLocations,
    snapshot,
    nowLuxon,
    calendarDayData,
  } = useWatch()
  const [locationMenuOpen, setLocationMenuOpen] = useState(false)

  const savedMatch = matchSavedLocation(location, savedLocations)
  const isLoading = !savedMatch && locationName === null
  const displayName = isLoading
    ? getLoadingLocationLabel({ location })
    : getActiveLocationLabel({ location, locationName, savedLocations })
  const { primaryName, regionName } = splitLocationName(displayName)
  const timezone = getDisplayTimezone(location.timezone, location.lat, location.lon) ?? location.timezone
  const season = calendarDayData?.season ?? getSeasonName(nowLuxon, location.lat)
  const dayNight = getDayNightState(snapshot)
  const hemisphere = getHemisphereLabel(location.lat)
  const civilTime = formatCivilClock(snapshot.ui.civilTime)
  const geometricTime = formatGeometricClock(snapshot)

  return (
    <GlassCard className={cn('!p-4', locationMenuOpen && 'relative z-50')}>
      <CardLabel className="text-sun/80">Ubicación actual</CardLabel>

      <div className="mt-3 border-b border-white/5 pb-3">
        <p
          className={cn(
            'truncate text-base font-semibold tracking-tight text-foreground',
            isLoading && 'animate-pulse text-muted-foreground',
          )}
          title={displayName}
        >
          {primaryName}
        </p>
        {regionName ? (
          <p className="mt-1 truncate text-xs text-muted-foreground" title={regionName}>
            {regionName}
          </p>
        ) : null}
        <p className="mt-2 font-mono text-[0.72rem] text-muted-foreground/85">
          {formatCoordinate(location.lat, 'lat')}, {formatCoordinate(location.lon, 'lon')}
        </p>
      </div>

      <div className="mt-2">
        <InfoRow label="Zona horaria" value={timezone} />
        <InfoRow label="Hemisferio" value={hemisphere} highlight="golden" />
        <InfoRow label="Hora civil local" value={civilTime} />
        <InfoRow label="Hora geométrica" value={geometricTime} highlight="golden" />
        <InfoRow label="Amanecer" value={snapshot.solar.sunrise.local} />
        <InfoRow label="Atardecer" value={snapshot.solar.sunset.local} />
        <InfoRow label="Duración del día" value={snapshot.solar.dayLength} />
        <InfoRow label="Duración de la noche" value={snapshot.solar.nightLength} />
        <DayNightRow label="Estado del día" dayNight={dayNight} />
        <InfoRow label="Estación actual" value={season} last />
      </div>

      <LocationManager onOpenChange={setLocationMenuOpen} />
    </GlassCard>
  )
}

function InfoRow({ label, value, last, highlight }) {
  return (
    <div className={cn('flex items-center justify-between gap-3 py-2', !last && 'border-b border-white/5')}>
      <span className="text-xs text-muted-foreground">{label}</span>
      <span
        className={cn(
          'max-w-[58%] break-words text-right font-mono tabular-nums',
          highlight === 'golden'
            ? 'text-sm font-medium text-golden'
            : 'text-xs text-foreground',
        )}
        title={value}
      >
        {value ?? '—'}
      </span>
    </div>
  )
}

function DayNightRow({ label, dayNight }) {
  const Icon = dayNight.isDay ? SunIcon : MoonIcon

  return (
    <div className="flex items-center justify-between gap-3 border-b border-white/5 py-2.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span
        className={cn(
          'inline-flex max-w-[58%] items-center justify-end gap-1.5 font-mono text-base font-semibold tabular-nums tracking-tight',
          dayNight.isDay ? 'text-golden' : 'text-blue-hour',
        )}
      >
        <Icon className={cn('h-4 w-4 shrink-0', dayNight.isDay ? 'text-golden' : 'text-blue-hour')} aria-hidden="true" />
        <span>{dayNight.label}</span>
      </span>
    </div>
  )
}

function splitLocationName(name) {
  const parts = String(name ?? '').split(',').map((part) => part.trim()).filter(Boolean)
  return {
    primaryName: parts[0] || 'Ubicación seleccionada',
    regionName: parts.length > 1 ? parts.slice(1).join(', ') : null,
  }
}

function formatCoordinate(value, axis) {
  const direction = axis === 'lat'
    ? (value >= 0 ? 'N' : 'S')
    : (value >= 0 ? 'E' : 'O')
  return `${Math.abs(value).toFixed(4)}° ${direction}`
}

function formatGeometricClock(snapshot) {
  const { h, m } = snapshot.raw.geoHms
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

function formatCivilClock(civilTime) {
  const parts = String(civilTime ?? '').split(':')
  return parts.length >= 2 ? `${parts[0]}:${parts[1]}` : civilTime
}
