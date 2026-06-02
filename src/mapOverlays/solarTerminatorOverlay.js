import L from 'leaflet'
import SunCalc from 'suncalc'
import terminator from '@joergdietrich/leaflet.terminator'

import './solarTerminatorOverlay.css'

function clamp01(n) {
  if (n <= 0) return 0
  if (n >= 1) return 1
  return n
}

function smoothstep01(t) {
  const x = clamp01(t)
  return x * x * (3 - 2 * x)
}

function degToRad(deg) {
  return (deg * Math.PI) / 180
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

function mulberry32(seed) {
  return function rand() {
    let t = (seed += 0x6d2b79f5)
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function hashTileSeed(x, y, z) {
  let h = (x | 0) * 374761393
  h = (h + (y | 0) * 668265263) | 0
  h = (h + (z | 0) * 2147483629) | 0
  h = Math.imul(h ^ (h >>> 13), 1274126177)

  return (h ^ (h >>> 16)) >>> 0
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
  // Leaflet.Terminator polygon includes two extra points that close the shape to a pole.
  // For the visual glow we only want the actual terminator curve.
  if (Array.isArray(ring) && ring.length > 4) {
    return ring.slice(1, -1)
  }

  return ring
}

function nightFactorFromAltitude(altitudeRad) {
  const deepNight = degToRad(-12)
  const t = (0 - altitudeRad) / (0 - deepNight)

  return smoothstep01(t)
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

function resolutionForZoom(zoom, minRes, maxRes) {
  // More points per degree when zoomed out (small zoom).
  // Keep bounded to protect performance.
  // zoom ~ 1 -> high res, zoom ~ 5+ -> lower res.
  const z = Number.isFinite(zoom) ? zoom : 3
  const t = clamp01((5 - z) / 4) // z=1 -> 1, z=5 -> 0
  const eased = smoothstep01(t)
  const res = minRes + (maxRes - minRes) * eased
  return Math.round(res)
}

export function createSolarTerminatorOverlay(map, options = {}) {
  const {
    updateIntervalMs = 30_000,
    // Base options: resolution is now dynamic by default.
    minResolution = 10,
    maxResolution = 24,
    longitudeRange = 360,
  } = options

  ensurePane(map, 'solarNightPane', 410)
  ensurePane(map, 'solarTwilightPane', 412)
  ensurePane(map, 'solarLightsPane', 414)
  ensurePane(map, 'solarGlowPane', 416)

  let currentTime = new Date()
  let currentResolution = resolutionForZoom(map.getZoom?.(), minResolution, maxResolution)

  const nightRenderer = createPaneRenderer('solarNightPane', 0.65)
  const twilightRenderer = createPaneRenderer('solarTwilightPane', 0.85)
  const glowRenderer = createPaneRenderer('solarGlowPane', 1.1)

  // Use a single Terminator instance only to compute the geometry.
  const terminatorComputer = terminator({
    time: currentTime,
    resolution: currentResolution,
    longitudeRange,
    interactive: false,
    stroke: false,
    smoothFactor: 0,
    fillOpacity: 0,
  })

  const makePoly = (pane, renderer, className) => L.polygon([], {
    pane,
    renderer,
    className,
    interactive: false,
    stroke: false,
    smoothFactor: 0,
    fillOpacity: 1,
  })

  const nightCenter = makePoly('solarNightPane', nightRenderer, 'leaflet-solar-night')
  const nightWest = makePoly('solarNightPane', nightRenderer, 'leaflet-solar-night')
  const nightEast = makePoly('solarNightPane', nightRenderer, 'leaflet-solar-night')

  const twilightCenter = makePoly('solarTwilightPane', twilightRenderer, 'leaflet-solar-twilight')
  const twilightWest = makePoly('solarTwilightPane', twilightRenderer, 'leaflet-solar-twilight')
  const twilightEast = makePoly('solarTwilightPane', twilightRenderer, 'leaflet-solar-twilight')

  const warmCenter = makePoly('solarTwilightPane', twilightRenderer, 'leaflet-solar-twilight-warm')
  const warmWest = makePoly('solarTwilightPane', twilightRenderer, 'leaflet-solar-twilight-warm')
  const warmEast = makePoly('solarTwilightPane', twilightRenderer, 'leaflet-solar-twilight-warm')

  const boundary = getTerminatorCurveLatLngs(terminatorComputer)

  const glowOuterCenter = L.polyline(boundary, {
    pane: 'solarGlowPane',
    renderer: glowRenderer,
    className: 'leaflet-solar-glow-outer',
    interactive: false,
    color: 'rgba(110, 180, 255, 0.10)',
    weight: 7,
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
    color: 'rgba(120, 195, 255, 0.18)',
    weight: 4,
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
    color: 'rgba(165, 220, 255, 0.85)',
    weight: 1.6,
    opacity: 1,
    smoothFactor: 0,
    lineCap: 'round',
    lineJoin: 'round',
  })

  const glowOuterWest = L.polyline(shiftLngs(boundary, -360), { ...glowOuterCenter.options })
  const glowOuterEast = L.polyline(shiftLngs(boundary, 360), { ...glowOuterCenter.options })
  const glowMidWest = L.polyline(shiftLngs(boundary, -360), { ...glowMidCenter.options })
  const glowMidEast = L.polyline(shiftLngs(boundary, 360), { ...glowMidCenter.options })
  const glowCoreWest = L.polyline(shiftLngs(boundary, -360), { ...glowCoreCenter.options })
  const glowCoreEast = L.polyline(shiftLngs(boundary, 360), { ...glowCoreCenter.options })

  nightWest.addTo(map)
  nightCenter.addTo(map)
  nightEast.addTo(map)

  twilightWest.addTo(map)
  twilightCenter.addTo(map)
  twilightEast.addTo(map)

  warmWest.addTo(map)
  warmCenter.addTo(map)
  warmEast.addTo(map)

  glowOuterWest.addTo(map)
  glowOuterCenter.addTo(map)
  glowOuterEast.addTo(map)

  glowMidWest.addTo(map)
  glowMidCenter.addTo(map)
  glowMidEast.addTo(map)

  glowCoreWest.addTo(map)
  glowCoreCenter.addTo(map)
  glowCoreEast.addTo(map)

  function updateResolutionForCurrentZoom() {
    const next = resolutionForZoom(map.getZoom?.(), minResolution, maxResolution)
    if (next === currentResolution) return
    currentResolution = next

    terminatorComputer.options.resolution = currentResolution
    terminatorComputer.setTime(currentTime)

    const ring = getBoundaryLatLngs(terminatorComputer)
    const ringWest = shiftLngs(ring, -360)
    const ringEast = shiftLngs(ring, 360)

    nightCenter.setLatLngs(ring)
    nightWest.setLatLngs(ringWest)
    nightEast.setLatLngs(ringEast)

    twilightCenter.setLatLngs(ring)
    twilightWest.setLatLngs(ringWest)
    twilightEast.setLatLngs(ringEast)

    warmCenter.setLatLngs(ring)
    warmWest.setLatLngs(ringWest)
    warmEast.setLatLngs(ringEast)

    const curve = getTerminatorCurveLatLngs(terminatorComputer)
    glowOuterCenter.setLatLngs(curve)
    glowMidCenter.setLatLngs(curve)
    glowCoreCenter.setLatLngs(curve)

    glowOuterWest.setLatLngs(shiftLngs(curve, -360))
    glowMidWest.setLatLngs(shiftLngs(curve, -360))
    glowCoreWest.setLatLngs(shiftLngs(curve, -360))

    glowOuterEast.setLatLngs(shiftLngs(curve, 360))
    glowMidEast.setLatLngs(shiftLngs(curve, 360))
    glowCoreEast.setLatLngs(shiftLngs(curve, 360))
  }

  map.on('zoomend', updateResolutionForCurrentZoom)

  function update(now = new Date()) {
    currentTime = now

    updateResolutionForCurrentZoom()

    // Normal update (time tick) even if resolution did not change.
    terminatorComputer.setTime(currentTime)

    const ring = getBoundaryLatLngs(terminatorComputer)
    const ringWest = shiftLngs(ring, -360)
    const ringEast = shiftLngs(ring, 360)

    nightCenter.setLatLngs(ring)
    nightWest.setLatLngs(ringWest)
    nightEast.setLatLngs(ringEast)

    twilightCenter.setLatLngs(ring)
    twilightWest.setLatLngs(ringWest)
    twilightEast.setLatLngs(ringEast)

    warmCenter.setLatLngs(ring)
    warmWest.setLatLngs(ringWest)
    warmEast.setLatLngs(ringEast)

    const curve = getTerminatorCurveLatLngs(terminatorComputer)
    glowOuterCenter.setLatLngs(curve)
    glowMidCenter.setLatLngs(curve)
    glowCoreCenter.setLatLngs(curve)

    glowOuterWest.setLatLngs(shiftLngs(curve, -360))
    glowMidWest.setLatLngs(shiftLngs(curve, -360))
    glowCoreWest.setLatLngs(shiftLngs(curve, -360))

    glowOuterEast.setLatLngs(shiftLngs(curve, 360))
    glowMidEast.setLatLngs(shiftLngs(curve, 360))
    glowCoreEast.setLatLngs(shiftLngs(curve, 360))
  }

  update(currentTime)

  const timer = setInterval(() => {
    update(new Date())
  }, updateIntervalMs)

  return {
    update,

    destroy() {
      clearInterval(timer)

      map.off('zoomend', updateResolutionForCurrentZoom)

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

        map.removeLayer(warmEast)
        map.removeLayer(warmCenter)
        map.removeLayer(warmWest)

        map.removeLayer(twilightEast)
        map.removeLayer(twilightCenter)
        map.removeLayer(twilightWest)

        map.removeLayer(nightEast)
        map.removeLayer(nightCenter)
        map.removeLayer(nightWest)
      } catch {
        // noop
      }
    },
  }
}