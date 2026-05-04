import SunCalc from 'suncalc'

function clamp01(value) {
  return Math.max(0, Math.min(1, value))
}

function formatDuration(ms) {
  const totalMinutes = Math.round(ms / 60000)
  const h = Math.floor(totalMinutes / 60)
  const m = totalMinutes % 60
  return `${h}h ${m.toString().padStart(2, '0')}m`
}

function formatLocalTime(date, timezone) {
  if (!date) return '—'
  // Evitamos depender de Luxon aquí: sólo se usa para un label simple.
  // `toLocaleTimeString` respeta el timezone via Intl.
  return new Intl.DateTimeFormat('es-CL', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: timezone,
  }).format(date)
}

function computeArcPoint(progress, radius, centerX, centerY, isNight) {
  const angle = isNight
    ? Math.PI * progress // noche: derecha -> izquierda (arco inferior)
    : Math.PI * (1 - progress) // día: izquierda -> derecha (arco superior)

  const x = centerX + Math.cos(angle) * radius
  const y = isNight ? centerY + Math.sin(angle) * radius : centerY - Math.sin(angle) * radius

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

export function ensureSolarArcTemplate(container) {
  if (!container) return null
  if (container.querySelector('.solar-arc-svg')) return container

  container.innerHTML = `
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

  return container
}

export function setSolarArcFallback(container) {
  const root = ensureSolarArcTemplate(container)
  if (!root) return

  const phaseNode = root.querySelector('.solar-phase')
  const remainingNode = root.querySelector('.solar-remaining')
  const dayProgressPath = root.querySelector('.solar-track-day-progress')
  const nightProgressPath = root.querySelector('.solar-track-night-progress')
  const markerPctNode = root.querySelector('.solar-marker-pct')

  if (phaseNode) phaseNode.textContent = 'Sin trayectoria solar disponible'
  if (remainingNode) remainingNode.textContent = 'Latitud extrema en este periodo'
  if (dayProgressPath) dayProgressPath.style.strokeDasharray = '0 100'
  if (nightProgressPath) nightProgressPath.style.strokeDasharray = '0 100'
  if (markerPctNode) markerPctNode.textContent = ''
}

export function updateSolarArc(container, params) {
  const root = ensureSolarArcTemplate(container)
  if (!root) return

  const {
    now,
    sunriseToday,
    sunsetToday,
    activeSunset,
    activeNextSunrise,
    timezone,
    lat,
    lon,
    solarNoon,
  } = params

  if (!sunriseToday || !sunsetToday || !activeSunset || !activeNextSunrise) {
    setSolarArcFallback(root)
    return
  }

  const isDay = now >= sunriseToday && now < sunsetToday

  const progress = isDay
    ? clamp01((now - sunriseToday) / (sunsetToday - sunriseToday))
    : clamp01((now - activeSunset) / (activeNextSunrise - activeSunset))

  const dayProgress = clamp01((now - sunriseToday) / (sunsetToday - sunriseToday))

  const remainingMs = isDay ? Math.max(0, sunsetToday - now) : Math.max(0, activeNextSunrise - now)

  const radius = 92
  const centerX = 130
  const centerY = 106

  const marker = isDay
    ? computeSolarPointByAltitude(now, dayProgress, lat, lon, solarNoon || now, radius, centerX, centerY)
    : computeArcPoint(progress, radius, centerX, centerY, true)

  const nightProgress = clamp01((now - activeSunset) / (activeNextSunrise - activeSunset))

  const progressedDayPct = Math.max(0, Math.min(100, dayProgress * 100))
  const remainingDayPctStroke = Math.max(0, 100 - progressedDayPct)
  const progressedNightPct = Math.max(0, Math.min(100, nightProgress * 100))
  const remainingNightPct = Math.max(0, 100 - progressedNightPct)
  const remainingDayPctLabel = isDay ? Math.round((1 - progress) * 100) : 0

  const phaseLabel = isDay ? `Día activo · queda ${remainingDayPctLabel}%` : 'Noche activa · Sol bajo horizonte'
  const timingLabel = isDay ? `Queda de día: ${formatDuration(remainingMs)}` : `Falta para amanecer: ${formatDuration(remainingMs)}`

  const sunriseLabel = formatLocalTime(sunriseToday, timezone)
  const sunsetLabel = formatLocalTime(sunsetToday, timezone)

  const markerNode = root.querySelector('.sun-marker')
  const dayProgressPath = root.querySelector('.solar-track-day-progress')
  const nightProgressPath = root.querySelector('.solar-track-night-progress')
  const phaseNode = root.querySelector('.solar-phase')
  const remainingNode = root.querySelector('.solar-remaining')
  const sunriseNode = root.querySelector('.solar-legend-sunrise')
  const sunsetNode = root.querySelector('.solar-legend-sunset')
  const markerPctNode = root.querySelector('.solar-marker-pct')

  const markerPct = isDay ? Math.round(progressedDayPct) : Math.round(progressedNightPct)
  const markerPctLabel = isDay ? `${markerPct}% día` : `${markerPct}% noche`

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
