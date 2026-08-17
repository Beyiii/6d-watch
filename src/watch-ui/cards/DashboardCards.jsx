import { useState } from 'react'
import { useWatch } from '../../context/WatchContext.jsx'
import { getSeasonName } from '../../calendar.js'
import {
  computeGeometricCivilDeltaMinutes,
  formatGeometricCivilDelta,
} from '../../core/geometricTime.js'
import { computeSolarCycleProgress } from '../../core/solarCycleProgress.js'
import Map from '../../components/Map.jsx'
import { LocationManager } from '../LocationManager.jsx'
import { cn } from '../lib/utils.js'
import { GlassCard, CardLabel } from '../GlassCard.jsx'
import { SolarArc } from '../SolarArc.jsx'
import {
  MoonPhaseIcon,
  SunIcon,
  SunriseIcon,
  SunsetIcon,
  CalendarIcon,
} from '../icons.jsx'

const SEASON_BADGE = {
  Primavera: { icon: '🌸', label: 'Primavera' },
  Verano: { icon: '☀️', label: 'Verano' },
  Otoño: { icon: '🍂', label: 'Otoño' },
  Invierno: { icon: '❄️', label: 'Invierno' },
}

// Arco circular amplio: radio > medio-cuerda para curvatura intermedia (ni plano ni semicírculo).
const V2_SOLAR_TRAJECTORY = {
  width: 100,
  marginX: 2,
  dayHorizonY: 70,
  nightHorizonY: 30,
  radiusFactor: 1.48,
  viewPad: 2,
}

const SOLAR_TRAJECTORY_DAY_GRADIENT_STOPS = [
  { offset: '0%', color: 'oklch(0.78 0.16 55)' },
  { offset: '100%', color: 'oklch(0.88 0.15 80)' },
]

const SOLAR_TRAJECTORY_NIGHT_GRADIENT_STOPS = [
  { offset: '0%', color: 'oklch(0.94 0.02 240)' },
  { offset: '50%', color: 'oklch(0.78 0.06 250)' },
  { offset: '100%', color: 'oklch(0.55 0.11 265)' },
]

function getSolarArcGeometry(horizonY) {
  const { width, marginX, radiusFactor } = V2_SOLAR_TRAJECTORY
  const leftX = marginX
  const rightX = width - marginX
  const cx = width / 2
  const halfChord = (rightX - leftX) / 2
  const r = halfChord * radiusFactor
  const centerOffset = Math.sqrt(r * r - halfChord * halfChord)
  const sagitta = r - centerOffset

  return {
    cx,
    r,
    halfChord,
    sagitta,
    horizonY,
    cyUpper: horizonY + centerOffset,
    cyLower: horizonY - centerOffset,
    left: { x: leftX, y: horizonY },
    right: { x: rightX, y: horizonY },
  }
}

function pointOnUpperArc(progress, geom, leftToRight) {
  const { cx, r, cyUpper, left, right } = geom
  const thetaLeft = Math.atan2(left.y - cyUpper, -geom.halfChord)
  const thetaRight = Math.atan2(right.y - cyUpper, geom.halfChord)
  const t = leftToRight ? progress : 1 - progress
  const theta = thetaLeft + t * (thetaRight - thetaLeft)

  return {
    x: cx + r * Math.cos(theta),
    y: cyUpper + r * Math.sin(theta),
  }
}

function pointOnLowerArc(progress, geom, leftToRight) {
  const { cx, r, cyLower, left, right } = geom
  const thetaLeft = Math.atan2(left.y - cyLower, -geom.halfChord)
  const thetaRight = Math.atan2(right.y - cyLower, geom.halfChord)
  const t = leftToRight ? progress : 1 - progress
  const theta = thetaLeft + t * (thetaRight - thetaLeft)

  return {
    x: cx + r * Math.cos(theta),
    y: cyLower + r * Math.sin(theta),
  }
}

function upperArcPath(geom, leftToRight) {
  const { left, right, r } = geom
  if (leftToRight) {
    return `M ${left.x} ${left.y} A ${r} ${r} 0 0 1 ${right.x} ${right.y}`
  }
  return `M ${right.x} ${right.y} A ${r} ${r} 0 0 0 ${left.x} ${left.y}`
}

function lowerArcPath(geom, leftToRight) {
  const { left, right, r } = geom
  // Barrido opuesto al arco superior para que la curva pase por debajo del horizonte.
  if (leftToRight) {
    return `M ${left.x} ${left.y} A ${r} ${r} 0 0 0 ${right.x} ${right.y}`
  }
  return `M ${right.x} ${right.y} A ${r} ${r} 0 0 1 ${left.x} ${left.y}`
}

function arcPathToPoint(start, end, r, sweep) {
  return `M ${start.x} ${start.y} A ${r} ${r} 0 0 ${sweep} ${end.x} ${end.y}`
}

function buildViewBox(isDay, geom) {
  const { width, viewPad } = V2_SOLAR_TRAJECTORY
  const { horizonY, sagitta } = geom

  if (isDay) {
    const yMin = horizonY - sagitta - viewPad
    const yMax = horizonY + viewPad
    return `0 ${yMin} ${width} ${yMax - yMin}`
  }

  const yMin = horizonY - viewPad
  const yMax = horizonY + sagitta + viewPad
  return `0 ${yMin} ${width} ${yMax - yMin}`
}

function clamp01(value) {
  return Math.max(0, Math.min(1, value))
}

function isValidDate(date) {
  return date instanceof Date && Number.isFinite(date.getTime())
}

function progressBetween(now, start, end) {
  if (!isValidDate(now) || !isValidDate(start) || !isValidDate(end)) return 0
  const duration = end.getTime() - start.getTime()
  if (duration <= 0) return 0
  return clamp01((now.getTime() - start.getTime()) / duration)
}

function progressViaSolarNoon(now, sunrise, solarNoon, sunset) {
  if (!isValidDate(solarNoon) || solarNoon <= sunrise || solarNoon >= sunset) {
    return progressBetween(now, sunrise, sunset)
  }

  if (now <= solarNoon) {
    return progressBetween(now, sunrise, solarNoon) * 0.5
  }

  return 0.5 + progressBetween(now, solarNoon, sunset) * 0.5
}

function computeV2SolarTrajectory({ now, sunriseToday, solarNoon, sunsetToday, activeSunset, activeNextSunrise, lat }) {
  if (!isValidDate(now) || !isValidDate(sunriseToday) || !isValidDate(sunsetToday)) {
    return null
  }

  const isSouthernHemisphere = lat < 0
  const isDay = now >= sunriseToday && now < sunsetToday
  const horizonY = isDay ? V2_SOLAR_TRAJECTORY.dayHorizonY : V2_SOLAR_TRAJECTORY.nightHorizonY
  const geom = getSolarArcGeometry(horizonY)

  if (isDay) {
    const leftToRight = !isSouthernHemisphere
    const progress = progressViaSolarNoon(now, sunriseToday, solarNoon, sunsetToday)
    const start = leftToRight ? geom.left : geom.right
    const sweep = leftToRight ? 1 : 0
    const marker = pointOnUpperArc(progress, geom, leftToRight)

    return {
      isDay,
      horizonY,
      progress,
      viewBox: buildViewBox(true, geom),
      path: upperArcPath(geom, leftToRight),
      traveledPath: progress > 0 ? arcPathToPoint(start, marker, geom.r, sweep) : null,
      marker,
    }
  }

  const leftToRight = isSouthernHemisphere
  const progress = progressBetween(now, activeSunset, activeNextSunrise)
  const start = leftToRight ? geom.left : geom.right
  const sweep = leftToRight ? 0 : 1
  const marker = pointOnLowerArc(progress, geom, leftToRight)

  return {
    isDay,
    horizonY,
    progress,
    viewBox: buildViewBox(false, geom),
    path: lowerArcPath(geom, leftToRight),
    traveledPath: progress > 0 ? arcPathToPoint(start, marker, geom.r, sweep) : null,
    marker,
  }
}

function shouldFlipSolarTrajectoryGradient(isDay, lat) {
  const isSouthernHemisphere = lat < 0
  return isDay ? !isSouthernHemisphere : isSouthernHemisphere
}

function getSolarTrajectoryCardinals(lat) {
  const isSouthernHemisphere = lat < 0

  if (isSouthernHemisphere) {
    return { top: 'Norte', left: 'Oeste', right: 'Este' }
  }

  return { top: 'Sur', left: 'Este', right: 'Oeste' }
}

function SolarTrajectoryCardinalOverlay({ side, label }) {
  if (side === 'top') {
    return (
      <span className="pointer-events-none absolute left-1/2 top-[20%] z-[1] -translate-x-1/2 -translate-y-1/2 text-[0.62rem] leading-none tracking-wide text-white/35">
        {label}
      </span>
    )
  }

  return (
    <span
      className={cn(
        'pointer-events-none absolute top-1/2 z-[1] flex -translate-y-1/2 flex-col items-center gap-[0.08em] text-[0.62rem] leading-none tracking-wide text-white/35',
        side === 'left' ? 'left-1.5' : 'right-1.5',
      )}
    >
      {label.split('').map((char, index) => (
        <span key={`${label}-${index}`}>{char}</span>
      ))}
    </span>
  )
}

export function SeasonBadge() {
  const { location, nowLuxon } = useWatch()
  const seasonName = getSeasonName(nowLuxon, location.lat)
  const season = SEASON_BADGE[seasonName] ?? SEASON_BADGE.Otoño

  return (
    <div
      className="absolute right-4 top-4 z-30 flex items-center gap-2 rounded-2xl border border-white/10 bg-background/60 px-3 py-2 text-sm shadow-[0_8px_24px_-8px_oklch(0_0_0/0.55)] backdrop-blur-md"
      aria-label={`Estación actual: ${season.label}`}
    >
      <span className="text-base leading-none" aria-hidden="true">
        {season.icon}
      </span>
      <span className="font-medium tracking-tight">{season.label}</span>
    </div>
  )
}

export function CurrentDayCard({ compact, className }) {
  const { nowLuxon } = useWatch()
  const dateLine = nowLuxon.setLocale('es').toFormat("dd 'de' LLLL 'de' yyyy")
  const weekday = nowLuxon.setLocale('es').toFormat('cccc')

  return (
    <GlassCard className={cn("p-4 relative group", className)}>
      <div className="flex items-start justify-between gap-3 w-full">
        <div className="space-y-1 flex-1 min-w-0">
          <CardLabel className="text-muted-foreground/90">Día actual</CardLabel>
          <p className="font-semibold text-foreground leading-snug tracking-tight mt-1.5 whitespace-nowrap text-base">
            {dateLine}
          </p>
        </div>
        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-white/10 bg-white/5 text-muted-foreground transition-all duration-300 group-hover:border-white/20 group-hover:bg-white/10">
          <CalendarIcon className="h-4 w-4" />
        </div>
      </div>
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/80 capitalize mt-2">
        {weekday}
      </p>
    </GlassCard>
  )
}

export function CivilTimeCard({ compact, className }) {
  const { snapshot } = useWatch()
  const parts = snapshot.ui.civilTime.split(':')
  const hhmm = parts.length >= 2 ? `${parts[0]}:${parts[1]}` : snapshot.ui.civilTime
  const ss = parts[2] ?? '00'

  return (
    <GlassCard className={cn("p-4", className)}>
      <CardLabel>Hora civil</CardLabel>
      <p className="mt-2 font-mono font-light tracking-tight tabular-nums text-3xl sm:text-4xl text-foreground">
        {hhmm}
        <span className="text-xl sm:text-2xl text-muted-foreground">
          :{ss}
        </span>
      </p>
    </GlassCard>
  )
}

const GEO_TIME_BAR_DAY_GRADIENT =
  'linear-gradient(90deg, oklch(0.78 0.16 55), oklch(0.88 0.15 80))'
const GEO_TIME_BAR_NIGHT_GRADIENT =
  'linear-gradient(90deg, oklch(0.92 0.03 245), oklch(0.68 0.10 265))'

export function GeometricTimeCard({ compact, className }) {
  const { snapshot } = useWatch()
  const { h, m } = snapshot.raw.geoHms
  const time = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
  const { label: cycleLabel, progress: cycleProgress, isDay, isPolar } =
    computeSolarCycleProgress(snapshot)
  const pct = isPolar ? null : (cycleProgress * 100).toFixed(1)
  const deltaMinutes = computeGeometricCivilDeltaMinutes(
    snapshot.ui.civilTime,
    snapshot.raw.geometricHour,
  )
  const deltaLabel = formatGeometricCivilDelta(deltaMinutes)

  return (
    <GlassCard className={cn("p-4 flex flex-col justify-between", className)}>
      <CardLabel className="text-sun/80">Hora geométrica</CardLabel>
      <div className="flex-1 flex flex-col justify-center my-2">
        <div className="flex items-baseline justify-between gap-3">
          <p className="font-mono font-light tabular-nums text-sun text-3xl sm:text-4xl">
            {time}
          </p>
          {deltaLabel ? (
            <span className="shrink-0 font-mono text-xs tabular-nums text-muted-foreground/80 sm:text-sm">
              {deltaLabel}
            </span>
          ) : null}
        </div>
      </div>
      <div className="space-y-1.5 w-full">
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">{cycleLabel}</span>
          {pct != null ? <span className="text-foreground">{pct}%</span> : null}
        </div>
        {pct != null ? (
          <div className="h-1 overflow-hidden rounded-full bg-white/5">
            <div
              className="h-full rounded-full"
              style={{
                width: `${pct}%`,
                background: isDay ? GEO_TIME_BAR_DAY_GRADIENT : GEO_TIME_BAR_NIGHT_GRADIENT,
              }}
            />
          </div>
        ) : null}
      </div>
    </GlassCard>
  )
}

export function SunTimeCard({ label, time, icon }) {
  return (
    <GlassCard className="!p-3">
      <div className="flex items-center gap-2">
        {icon}
        <CardLabel>{label}</CardLabel>
      </div>
      <p className="mt-1 font-mono text-xl font-light tabular-nums">{time}</p>
    </GlassCard>
  )
}

export function DurationCard({ label, value, className }) {
  return (
    <GlassCard className={cn("p-4 flex flex-col justify-center h-full", className)}>
      <CardLabel>{label}</CardLabel>
      <p className="mt-1.5 font-mono text-base tabular-nums">{value}</p>
    </GlassCard>
  )
}

export function GoldenHourCard() {
  const { snapshot } = useWatch()
  const { goldenPM } = snapshot.specialLight

  return (
    <GlassCard className="!p-5">
      <div className="flex items-center gap-2">
        <span className="h-2 w-2 rounded-full bg-golden shadow-[0_0_8px] shadow-golden" />
        <CardLabel className="text-golden">Golden Hour</CardLabel>
      </div>
      <div className="mt-4 grid grid-cols-3 gap-3 text-center">
        <TimeStat label="Comienza" value={goldenPM.start.local} />
        <TimeStat label="Máxima" value={goldenPM.end.local} highlight="golden" />
        <TimeStat label="Termina" value={snapshot.solar.sunset.local} />
      </div>
      <div className="mt-3">
        <SolarArc variant="golden" progress={0.52} />
      </div>
    </GlassCard>
  )
}

export function BlueHourCard() {
  const { snapshot } = useWatch()
  const { blueAM } = snapshot.specialLight

  return (
    <GlassCard className="!p-5">
      <div className="flex items-center gap-2">
        <span className="h-2 w-2 rounded-full bg-blue-hour shadow-[0_0_8px] shadow-blue-hour" />
        <CardLabel className="text-blue-hour">Blue Hour</CardLabel>
      </div>
      <div className="mt-4 grid grid-cols-3 gap-3 text-center">
        <TimeStat label="Comienza" value={blueAM.start.local} />
        <TimeStat label="Máxima" value={blueAM.end.local} highlight="blue" />
        <TimeStat label="Termina" value={snapshot.solar.sunrise.local} />
      </div>
      <div className="mt-3">
        <SolarArc variant="blue" progress={0.48} />
      </div>
    </GlassCard>
  )
}

function TimeStat({ label, value, highlight }) {
  const color =
    highlight === 'golden'
      ? 'text-golden'
      : highlight === 'blue'
        ? 'text-blue-hour'
        : 'text-foreground'
  return (
    <div>
      <p className="text-[0.7rem] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className={`mt-1 font-mono text-lg tabular-nums ${color}`}>{value}</p>
    </div>
  )
}

export function LocationCard({ compact, prominent, className }) {
  const { location, snapshot, onSelectLocation } = useWatch()
  const [locationMenuOpen, setLocationMenuOpen] = useState(false)

  return (
    <GlassCard
      className={cn(
        compact && 'p-4',
        prominent && 'flex min-h-0 flex-1 flex-col overflow-visible p-4',
        locationMenuOpen && 'relative z-50',
        className,
      )}
    >
      <CardLabel>Ubicación</CardLabel>
      <div
        className={cn(
          'location-map-host relative mt-2 overflow-hidden rounded-xl border border-white/5',
          prominent
            ? 'min-h-[300px] flex-1'
            : compact
              ? 'aspect-[16/7]'
              : 'aspect-[16/10]',
        )}
      >
        <Map onSelectLocation={onSelectLocation} markerPosition={location} />
      </div>

      <LocationManager onOpenChange={setLocationMenuOpen} />

      <p className="mt-2 text-center font-mono text-[0.7rem] text-muted-foreground/80">
        {snapshot.ui.locationLine2}
      </p>
    </GlassCard>
  )
}

function getPolarTrajectoryLabel(snapshot) {
  const kind = snapshot?.solarCycle?.kind ?? snapshot?.raw?.solarWindow?.polarKind
  if (kind === 'polar-night') return 'Noche polar'
  if (kind === 'polar-day') return 'Día polar'
  if (snapshot?.polar) {
    return snapshot.raw?.solarWindow?.sunUpNow ? 'Día polar' : 'Noche polar'
  }
  return null
}

export function SolarTrajectoryPlaceholder({ className }) {
  const { location, snapshot } = useWatch()
  const polarLabel = getPolarTrajectoryLabel(snapshot)
  const trajectory = polarLabel
    ? null
    : computeV2SolarTrajectory({
        now: snapshot.raw.now,
        sunriseToday: snapshot.raw.sunriseToday,
        sunsetToday: snapshot.raw.sunsetToday,
        activeSunset: snapshot.raw.activeSunset,
        activeNextSunrise: snapshot.raw.activeNextSunrise,
        lat: location.lat,
        solarNoon: snapshot.raw.solarEvents?.solarNoon,
      })
  const gradientStops = trajectory?.isDay
    ? SOLAR_TRAJECTORY_DAY_GRADIENT_STOPS
    : SOLAR_TRAJECTORY_NIGHT_GRADIENT_STOPS
  const flipGradient = trajectory
    ? shouldFlipSolarTrajectoryGradient(trajectory.isDay, location.lat)
    : false
  const gradLeftX = V2_SOLAR_TRAJECTORY.marginX
  const gradRightX = V2_SOLAR_TRAJECTORY.width - V2_SOLAR_TRAJECTORY.marginX
  const gradX1 = flipGradient ? gradRightX : gradLeftX
  const gradX2 = flipGradient ? gradLeftX : gradRightX
  const cardinals = getSolarTrajectoryCardinals(location.lat)

  return (
    <GlassCard className={cn('flex min-h-0 flex-1 flex-col !p-3', className)}>
      <CardLabel>Trayectoria solar</CardLabel>
      <div className="relative mt-1.5 flex min-h-0 flex-1 items-stretch overflow-hidden rounded-xl border border-white/10 bg-white/[0.02]">
        {polarLabel ? (
          <div className="flex min-h-0 flex-1 items-center justify-center px-4">
            <p className="text-sm font-medium tracking-tight text-muted-foreground">
              {polarLabel}
            </p>
          </div>
        ) : trajectory ? (
          <>
            <SolarTrajectoryCardinalOverlay side="top" label={cardinals.top} />
            <SolarTrajectoryCardinalOverlay side="left" label={cardinals.left} />
            <SolarTrajectoryCardinalOverlay side="right" label={cardinals.right} />
            <svg
              viewBox={trajectory.viewBox}
              preserveAspectRatio="xMidYMid meet"
              className="block h-full min-h-0 w-full text-white/35"
              aria-hidden="true"
            >
              <defs>
                <linearGradient
                  id="v2-solar-trajectory-grad"
                  gradientUnits="userSpaceOnUse"
                  x1={gradX1}
                  y1={trajectory.horizonY}
                  x2={gradX2}
                  y2={trajectory.horizonY}
                >
                  {gradientStops.map(({ offset, color }) => (
                    <stop key={offset} offset={offset} stopColor={color} />
                  ))}
                </linearGradient>
              </defs>
              <line
                x1={V2_SOLAR_TRAJECTORY.marginX}
                y1={trajectory.horizonY}
                x2={V2_SOLAR_TRAJECTORY.width - V2_SOLAR_TRAJECTORY.marginX}
                y2={trajectory.horizonY}
                stroke="currentColor"
                strokeWidth="1"
                vectorEffect="non-scaling-stroke"
                strokeDasharray="3 6"
                opacity="0.35"
              />
              <path
                d={trajectory.path}
                fill="none"
                stroke="url(#v2-solar-trajectory-grad)"
                strokeWidth="1.2"
                vectorEffect="non-scaling-stroke"
                opacity="0.38"
              />
              {trajectory.traveledPath ? (
                <path
                  d={trajectory.traveledPath}
                  fill="none"
                  stroke="url(#v2-solar-trajectory-grad)"
                  strokeWidth="2.6"
                  vectorEffect="non-scaling-stroke"
                  strokeLinecap="butt"
                  opacity="0.95"
                />
              ) : null}
              <circle
                cx={trajectory.marker.x}
                cy={trajectory.marker.y}
                r="1.8"
                fill="url(#v2-solar-trajectory-grad)"
              />
            </svg>
          </>
        ) : (
          <div className="min-h-0 flex-1 w-full" aria-hidden="true" />
        )}
      </div>
    </GlassCard>
  )
}

export function MoonPhaseSummaryCard({ expanded, className }) {
  const { location, snapshot } = useWatch()
  const { lunar } = snapshot
  const phase = snapshot.raw.lunarData?.phase ?? 0.5
  const moonHemisphere = location.lat < 0 ? 'south' : 'north'

  return (
    <GlassCard className={cn("p-4 flex flex-col", className)}>
      <CardLabel className="text-[oklch(0.8_0.08_220)]">Fase lunar</CardLabel>

      <div className="flex flex-col items-center justify-center flex-1 gap-3 py-4">
        <MoonPhaseIcon
          className="shrink-0 text-moon drop-shadow-[0_0_15px_oklch(0.92_0.02_250/0.45)] h-20 w-20"
          phase={phase}
          hemisphere={moonHemisphere}
        />
        <p className="min-w-0 font-semibold text-base sm:text-lg leading-tight tracking-tight text-foreground/95 text-center">
          {lunar.phaseName}
        </p>
      </div>

      <div className="flex items-center justify-between border-t border-white/5 pt-3 pb-0">
        <span className="text-sm text-muted-foreground">Iluminación</span>
        <span className="font-mono text-base font-medium tabular-nums text-foreground">
          {lunar.illumination}%
        </span>
      </div>
    </GlassCard>
  )
}

export function SolarDataCard() {
  const { snapshot } = useWatch()
  const { solar, solarCycle } = snapshot

  return (
    <GlassCard>
      <div className="mb-3 flex items-center gap-2">
        <SunIcon className="h-4 w-4 text-sun" />
        <CardLabel className="text-sun/80">Datos solares</CardLabel>
      </div>
      {solarCycle ? (
        <>
          <Row label="Estado" value={solarCycle.statusLine} />
          <Row label="Duración" value={solarCycle.durationLine} />
        </>
      ) : (
        <>
          <Row label="Amanecer" value={solar.sunrise.local} />
          <Row label="Atardecer" value={solar.sunset.local} />
        </>
      )}
      <Row
        label="Elevación máxima"
        value={`${solar.maxElevationDeg}°`}
        subValue={solar.solarNoon.local}
      />
      <Row label="Duración del día" value={solar.dayLength} />
      <Row label="Duración de la noche" value={solar.nightLength} last />
    </GlassCard>
  )
}

export function LunarDataCard() {
  const { location, snapshot } = useWatch()
  const { lunar } = snapshot
  const phase = snapshot.raw.lunarData?.phase ?? 0.5
  const moonHemisphere = location.lat < 0 ? 'south' : 'north'

  return (
    <GlassCard>
      <div className="mb-3 flex items-center gap-2">
        <MoonPhaseIcon className="h-4 w-4 text-moon" phase={phase} hemisphere={moonHemisphere} />
        <CardLabel className="text-moon/80">Datos lunares</CardLabel>
      </div>
      <Row label="Fase lunar" value={lunar.phaseName} />
      <Row label="Iluminación" value={`${lunar.illumination}%`} />
      <Row label="Salida de la luna" value={lunar.moonrise.local} />
      <Row label="Puesta de la luna" value={lunar.moonset.local} last />
    </GlassCard>
  )
}

function Row({ label, value, subValue, last }) {
  return (
    <div
      className={`flex items-center justify-between py-2 ${last ? '' : 'border-b border-white/5'
        }`}
    >
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-right">
        <span className="block font-mono text-sm tabular-nums text-foreground">{value}</span>
        {subValue ? (
          <span className="block font-mono text-[0.7rem] text-muted-foreground">{subValue}</span>
        ) : null}
      </span>
    </div>
  )
}

export function SunriseSunsetCard({ className }) {
  const { snapshot } = useWatch()

  return (
    <GlassCard className={cn("p-0 flex flex-col justify-between", className)}>
      {/* Inner wrapper clips rounded corners while the GlassCard itself stays overflow-visible for glow */}
      <div className="flex flex-col flex-1 overflow-hidden rounded-2xl">
        <div className="flex flex-1 items-center gap-3 px-4 py-4">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-white/10 bg-white/5">
            <SunriseIcon className="h-5 w-5 text-sun" />
          </span>
          <div className="min-w-0">
            <CardLabel>Amanecer</CardLabel>
            <p className="mt-0.5 font-mono text-xl font-light tabular-nums">
              {snapshot.solar.sunrise.local}
            </p>
          </div>
        </div>

        <div className="mx-4 border-t border-white/5" aria-hidden="true" />

        <div className="flex flex-1 items-center gap-3 px-4 py-4">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-white/10 bg-white/5">
            <SunsetIcon className="h-5 w-5 text-golden" />
          </span>
          <div className="min-w-0">
            <CardLabel>Atardecer</CardLabel>
            <p className="mt-0.5 font-mono text-xl font-light tabular-nums">
              {snapshot.solar.sunset.local}
            </p>
          </div>
        </div>
      </div>
    </GlassCard>
  )
}

export function DurationCards({ className }) {
  const { snapshot } = useWatch()
  return (
    <>
      <DurationCard label="Duración del día" value={snapshot.solar.dayLength} className={className} />
      <DurationCard label="Duración de la noche" value={snapshot.solar.nightLength} className={className} />
    </>
  )
}
