import SunCalc from 'suncalc'
import { DateTime } from 'luxon'
import tzLookup from '@photostructure/tz-lookup'

import { getSolarEvents, getLunarData } from './astronomy.js'
import { initLocation } from './location.js'
import { getCalendarDay } from './calendar.js'
import { createClock, updateAnalogClock } from './clock.js'

// ─── Configuración ────────────────────────────────────────────────────────────

// Ubicación inicial: Santiago de Chile.
// Se actualiza cuando el usuario hace clic en el mapa.
let currentLocation = {
  lat:      -33.4489,
  lon:      -70.6693,
  timezone: tzLookup(-33.4489, -70.6693)
}

// ─── Estado global del caché ──────────────────────────────────────────────────

// El caché solo almacena datos del día actual para el reloj en vivo.
// Los datos del calendario se calculan on-demand en getCalendarDay().
let cachedDateStr     = null
let cachedSunTimes    = null
let cachedYesterday   = null
let cachedNextSunrise = null
let cachedSolarEvents = null
let cachedLunarData   = null
let celestialAnimationFrameId = null

// ─── Paleta dinamica de fondo (hora geometrica) ──────────────────────────────
// Cada ancla define 3 tonos para un gradiente con profundidad.
// El fondo final se interpola suavemente entre dos anclas vecinas.
const BACKGROUND_ANCHORS = [
  { hour: 0,  stops: ['#08142b', '#1a3d6c', '#4468a3'] },  // azul medianoche
  { hour: 3,  stops: ['#0f3748', '#31938c', '#82cfc2'] },  // celeste verduzco
  { hour: 6,  stops: ['#1d492f', '#4a9a5a', '#98d08c'] },  // verde amanecer
  { hour: 9,  stops: ['#bf7e11', '#FFD864', '#fff0b8'] },  // naranjo intenso -> dorado suave
  { hour: 12, stops: ['#d8b170', '#FFF0C2', '#fff9e6'] },  // beige mediodia
  { hour: 15, stops: ['#8a2b1f', '#C44D2C', '#db7f58'] },  // naranjo tarde (más oscuro)
  { hour: 18, stops: ['#5d0b12', '#A4171D', '#cd413c'] },  // rojo atardecer (más oscuro)
  { hour: 21, stops: ['#281a3f', '#5f4288', '#9276b8'] },  // morado noche
]

// ─── Estado del calendario ────────────────────────────────────────────────────

// Fecha que el usuario está explorando en el calendario.
// Empieza en hoy. Se actualiza con los botones de navegación.
let calendarDate = DateTime.now()

// ─── 1. updateDailyCache() ────────────────────────────────────────────────────
// Recalcula el caché del día actual si la fecha cambió.
// Solo se usa para el reloj en vivo; el calendario no usa este caché.

function updateDailyCache(now) {
  const dateStr = DateTime
    .fromJSDate(now)
    .setZone(currentLocation.timezone)
    .toFormat('yyyy-MM-dd')

  if (dateStr === cachedDateStr) return

  const { lat, lon } = currentLocation

  const yesterday = new Date(now)
  yesterday.setDate(now.getDate() - 1)

  const tomorrow = new Date(now)
  tomorrow.setDate(now.getDate() + 1)

  cachedSunTimes    = SunCalc.getTimes(now, lat, lon)
  cachedYesterday   = SunCalc.getTimes(yesterday, lat, lon)
  cachedNextSunrise = SunCalc.getTimes(tomorrow, lat, lon).sunrise
  cachedSolarEvents = getSolarEvents(now, lat, lon)
  cachedLunarData   = getLunarData(now, lat, lon)
  cachedDateStr     = dateStr

  console.log(`[updateDailyCache] Recalculado para ${dateStr}`)
}

// ─── 2. computeGeometricHour() ────────────────────────────────────────────────
// Calcula la hora geométrica como número decimal en [0, 24).
//
// Convención:
//   Amanecer → 6 | Mediodía → 12 | Atardecer → 18 | Medianoche → 0

function computeGeometricHour(now, sunrise, sunset, nextSunrise) {

  if (now >= sunrise && now < sunset) {
    const progressDay = (now - sunrise) / (sunset - sunrise)
    return 6 + progressDay * 12  // [6, 18)
  }

  const progressNight = (now - sunset) / (nextSunrise - sunset)
  const Hg = 18 + progressNight * 12  // [18, 30)

  return Hg >= 24 ? Hg - 24 : Hg  // [18, 24) noche / [0, 6) madrugada
}

// ─── 3. formatGeometricTime() ─────────────────────────────────────────────────

function formatGeometricTime(geometricHour) {
  const totalSeconds = Math.floor(geometricHour * 3600)
  const hh = Math.floor(totalSeconds / 3600)
  const mm = Math.floor((totalSeconds % 3600) / 60)
  const ss = totalSeconds % 60
  return [hh, mm, ss].map(n => n.toString().padStart(2, '0')).join(':')
}

// ─── 4. formatTimeDual() ──────────────────────────────────────────────────────
// Muestra un evento en la hora local del lugar seleccionado y en Santiago.

function formatTimeDual(date, timezone) {
  if (!date) return { local: '—', santiago: '—' }

  const local    = DateTime.fromJSDate(date).setZone(timezone).toFormat('HH:mm')
  const santiago = DateTime.fromJSDate(date).setZone('America/Santiago').toFormat('HH:mm')

  return { local, santiago }
}

// ─── 5. formatDuration() ──────────────────────────────────────────────────────

function formatDuration(ms) {
  const totalMinutes = Math.round(ms / 60000)
  const h = Math.floor(totalMinutes / 60)
  const m = totalMinutes % 60
  return `${h}h ${m.toString().padStart(2, '0')}m`
}

function clamp01(value) {
  return Math.max(0, Math.min(1, value))
}

function formatLocalTime(date, timezone) {
  if (!date) return '—'
  return DateTime.fromJSDate(date).setZone(timezone).toFormat('HH:mm')
}

function computeArcPoint(progress, radius, centerX, centerY, isNight) {
  const angle = isNight
    ? Math.PI * progress       // noche: derecha -> izquierda (arco inferior)
    : Math.PI * (1 - progress) // dia: izquierda -> derecha (arco superior)

  const x = centerX + Math.cos(angle) * radius
  const y = isNight
    ? centerY + Math.sin(angle) * radius
    : centerY - Math.sin(angle) * radius

  return {
    x: Number(x.toFixed(2)),
    y: Number(y.toFixed(2)),
  }
}

function computeSolarPointByAltitude(now, dayProgress, lat, lon, solarNoon, radius, centerX, centerY) {
  const leftX = centerX - radius
  const rightX = centerX + radius
  const x = leftX + (rightX - leftX) * clamp01(dayProgress)

  const currentPosition = SunCalc.getPosition(now, lat, lon)
  const noonAltitude = SunCalc.getPosition(solarNoon, lat, lon).altitude

  const maxAltitude = Math.max(0.15, noonAltitude)
  const altitudeRatio = clamp01(Math.max(0, currentPosition.altitude) / maxAltitude)
  const y = centerY - altitudeRatio * radius

  return {
    x: Number(x.toFixed(2)),
    y: Number(y.toFixed(2)),
  }
}

function ensureSolarArcTemplate() {
  const solarArc = document.querySelector('#solar-arc')
  if (!solarArc) return null

  if (solarArc.querySelector('.solar-arc-svg')) return solarArc

  solarArc.innerHTML = `
    <svg class="solar-arc-svg" viewBox="0 0 260 214" role="img" aria-label="Trayectoria solar diaria">
      <path class="solar-track-day" d="M 38 106 A 92 92 0 0 1 222 106" pathLength="100" />
      <path class="solar-track-day-progress" d="M 38 106 A 92 92 0 0 1 222 106" pathLength="100" />
      <path class="solar-track-night" d="M 38 106 A 92 92 0 0 0 222 106" pathLength="100" />
      <path class="solar-track-night-progress" d="M 222 106 A 92 92 0 0 1 38 106" pathLength="100" />

      <line class="solar-anchor" x1="38" y1="106" x2="38" y2="114" />
      <line class="solar-anchor" x1="222" y1="106" x2="222" y2="114" />

      <circle class="sun-marker" cx="130" cy="106" r="10" />
      <text class="solar-marker-pct" x="130" y="90">0%</text>

      <text class="solar-legend solar-legend-sunrise" x="50" y="110"></text>
      <text class="solar-legend solar-legend-right solar-legend-sunset" x="211" y="110"></text>
    </svg>

    <div class="solar-arc-meta">
      <div class="solar-phase"></div>
      <div class="solar-remaining"></div>
    </div>
  `

  return solarArc
}

function setSolarArcFallback() {
  const solarArc = ensureSolarArcTemplate()
  if (!solarArc) return

  const phaseNode = solarArc.querySelector('.solar-phase')
  const remainingNode = solarArc.querySelector('.solar-remaining')
  const dayProgressPath = solarArc.querySelector('.solar-track-day-progress')
  const nightProgressPath = solarArc.querySelector('.solar-track-night-progress')
  const markerPctNode = solarArc.querySelector('.solar-marker-pct')

  if (phaseNode) phaseNode.textContent = 'Sin trayectoria solar disponible'
  if (remainingNode) remainingNode.textContent = 'Latitud extrema en este periodo'
  if (dayProgressPath) dayProgressPath.style.strokeDasharray = '0 100'
  if (nightProgressPath) nightProgressPath.style.strokeDasharray = '0 100'
  if (markerPctNode) markerPctNode.textContent = ''
}

function updateSolarArc(now, sunriseToday, sunsetToday, activeSunset, activeNextSunrise, timezone, lat, lon, solarNoon) {
  const solarArc = ensureSolarArcTemplate()
  if (!solarArc) return

  if (!sunriseToday || !sunsetToday || !activeSunset || !activeNextSunrise) {
    setSolarArcFallback()
    return
  }

  const isDay = now >= sunriseToday && now < sunsetToday

  const progress = isDay
    ? clamp01((now - sunriseToday) / (sunsetToday - sunriseToday))
    : clamp01((now - activeSunset) / (activeNextSunrise - activeSunset))

  const dayProgress = clamp01((now - sunriseToday) / (sunsetToday - sunriseToday))

  const remainingMs = isDay
    ? Math.max(0, sunsetToday - now)
    : Math.max(0, activeNextSunrise - now)

  const radius = 92
  const centerX = 130
  const centerY = 106
  const marker = isDay
    ? computeSolarPointByAltitude(now, dayProgress, lat, lon, solarNoon, radius, centerX, centerY)
    : computeArcPoint(progress, radius, centerX, centerY, true)
  const nightProgress = clamp01((now - activeSunset) / (activeNextSunrise - activeSunset))

  const progressedDayPct = Math.max(0, Math.min(100, dayProgress * 100))
  const remainingDayPctStroke = Math.max(0, 100 - progressedDayPct)
  const progressedNightPct = Math.max(0, Math.min(100, nightProgress * 100))
  const remainingNightPct = Math.max(0, 100 - progressedNightPct)
  const remainingDayPctLabel = isDay ? Math.round((1 - progress) * 100) : 0

  const phaseLabel = isDay
    ? `Día activo · queda ${remainingDayPctLabel}%`
    : 'Noche activa · Sol bajo horizonte'

  const timingLabel = isDay
    ? `Queda de día: ${formatDuration(remainingMs)}`
    : `Falta para amanecer: ${formatDuration(remainingMs)}`

  const sunriseLabel = formatLocalTime(sunriseToday, timezone)
  const sunsetLabel = formatLocalTime(sunsetToday, timezone)

  const markerNode = solarArc.querySelector('.sun-marker')
  const dayProgressPath = solarArc.querySelector('.solar-track-day-progress')
  const nightProgressPath = solarArc.querySelector('.solar-track-night-progress')
  const phaseNode = solarArc.querySelector('.solar-phase')
  const remainingNode = solarArc.querySelector('.solar-remaining')
  const sunriseNode = solarArc.querySelector('.solar-legend-sunrise')
  const sunsetNode = solarArc.querySelector('.solar-legend-sunset')
  const markerPctNode = solarArc.querySelector('.solar-marker-pct')

  const markerPct = isDay
    ? Math.round(progressedDayPct)
    : Math.round(progressedNightPct)

  const markerPctLabel = isDay
    ? `${markerPct}% día`
    : `${markerPct}% noche`

  if (markerNode) {
    markerNode.setAttribute('cx', String(marker.x))
    markerNode.setAttribute('cy', String(marker.y))
    markerNode.classList.toggle('under-horizon', !isDay)
  }

  if (markerPctNode) {
    const dx = marker.x - centerX
    const dy = marker.y - centerY
    const vectorLen = Math.hypot(dx, dy) || 1
    const labelRadius = radius + 18

    const labelX = centerX + (dx / vectorLen) * labelRadius
    const labelY = centerY + (dy / vectorLen) * labelRadius

    markerPctNode.setAttribute('x', String(Math.max(14, Math.min(246, labelX))))
    markerPctNode.setAttribute('y', String(Math.max(18, Math.min(206, labelY))))
    markerPctNode.textContent = markerPctLabel
  }

  if (dayProgressPath) dayProgressPath.style.strokeDasharray = `${progressedDayPct.toFixed(2)} ${remainingDayPctStroke.toFixed(2)}`
  if (nightProgressPath) nightProgressPath.style.strokeDasharray = `${progressedNightPct.toFixed(2)} ${remainingNightPct.toFixed(2)}`
  if (phaseNode) phaseNode.textContent = phaseLabel
  if (remainingNode) remainingNode.textContent = timingLabel
  if (sunriseNode) sunriseNode.textContent = `Amanecer ${sunriseLabel}`
  if (sunsetNode) sunsetNode.textContent = `Atardecer ${sunsetLabel}`
}

function startCelestialAnimationLoop() {
  if (celestialAnimationFrameId) {
    cancelAnimationFrame(celestialAnimationFrameId)
    celestialAnimationFrameId = null
  }

  const step = () => {
    const { lat, lon, timezone } = currentLocation
    const now = DateTime.now().setZone(timezone).toJSDate()

    if (cachedSunTimes && cachedYesterday && cachedNextSunrise && cachedSolarEvents) {
      const sunriseToday = cachedSunTimes.sunrise
      const sunsetToday = cachedSunTimes.sunset
      const isBeforeSunrise = sunriseToday ? now < sunriseToday : false
      const activeSunset = isBeforeSunrise ? cachedYesterday.sunset : sunsetToday
      const activeNextSunrise = isBeforeSunrise ? sunriseToday : cachedNextSunrise

      updateSolarArc(
        now,
        sunriseToday,
        sunsetToday,
        activeSunset,
        activeNextSunrise,
        timezone,
        lat,
        lon,
        cachedSolarEvents.solarNoon || now
      )
    }

    celestialAnimationFrameId = requestAnimationFrame(step)
  }

  celestialAnimationFrameId = requestAnimationFrame(step)
}

// ─── 5b. Fondo dinamico por hora geometrica ──────────────────────────────────

function hexToRgb(hex) {
  const clean = hex.replace('#', '')
  const value = parseInt(clean, 16)

  return {
    r: (value >> 16) & 255,
    g: (value >> 8) & 255,
    b: value & 255,
  }
}

function mixChannel(a, b, t) {
  return Math.round(a + (b - a) * t)
}

function mixHexColor(fromHex, toHex, t) {
  const from = hexToRgb(fromHex)
  const to = hexToRgb(toHex)

  return `rgb(${mixChannel(from.r, to.r, t)}, ${mixChannel(from.g, to.g, t)}, ${mixChannel(from.b, to.b, t)})`
}

function resolveAnchorSegment(hour) {
  for (let i = 0; i < BACKGROUND_ANCHORS.length; i++) {
    const current = BACKGROUND_ANCHORS[i]
    const next = BACKGROUND_ANCHORS[(i + 1) % BACKGROUND_ANCHORS.length]

    const segmentStart = current.hour
    const rawEnd = next.hour
    const segmentEnd = rawEnd <= segmentStart ? rawEnd + 24 : rawEnd

    const normalizedHour = hour < segmentStart ? hour + 24 : hour

    if (normalizedHour >= segmentStart && normalizedHour < segmentEnd) {
      const t = (normalizedHour - segmentStart) / (segmentEnd - segmentStart)
      return { current, next, t }
    }
  }

  return {
    current: BACKGROUND_ANCHORS[0],
    next: BACKGROUND_ANCHORS[1],
    t: 0,
  }
}

function updateDynamicBackground(geometricHour) {
  const wrappedHour = ((geometricHour % 24) + 24) % 24
  const { current, next, t } = resolveAnchorSegment(wrappedHour)

  const start = mixHexColor(current.stops[0], next.stops[0], t)
  const mid = mixHexColor(current.stops[1], next.stops[1], t)
  const end = mixHexColor(current.stops[2], next.stops[2], t)

  document.body.style.setProperty('--dynamic-bg-start', start)
  document.body.style.setProperty('--dynamic-bg-mid', mid)
  document.body.style.setProperty('--dynamic-bg-end', end)
}

// ─── 6. renderClock() ─────────────────────────────────────────────────────────
// Renderiza la sección del reloj en vivo. Se llama cada segundo.

function renderClock() {
  const { lat, lon, timezone } = currentLocation
  const nowLuxon = DateTime.now().setZone(timezone)
  const now = nowLuxon.toJSDate()
  const primaryLocation = document.querySelector('#primary-location')
  const primaryDate = document.querySelector('#primary-date')
  const primaryCivilTime = document.querySelector('#primary-civil-time')
  const primaryGeoTime = document.querySelector('#primary-geo-time')
  const solarCard = document.querySelector('#solar-card')
  const lunarCard = document.querySelector('#lunar-card')
  const specialLightCard = document.querySelector('#special-light-card')

  if (!primaryLocation || !primaryDate || !primaryCivilTime || !primaryGeoTime || !solarCard || !lunarCard || !specialLightCard) return

  updateDailyCache(now)

  const sunriseToday    = cachedSunTimes.sunrise
  const sunsetToday     = cachedSunTimes.sunset
  const sunsetYesterday = cachedYesterday.sunset
  const nextSunrise     = cachedNextSunrise
  const solar           = cachedSolarEvents
  const lunar           = cachedLunarData

  if (!sunriseToday || !sunsetToday) {
    setSolarArcFallback()
    primaryLocation.innerHTML = `<span class="primary-location-line">${timezone}</span><span class="primary-location-line">Lat ${lat.toFixed(4)} · Lon ${lon.toFixed(4)}</span>`
    primaryDate.textContent = nowLuxon.setLocale('es').toFormat("cccc dd 'de' LLLL, yyyy")
    primaryCivilTime.textContent = nowLuxon.toFormat('HH:mm:ss')
    primaryGeoTime.textContent = '--:--:--'
    solarCard.innerHTML = '<h3><i class="bi bi-sun"></i> Datos solares</h3><p><i class="bi bi-exclamation-triangle"></i> Caso polar: sin amanecer/atardecer hoy.</p>'
    lunarCard.innerHTML = '<h3><i class="bi bi-moon-stars"></i> Datos lunares</h3><p><i class="bi bi-exclamation-triangle"></i> Datos lunares no disponibles para este instante.</p>'
    specialLightCard.innerHTML = '<h3><i class="bi bi-brightness-alt-high"></i> Luz especial</h3><p><i class="bi bi-exclamation-triangle"></i> No hay intervalos de luz especial para este caso.</p>'
    return
  }

  const isBeforeSunrise = now < sunriseToday
  const activeSunset    = isBeforeSunrise ? sunsetYesterday : sunsetToday
  const activeNextSunrise = isBeforeSunrise ? sunriseToday : nextSunrise

  const geometricHour      = computeGeometricHour(now, sunriseToday, activeSunset, activeNextSunrise)
  const formattedGeometric = formatGeometricTime(geometricHour)
  const formattedCivil     = nowLuxon.toFormat('HH:mm:ss')

  primaryLocation.innerHTML = `<span class="primary-location-line">${timezone}</span><span class="primary-location-line">Lat ${lat.toFixed(4)} · Lon ${lon.toFixed(4)}</span>`
  primaryDate.textContent = nowLuxon.setLocale('es').toFormat("cccc dd 'de' LLLL, yyyy")
  primaryCivilTime.textContent = formattedCivil
  primaryGeoTime.textContent = formattedGeometric
  
  // Reloj geométrico
  // geometricHour es decimal (ej. 14.532), lo descomponemos en h/m/s
  const geoH = Math.floor(geometricHour)
  const geoM = Math.floor((geometricHour - geoH) * 60)
  const geoS = Math.floor(((geometricHour - geoH) * 60 - geoM) * 60)

  // Fondo global: cambia segun hora geometrica y se interpola por tramos.
  updateDynamicBackground(geometricHour)
  
  updateAnalogClock(
    'geo-clock',
    geoH,
    geoM,
    geoS,
    formattedGeometric   // el "HH:MM:SS" que ya calculabas antes
  )
  
  const sunrise   = formatTimeDual(sunriseToday,    timezone)
  const sunset    = formatTimeDual(sunsetToday,     timezone)
  const solarNoon = formatTimeDual(solar.solarNoon, timezone)
  const moonrise  = formatTimeDual(lunar.moonrise,  timezone)
  const moonset   = formatTimeDual(lunar.moonset,   timezone)

  const ghAMStart = formatTimeDual(solar.goldenHourMorningStart, timezone)
  const ghAMEnd   = formatTimeDual(solar.goldenHourMorningEnd,   timezone)
  const ghPMStart = formatTimeDual(solar.goldenHourEveningStart, timezone)
  const ghPMEnd   = formatTimeDual(solar.goldenHourEveningEnd,   timezone)
  const bhAMStart = formatTimeDual(solar.blueHourMorningStart,   timezone)
  const bhAMEnd   = formatTimeDual(solar.blueHourMorningEnd,     timezone)
  const bhPMStart = formatTimeDual(solar.blueHourEveningStart,   timezone)
  const bhPMEnd   = formatTimeDual(solar.blueHourEveningEnd,     timezone)

  const dayLength   = formatDuration(sunsetToday - sunriseToday)
  const nightLength = formatDuration(activeNextSunrise - activeSunset)

  solarCard.innerHTML = `
    <h3><i class="bi bi-sun"></i> Datos solares</h3>
    <p><i class="bi bi-sunrise"></i> Amanecer: ${sunrise.local} <span class="small">(${sunrise.santiago})</span></p>
    <p><i class="bi bi-sunset"></i> Atardecer: ${sunset.local} <span class="small">(${sunset.santiago})</span></p>
    <p><i class="bi bi-brightness-high"></i> Mediodía: ${solarNoon.local} <span class="small">(${solarNoon.santiago})</span></p>
    <p><i class="bi bi-compass"></i> Elevación máxima: ${solar.maxElevationDeg}°</p>
    <p><i class="bi bi-clock"></i> Día: ${dayLength} &nbsp;|&nbsp; Noche: ${nightLength}</p>
  `

  lunarCard.innerHTML = `
    <h3><i class="bi bi-moon-stars"></i> Datos lunares</h3>
    <p>Fase: ${lunar.phaseName} — ${lunar.illumination}%</p>
    <p><i class="bi bi-arrow-up-circle"></i> Salida: ${moonrise.local} <span class="small">(${moonrise.santiago})</span></p>
    <p><i class="bi bi-arrow-down-circle"></i> Puesta: ${moonset.local} <span class="small">(${moonset.santiago})</span></p>
  `

  specialLightCard.innerHTML = `
    <h3><i class="bi bi-brightness-alt-high"></i> Luz especial</h3>
    <p>Golden AM: ${ghAMStart.local} → ${ghAMEnd.local} <span class="small">(${ghAMStart.santiago} → ${ghAMEnd.santiago})</span></p>
    <p>Golden PM: ${ghPMStart.local} → ${ghPMEnd.local} <span class="small">(${ghPMStart.santiago} → ${ghPMEnd.santiago})</span></p>
    <p>Blue AM: ${bhAMStart.local} → ${bhAMEnd.local} <span class="small">(${bhAMStart.santiago} → ${bhAMEnd.santiago})</span></p>
    <p>Blue PM: ${bhPMStart.local} → ${bhPMEnd.local} <span class="small">(${bhPMStart.santiago} → ${bhPMEnd.santiago})</span></p>
  `
}

// ─── 7. renderCalendar() ──────────────────────────────────────────────────────
// Renderiza la sección del calendario para la fecha en `calendarDate`.
// Se llama al cargar la página y cada vez que el usuario navega entre días.
// No corre en el intervalo de 1 segundo: solo se actualiza cuando cambia la fecha.

function renderCalendar() {
  const { lat, lon, timezone } = currentLocation
  const day = getCalendarDay(calendarDate, lat, lon, timezone)

  document.querySelector('#calendar').innerHTML = `
    <div class="card">
      <h3>📅 Calendario</h3>
      <p>
        <strong>${day.weekday}, ${day.date}</strong>
        &nbsp;·&nbsp; ${day.season}
      </p>
      <button id="prevDay">← Día anterior</button>
      <button id="nextDay">Día siguiente →</button>
      <button id="goToday">Hoy</button>
    </div>

    <div class="card">
      <h3>☀️ Sol</h3>
      <p>🌅 Amanecer: ${day.sunrise}</p>
      <p>🌇 Atardecer: ${day.sunset}</p>
      <p>☀️ Mediodía solar: ${day.solarNoon}</p>
      <p>📐 Elevación máxima: ${day.maxElevation}</p>
      <p>⏱ Día: ${day.dayLength} &nbsp;|&nbsp; Noche: ${day.nightLength}</p>
    </div>

    <div class="card">
      <h3>🌄 Luz especial</h3>
      <p>Golden AM: ${day.goldenHourMorning}</p>
      <p>Golden PM: ${day.goldenHourEvening}</p>
      <p>Blue AM: ${day.blueHourMorning}</p>
      <p>Blue PM: ${day.blueHourEvening}</p>
    </div>

    <div class="card">
      <h3>🌙 Luna</h3>
      <p>Fase: ${day.moonPhase} — ${day.moonIllum}</p>
      <p>🌕 Salida: ${day.moonrise}</p>
      <p>🌑 Puesta: ${day.moonset}</p>
    </div>
  `

  document.querySelector('#prevDay').addEventListener('click', () => {
    calendarDate = calendarDate.minus({ days: 1 })
    renderCalendar()
  })

  document.querySelector('#nextDay').addEventListener('click', () => {
    calendarDate = calendarDate.plus({ days: 1 })
    renderCalendar()
  })

  document.querySelector('#goToday').addEventListener('click', () => {
    calendarDate = DateTime.now()
    renderCalendar()
  })
}

// ─── Inicio ───────────────────────────────────────────────────────────────────

//    inicializa el reloj geométrico una sola vez:
createClock('geo-clock', {
  label: 'Reloj geométrico',
  geometric: true,
  // El reloj geométrico tiene 24 horas pero la esfera sigue siendo de 12,
  // así que mostramos 1–12 igual. La hora geométrica se convierte a 12h
  // automáticamente en updateAnalogClock() con el módulo 12.
})
 
// El reloj corre cada segundo
renderClock()
setInterval(renderClock, 1000)
startCelestialAnimationLoop()

// El calendario no se renderiza en esta disposición, pero se conserva la función.
document.querySelector('#calendar').style.display = 'none'

// Inicializa el mapa. El callback se dispara cuando el usuario selecciona una ubicación.
initLocation(({ lat, lon }) => {
  currentLocation.lat      = lat
  currentLocation.lon      = lon
  currentLocation.timezone = tzLookup(lat, lon)

  // Invalida el caché del reloj para la nueva ubicación.
  cachedDateStr = null
})