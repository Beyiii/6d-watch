import L from 'leaflet'
import SunCalc from 'suncalc'
import terminator from '@joergdietrich/leaflet.terminator'

import {
  bandResolutionForZoom,
  computeTwilightNightRings,
  stripPoleClosingPoints,
  subsampleCurve,
} from '../core/solarAltitudeCurve.js'

import './solarTerminatorOverlay.css'

const R2D = 180 / Math.PI

/** Glow/terminator seam span (double world). */
const GLOW_LONGITUDE_RANGE = 720
/** Band fills use a single world — avoids SVG clip + broken fill on 720° paths. */
const BAND_LONGITUDE_RANGE = 360
const BAND_WORLD_SHIFT = 360

const BAND_FILL_COLOR = 'rgb(12, 28, 74)'
const BAND_FILL_OPACITY = 0.20

function clamp01(n) {
  if (n <= 0) return 0
  if (n >= 1) return 1
  return n
}

function smoothstep01(t) {
  const x = clamp01(t)
  return x * x * (3 - 2 * x)
}

function ensurePane(map, name, zIndex) {
  let pane = map.getPane(name)

  if (!pane) {
    pane = map.createPane(name)
  }

  pane.style.zIndex = String(zIndex)
  pane.style.pointerEvents = 'none'

  return pane
}

function createPaneRenderer(pane, padding = 0.5) {
  return L.svg({ pane, padding })
}

function shiftLngs(latlngs, deltaLng) {
  if (!Array.isArray(latlngs) || deltaLng === 0) return latlngs

  return latlngs.map((p) => {
    const ll = L.latLng(p)
    return L.latLng(ll.lat, ll.lng + deltaLng)
  })
}

function resolutionForZoom(zoom, lowZoomRes, highZoomRes) {
  const z = Number.isFinite(zoom) ? zoom : 3
  const t = clamp01((z - 1) / 5)
  const eased = smoothstep01(t)
  return lowZoomRes + (highZoomRes - lowZoomRes) * eased
}

function getBoundaryLatLngs(terminatorPolygon) {
  const latlngs = terminatorPolygon.getLatLngs()

  if (Array.isArray(latlngs) && Array.isArray(latlngs[0])) {
    return latlngs[0]
  }

  return latlngs
}

function getTerminatorCurveLatLngs(terminatorPolygon) {
  const ring = getBoundaryLatLngs(terminatorPolygon)
  return stripPoleClosingPoints(ring)
}

function classifySolarZone(altDeg) {
  if (altDeg >= 0) return { id: 'day', name: 'Día' }
  if (altDeg >= -6) return { id: 'civil', name: 'Crepúsculo civil' }
  if (altDeg >= -12) return { id: 'nautical', name: 'Crepúsculo náutico' }
  if (altDeg >= -18) return { id: 'astronomical', name: 'Crepúsculo astronómico' }
  return { id: 'night', name: 'Noche astronómica' }
}

function formatSolarAltitudeLine(altDeg) {
  const abs = Math.abs(altDeg).toFixed(1)
  if (Math.abs(altDeg) < 0.05) return 'Sol en el horizonte (0°)'
  if (altDeg > 0) return `Sol ${abs}° sobre el horizonte`
  return `Sol ${abs}° bajo el horizonte`
}

function formatCoordinates(lat, lng) {
  const latHem = lat >= 0 ? 'N' : 'S'
  const lngHem = lng >= 0 ? 'E' : 'O'
  return `${Math.abs(lat).toFixed(4)}° ${latHem}, ${Math.abs(lng).toFixed(4)}° ${lngHem}`
}

function pointToSegmentDistance(px, py, ax, ay, bx, by) {
  const dx = bx - ax
  const dy = by - ay
  const lenSq = dx * dx + dy * dy

  if (lenSq < 1e-12) {
    return Math.hypot(px - ax, py - ay)
  }

  let t = ((px - ax) * dx + (py - ay) * dy) / lenSq
  t = clamp01(t)

  const cx = ax + t * dx
  const cy = ay + t * dy
  return Math.hypot(px - cx, py - cy)
}

function distanceToCurvePixels(map, latlng, curve) {
  if (!curve?.length) return Infinity

  const p = map.latLngToLayerPoint(latlng)
  let min = Infinity

  for (let i = 0; i < curve.length - 1; i += 1) {
    const a = map.latLngToLayerPoint(curve[i])
    const b = map.latLngToLayerPoint(curve[i + 1])
    min = Math.min(min, pointToSegmentDistance(p.x, p.y, a.x, a.y, b.x, b.y))
  }

  return min
}

function computeExploreBands(time, bandResolution) {
  const rings = computeTwilightNightRings(time, bandResolution, BAND_LONGITUDE_RANGE)

  const bands = rings.map((ring) => ring.map((p) => L.latLng(p.lat, p.lng)))

  return { bands }
}

export function createSolarTerminatorOverlay(map, options = {}) {
  const {
    updateIntervalMs = 30_000,
    mode = 'compact',
    lowZoomResolution = 12,
    highZoomResolution = 4,
    terminatorHitPx = 14,
  } = options

  const isExplore = mode === 'explore'

  ensurePane(map, 'solarNightPane', 410)
  ensurePane(map, 'solarGlowPane', 416)

  let currentTime = new Date()
  let currentResolution = resolutionForZoom(map.getZoom?.(), lowZoomResolution, highZoomResolution)
  let currentBandResolution = bandResolutionForZoom(map.getZoom?.(), lowZoomResolution, highZoomResolution)
  let terminatorCurveLatLngs = []
  let hitTestCurves = { center: [], west: [], east: [] }

  const nightRenderer = createPaneRenderer('solarNightPane', 0.65)
  const bandRenderer = createPaneRenderer('solarNightPane', 2.5)
  const glowRenderer = createPaneRenderer('solarGlowPane', 1.1)

  const terminatorComputer = terminator({
    time: currentTime,
    resolution: currentResolution,
    longitudeRange: GLOW_LONGITUDE_RANGE,
    interactive: false,
    stroke: false,
    smoothFactor: 0,
    fillOpacity: 0,
  })

  const makeNightPoly = () => L.polygon([], {
    pane: 'solarNightPane',
    renderer: nightRenderer,
    className: 'leaflet-solar-night',
    interactive: false,
    stroke: false,
    smoothFactor: 0,
    fill: true,
    fillColor: 'rgb(12, 28, 74)',
    fillOpacity: 0.34,
  })

  const makeBandPoly = () => L.polygon([], {
    pane: 'solarNightPane',
    renderer: bandRenderer,
    className: 'leaflet-solar-twilight-band',
    interactive: false,
    stroke: false,
    smoothFactor: 0,
    fill: true,
    fillColor: BAND_FILL_COLOR,
    fillOpacity: BAND_FILL_OPACITY,
  })

  const nightCenter = makeNightPoly()
  const nightWest = makeNightPoly()
  const nightEast = makeNightPoly()

  const twilightBandLayers = isExplore
    ? Array.from({ length: 4 }, () => ({
      center: makeBandPoly(),
      west: makeBandPoly(),
      east: makeBandPoly(),
    }))
    : []

  const boundary = getTerminatorCurveLatLngs(terminatorComputer)
  terminatorCurveLatLngs = boundary.map((p) => L.latLng(p))

  const glowOuterCenter = L.polyline(boundary, {
    pane: 'solarGlowPane',
    renderer: glowRenderer,
    className: 'leaflet-solar-glow-outer',
    interactive: false,
    color: 'rgba(255, 148, 30, 0.10)',
    weight: 12,
    opacity: 1,
    smoothFactor: 0,
    lineCap: 'round',
    lineJoin: 'round',
  })

  const glowMidCenter = L.polyline(boundary, {
    pane: 'solarGlowPane',
    renderer: glowRenderer,
    className: 'leaflet-solar-glow-mid',
    interactive: false,
    color: 'rgba(255, 158, 38, 0.22)',
    weight: 4.5,
    opacity: 1,
    smoothFactor: 0,
    lineCap: 'round',
    lineJoin: 'round',
  })

  const glowCoreCenter = L.polyline(boundary, {
    pane: 'solarGlowPane',
    renderer: glowRenderer,
    className: 'leaflet-solar-glow-core',
    interactive: false,
    color: 'rgba(255, 165, 45, 0.82)',
    weight: 1.5,
    opacity: 1,
    smoothFactor: 0,
    lineCap: 'round',
    lineJoin: 'round',
  })

  const glowOuterWest = L.polyline(shiftLngs(boundary, -GLOW_LONGITUDE_RANGE), { ...glowOuterCenter.options })
  const glowOuterEast = L.polyline(shiftLngs(boundary, GLOW_LONGITUDE_RANGE), { ...glowOuterCenter.options })
  const glowMidWest = L.polyline(shiftLngs(boundary, -GLOW_LONGITUDE_RANGE), { ...glowMidCenter.options })
  const glowMidEast = L.polyline(shiftLngs(boundary, GLOW_LONGITUDE_RANGE), { ...glowMidCenter.options })
  const glowCoreWest = L.polyline(shiftLngs(boundary, -GLOW_LONGITUDE_RANGE), { ...glowCoreCenter.options })
  const glowCoreEast = L.polyline(shiftLngs(boundary, GLOW_LONGITUDE_RANGE), { ...glowCoreCenter.options })

  if (!isExplore) {
    nightWest.addTo(map)
    nightCenter.addTo(map)
    nightEast.addTo(map)
  }

  if (isExplore) {
    for (const band of twilightBandLayers) {
      band.west.addTo(map)
      band.center.addTo(map)
      band.east.addTo(map)
    }
  }

  glowOuterWest.addTo(map)
  glowOuterCenter.addTo(map)
  glowOuterEast.addTo(map)
  glowMidWest.addTo(map)
  glowMidCenter.addTo(map)
  glowMidEast.addTo(map)
  glowCoreWest.addTo(map)
  glowCoreCenter.addTo(map)
  glowCoreEast.addTo(map)

  let zoneTooltip = null
  let tooltipVisible = false
  let tooltipRafId = null
  let pendingMoveEvent = null
  let lastTooltipKey = ''

  const tooltipTitleEl = document.createElement('strong')
  const tooltipAltEl = document.createElement('span')
  const tooltipCoordsEl = document.createElement('span')
  tooltipCoordsEl.className = 'leaflet-solar-zone-tooltip__coords'
  const tooltipInnerEl = document.createElement('div')
  tooltipInnerEl.className = 'leaflet-solar-zone-tooltip__inner'
  tooltipInnerEl.append(tooltipTitleEl, tooltipAltEl, tooltipCoordsEl)

  if (isExplore) {
    zoneTooltip = L.tooltip({
      sticky: true,
      // We own show/hide. Leaflet's default non-permanent tooltip closes itself
      // on map `preclick`, which desyncs our visibility flag after a location pick.
      permanent: true,
      direction: 'top',
      offset: [0, -12],
      opacity: 1,
      className: 'leaflet-solar-zone-tooltip',
    })
    zoneTooltip.setContent(tooltipInnerEl)
  }

  function updateHitTestCurves(curve) {
    const sampled = subsampleCurve(curve, 280)
    hitTestCurves = {
      center: sampled,
      west: shiftLngs(sampled, -GLOW_LONGITUDE_RANGE),
      east: shiftLngs(sampled, GLOW_LONGITUDE_RANGE),
    }
  }

  function setGlowCurves(curve) {
    terminatorCurveLatLngs = curve.map((p) => L.latLng(p))
    updateHitTestCurves(terminatorCurveLatLngs)

    glowOuterCenter.setLatLngs(curve)
    glowMidCenter.setLatLngs(curve)
    glowCoreCenter.setLatLngs(curve)

    glowOuterWest.setLatLngs(shiftLngs(curve, -GLOW_LONGITUDE_RANGE))
    glowMidWest.setLatLngs(shiftLngs(curve, -GLOW_LONGITUDE_RANGE))
    glowCoreWest.setLatLngs(shiftLngs(curve, -GLOW_LONGITUDE_RANGE))

    glowOuterEast.setLatLngs(shiftLngs(curve, GLOW_LONGITUDE_RANGE))
    glowMidEast.setLatLngs(shiftLngs(curve, GLOW_LONGITUDE_RANGE))
    glowCoreEast.setLatLngs(shiftLngs(curve, GLOW_LONGITUDE_RANGE))
  }

  function setCompactNight(ring) {
    const ringWest = shiftLngs(ring, -GLOW_LONGITUDE_RANGE)
    const ringEast = shiftLngs(ring, GLOW_LONGITUDE_RANGE)

    nightCenter.setLatLngs(ring)
    nightWest.setLatLngs(ringWest)
    nightEast.setLatLngs(ringEast)
  }

  function setExploreBands(bands) {
    for (let i = 0; i < twilightBandLayers.length; i += 1) {
      const ring = bands[i] ?? []

      const ringWest = ring.length ? shiftLngs(ring, -BAND_WORLD_SHIFT) : []
      const ringEast = ring.length ? shiftLngs(ring, BAND_WORLD_SHIFT) : []

      twilightBandLayers[i].center.setLatLngs(ring)
      twilightBandLayers[i].west.setLatLngs(ringWest)
      twilightBandLayers[i].east.setLatLngs(ringEast)
    }
  }

  function refreshGeometry() {
    terminatorComputer.options.resolution = currentResolution
    terminatorComputer.setTime(currentTime)

    const curve = getTerminatorCurveLatLngs(terminatorComputer)
    setGlowCurves(curve)

    if (isExplore) {
      const { bands } = computeExploreBands(currentTime, currentBandResolution)
      setExploreBands(bands)
    } else {
      const ring = getBoundaryLatLngs(terminatorComputer)
      setCompactNight(ring)
    }
  }

  function updateResolutionForCurrentZoom() {
    const zoom = map.getZoom?.()
    currentResolution = resolutionForZoom(zoom, lowZoomResolution, highZoomResolution)
    currentBandResolution = bandResolutionForZoom(zoom, lowZoomResolution, highZoomResolution)
  }

  function update(now = new Date()) {
    currentTime = now instanceof Date ? now : new Date(now)
    updateResolutionForCurrentZoom()
    refreshGeometry()
  }

  function nearestTerminatorDistance(latlng) {
    return Math.min(
      distanceToCurvePixels(map, latlng, hitTestCurves.center),
      distanceToCurvePixels(map, latlng, hitTestCurves.west),
      distanceToCurvePixels(map, latlng, hitTestCurves.east),
    )
  }

  function processMouseMove() {
    tooltipRafId = null
    const e = pendingMoveEvent
    if (!e || !zoneTooltip) return

    const { lat, lng: rawLng } = e.latlng
    const lng = ((rawLng + 540) % 360) - 180
    const pos = SunCalc.getPosition(currentTime, lat, lng)
    const altDeg = pos.altitude * R2D
    const onTerminator = nearestTerminatorDistance(e.latlng) <= terminatorHitPx

    let zoneName
    let altitudeLine

    if (onTerminator) {
      zoneName = 'Terminador solar'
      altitudeLine = 'Sol en el horizonte (0°)'
    } else {
      zoneName = classifySolarZone(altDeg).name
      altitudeLine = formatSolarAltitudeLine(altDeg)
    }

    const tooltipKey = `${zoneName}|${altitudeLine}|${lat.toFixed(2)}|${lng.toFixed(2)}`
    if (tooltipKey !== lastTooltipKey) {
      tooltipTitleEl.textContent = zoneName
      tooltipAltEl.textContent = altitudeLine
      tooltipCoordsEl.textContent = formatCoordinates(lat, lng)
      lastTooltipKey = tooltipKey
    }

    zoneTooltip.setLatLng(e.latlng)

    if (!map.hasLayer(zoneTooltip)) {
      zoneTooltip.addTo(map)
    }
    tooltipVisible = true
  }

  function onMouseMove(e) {
    if (!zoneTooltip) return
    pendingMoveEvent = e
    if (tooltipRafId == null) {
      tooltipRafId = requestAnimationFrame(processMouseMove)
    }
  }

  function onMouseOut() {
    pendingMoveEvent = null
    if (tooltipRafId != null) {
      cancelAnimationFrame(tooltipRafId)
      tooltipRafId = null
    }
    if (zoneTooltip && tooltipVisible) {
      map.removeLayer(zoneTooltip)
      tooltipVisible = false
      lastTooltipKey = ''
    }
  }

  const onZoomEnd = () => update()
  map.on('zoomend', onZoomEnd)
  update(currentTime)

  if (isExplore) {
    map.on('mousemove', onMouseMove)
    map.on('mouseout', onMouseOut)
  }

  const timer = setInterval(() => {
    update(new Date())
  }, updateIntervalMs)

  return {
    update,

    destroy() {
      clearInterval(timer)
      map.off('zoomend', onZoomEnd)

      if (isExplore) {
        map.off('mousemove', onMouseMove)
        map.off('mouseout', onMouseOut)
        if (tooltipRafId != null) {
          cancelAnimationFrame(tooltipRafId)
        }
        if (zoneTooltip && tooltipVisible) {
          map.removeLayer(zoneTooltip)
        }
      }

      try {
        map.removeLayer(glowCoreEast)
        map.removeLayer(glowCoreCenter)
        map.removeLayer(glowCoreWest)
        map.removeLayer(glowMidEast)
        map.removeLayer(glowMidCenter)
        map.removeLayer(glowMidWest)
        map.removeLayer(glowOuterEast)
        map.removeLayer(glowOuterCenter)
        map.removeLayer(glowOuterWest)

        if (!isExplore) {
          map.removeLayer(nightEast)
          map.removeLayer(nightCenter)
          map.removeLayer(nightWest)
        }

        if (isExplore) {
          for (const band of twilightBandLayers) {
            map.removeLayer(band.east)
            map.removeLayer(band.center)
            map.removeLayer(band.west)
          }
        }
      } catch {
        // noop
      }
    },
  }
}
