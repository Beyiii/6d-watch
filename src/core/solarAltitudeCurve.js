/**
 * Solar altitude isolines for map overlays.
 * Generalizes the astronomy pipeline from leaflet.terminator to arbitrary
 * solar altitudes (0°, -6°, -12°, -18°).
 */

const D2R = Math.PI / 180
const R2D = 180 / Math.PI

const TWILIGHT_ALTITUDES = [0, -6, -12, -18]

function julian(date) {
  return date / 86400000 + 2440587.5
}

function GMST(julianDay) {
  const d = julianDay - 2451545.0
  return (18.697374558 + 24.06570982441908 * d) % 24
}

function sunEclipticPosition(julianDay) {
  const n = julianDay - 2451545.0
  let L = (280.460 + 0.9856474 * n) % 360
  let g = (357.528 + 0.9856003 * n) % 360
  const lambda = L + 1.915 * Math.sin(g * D2R) + 0.02 * Math.sin(2 * g * D2R)
  const R = 1.00014 - 0.01671 * Math.cos(g * D2R) - 0.0014 * Math.cos(2 * g * D2R)
  return { lambda, R }
}

function eclipticObliquity(julianDay) {
  const n = julianDay - 2451545.0
  const T = n / 36525
  return (
    23.43929111
    - T
      * (46.836769 / 3600
        - T
          * (0.0001831 / 3600
            + T
              * (0.0020034 / 3600
                - T * (0.576e-6 / 3600 - (T * 4.34e-8) / 3600))))
  )
}

function sunEquatorialPosition(sunEclLng, eclObliq) {
  let alpha =
    Math.atan(Math.cos(eclObliq * D2R) * Math.tan(sunEclLng * D2R)) * R2D
  const delta =
    Math.asin(Math.sin(eclObliq * D2R) * Math.sin(sunEclLng * D2R)) * R2D

  const lQuadrant = Math.floor(sunEclLng / 90) * 90
  const raQuadrant = Math.floor(alpha / 90) * 90
  alpha += lQuadrant - raQuadrant

  return { alpha, delta }
}

function hourAngle(lng, sunPos, gst) {
  const lst = gst + lng / 15
  return lst * 15 - sunPos.alpha
}

/** Visible map edge in Web Mercator (Leaflet clips ~±85.05). */
export const MAP_MAX_LAT = 85

function clampMapLat(lat) {
  if (!Number.isFinite(lat)) return lat
  return Math.max(-MAP_MAX_LAT, Math.min(MAP_MAX_LAT, lat))
}

function darkPoleLatitude(decDeg) {
  return decDeg >= 0 ? -MAP_MAX_LAT : MAP_MAX_LAT
}

/** Solar altitude at the geographic night pole equals −|declination|. */
function darkPoleInsideCap(decDeg, altitudeDeg) {
  return -Math.abs(decDeg) < altitudeDeg
}

/** Same formula as leaflet.terminator — altitude exactly 0°. */
export function terminatorLatitude(haDeg, decDeg) {
  const decRad = decDeg * D2R
  if (Math.abs(decRad) < 1e-10) return 0

  return Math.atan(-Math.cos(haDeg * D2R) / Math.tan(decRad)) * R2D
}

function wrap180(deg) {
  return ((((deg + 180) % 360) + 360) % 360) - 180
}

function latitudesForAltitude(haDeg, decDeg, altitudeDeg) {
  const ha = haDeg * D2R
  const dec = decDeg * D2R
  const alt = altitudeDeg * D2R

  const a = Math.sin(dec)
  const b = Math.cos(dec) * Math.cos(ha)
  const c = Math.sin(alt)
  const R = Math.hypot(a, b)
  if (R < 1e-12) return []

  const ratio = c / R
  if (ratio < -1 || ratio > 1) return []

  const base = Math.atan2(a, b)
  const spread = Math.acos(ratio)
  const unique = []

  for (const raw of [base + spread, base - spread]) {
    const lat = wrap180(raw * R2D)
    if (!Number.isFinite(lat) || lat < -90 || lat > 90) continue
    if (unique.some((existing) => Math.abs(existing - lat) < 1e-6)) continue
    unique.push(lat)
  }

  return unique
}

/**
 * Latitude on the night side of `refLatDeg` where the Sun sits at `altitudeDeg`.
 * Ensures each twilight curve sits progressively closer to the dark pole.
 */
function latitudeForAltitudeOnNightSide(haDeg, decDeg, altitudeDeg, refLatDeg) {
  const candidates = latitudesForAltitude(haDeg, decDeg, altitudeDeg)
  const nightSouth = decDeg >= 0
  const towardNight = (lat) => (nightSouth ? lat < refLatDeg : lat > refLatDeg)
  const valid = candidates.filter(towardNight)

  if (valid.length === 0) return null

  return nightSouth
    ? valid.reduce((best, lat) => (lat > best ? lat : best))
    : valid.reduce((best, lat) => (lat < best ? lat : best))
}

function interpolateLngEdge(fromLng, toLng, lat, steps = 16) {
  const pts = []
  for (let i = 1; i < steps; i += 1) {
    const t = i / steps
    pts.push({ lat, lng: fromLng + (toLng - fromLng) * t })
  }
  return pts
}

function splitContiguousByLng(points, maxStep) {
  if (!points?.length) return []

  const segs = []
  let current = [points[0]]

  for (let i = 1; i < points.length; i += 1) {
    if (Math.abs(points[i].lng - current[current.length - 1].lng) > maxStep) {
      segs.push(current)
      current = []
    }
    current.push(points[i])
  }

  if (current.length) segs.push(current)
  return segs
}

/** Join a cap split across ±180 into one unwrapped chain. */
function mergeAntimeridianSegments(segs, rangeHalf) {
  if (segs.length !== 2) return segs

  const [west, east] = segs
  const westTouches = Math.abs(west[0].lng - (-rangeHalf)) <= 1
  const eastTouches = Math.abs(east[east.length - 1].lng - rangeHalf) <= 1

  if (!westTouches || !eastTouches) return segs

  const unwrappedEast = east.map((p) => ({ lat: p.lat, lng: p.lng - 2 * rangeHalf }))
  return [[...unwrappedEast, ...west]]
}

function buildCapRing(north, south, lngStep, rangeHalf) {
  const northSegs = mergeAntimeridianSegments(splitContiguousByLng(north, lngStep * 2.5), rangeHalf)
  const southSegs = mergeAntimeridianSegments(splitContiguousByLng(south, lngStep * 2.5), rangeHalf)

  if (!northSegs[0]?.length) return []

  const northChain = northSegs[0]
  const southChain = southSegs[0]?.length ? [...southSegs[0]].reverse() : []
  return [...northChain, ...southChain]
}

export function getSunEquatorialState(date) {
  const when = date instanceof Date ? date : new Date(date)
  const julianDay = julian(when)
  const gst = GMST(julianDay)
  const sunEclPos = sunEclipticPosition(julianDay)
  const eclObliq = eclipticObliquity(julianDay)
  const sunEqPos = sunEquatorialPosition(sunEclPos.lambda, eclObliq)

  return { sunEqPos, gst, sunDeclination: sunEqPos.delta }
}

/**
 * Compute twilight isolines independently so a missing inner altitude
 * never punches holes in the terminator (those holes became diagonal fills).
 * @returns {Array<Array<{ lat: number, lng: number }>>}
 */
export function computeTwilightCurves(date, resolution, longitudeRange) {
  const { sunEqPos, gst } = getSunEquatorialState(date)
  const steps = Math.round(longitudeRange * resolution)

  return TWILIGHT_ALTITUDES.map((altitudeDeg) => {
    if (darkPoleInsideCap(sunEqPos.delta, altitudeDeg) || altitudeDeg === 0) {
      return sampleWrappingIsoline(
        altitudeDeg,
        sunEqPos,
        gst,
        steps,
        resolution,
        longitudeRange,
      )
    }

    return sampleCapIsoline(
      altitudeDeg,
      sunEqPos,
      gst,
      steps,
      resolution,
      longitudeRange,
    ).north
  })
}

function sampleWrappingIsoline(altitudeDeg, sunEqPos, gst, steps, resolution, longitudeRange) {
  const edgeLat = darkPoleLatitude(sunEqPos.delta)
  const startLng = -longitudeRange / 2
  const points = []

  for (let i = 0; i <= steps; i += 1) {
    const lng = startLng + i / resolution
    const ha = hourAngle(lng, sunEqPos, gst)
    let lat

    if (altitudeDeg === 0) {
      lat = terminatorLatitude(ha, sunEqPos.delta)
    } else {
      const terminatorLat = terminatorLatitude(ha, sunEqPos.delta)
      const refLat = Number.isFinite(terminatorLat) ? terminatorLat : edgeLat
      lat = latitudeForAltitudeOnNightSide(ha, sunEqPos.delta, altitudeDeg, refLat)
    }

    if (!Number.isFinite(lat)) {
      lat = edgeLat
    } else {
      lat = clampMapLat(lat)
    }

    points.push({ lat, lng })
  }

  return points
}

function sampleCapIsoline(altitudeDeg, sunEqPos, gst, steps, resolution, longitudeRange) {
  const startLng = -longitudeRange / 2
  const north = []
  const south = []

  for (let i = 0; i <= steps; i += 1) {
    const lng = startLng + i / resolution
    const ha = hourAngle(lng, sunEqPos, gst)
    const lats = latitudesForAltitude(ha, sunEqPos.delta, altitudeDeg)
      .map(clampMapLat)
      .filter((lat) => Number.isFinite(lat))

    if (!lats.length) continue

    north.push({ lat: Math.max(...lats), lng })
    south.push({ lat: Math.min(...lats), lng })
  }

  return { north, south }
}

/**
 * Closed night-side polygons for nested twilight masks (0°, -6°, -12°, -18°).
 * Wrapping isolines close along the visible map edge; polar caps that do not
 * contain the geographic pole are drawn as closed ovals.
 */
export function computeTwilightNightRings(date, resolution, longitudeRange) {
  const { sunEqPos, gst } = getSunEquatorialState(date)
  const steps = Math.round(longitudeRange * resolution)
  const lngStep = 1 / resolution
  const rangeHalf = longitudeRange / 2

  return TWILIGHT_ALTITUDES.map((altitudeDeg) => {
    if (darkPoleInsideCap(sunEqPos.delta, altitudeDeg) || altitudeDeg === 0) {
      const curve = sampleWrappingIsoline(
        altitudeDeg,
        sunEqPos,
        gst,
        steps,
        resolution,
        longitudeRange,
      )
      return buildNightRingBelow(curve, sunEqPos.delta, longitudeRange)
    }

    const { north, south } = sampleCapIsoline(
      altitudeDeg,
      sunEqPos,
      gst,
      steps,
      resolution,
      longitudeRange,
    )
    return buildCapRing(north, south, lngStep, rangeHalf)
  })
}

/** Band polygon between two altitude curves (same longitude sampling). */
export function buildBandRing(outerCurve, innerCurve) {
  if (!outerCurve?.length || !innerCurve?.length) return []
  if (outerCurve.length !== innerCurve.length) return []

  const innerRev = [...innerCurve].reverse()
  return [...outerCurve, ...innerRev]
}

/**
 * Night region below `curve`, closed along the visible dark-pole edge.
 * Intermediate edge points prevent Leaflet from collapsing ±180 into a
 * single antimeridian vertex and drawing a diagonal.
 */
export function buildNightRingBelow(curve, sunDeclination, longitudeRange) {
  if (!curve?.length) return []

  const poleLat = darkPoleLatitude(sunDeclination)
  const startLng = -longitudeRange / 2
  const endLng = longitudeRange / 2
  const first = curve[0]
  const last = curve[curve.length - 1]

  return [
    { lat: poleLat, lng: startLng },
    { lat: first.lat, lng: startLng },
    ...curve,
    { lat: last.lat, lng: endLng },
    { lat: poleLat, lng: endLng },
    ...interpolateLngEdge(endLng, startLng, poleLat),
  ]
}

/** Strip pole-closing points from a terminator-style ring. */
export function stripPoleClosingPoints(ring) {
  if (!Array.isArray(ring) || ring.length <= 4) return ring
  return ring.slice(1, -1)
}

/** Downsample a curve for lightweight hit-testing. */
export function subsampleCurve(points, maxPoints = 240) {
  if (!points?.length || points.length <= maxPoints) return points ?? []

  const step = Math.ceil(points.length / maxPoints)
  const sampled = []

  for (let i = 0; i < points.length; i += step) {
    sampled.push(points[i])
  }

  const last = points[points.length - 1]
  if (sampled[sampled.length - 1] !== last) {
    sampled.push(last)
  }

  return sampled
}

/** Cap points-per-degree so SVG band fills stay valid and performant. */
export function bandResolutionForZoom(zoom, lowZoomRes, highZoomRes, maxPointsPerDegree = 1.5) {
  const raw = lowZoomRes + (highZoomRes - lowZoomRes) * smoothstep01(clamp01((zoom - 1) / 5))
  return Math.min(raw, maxPointsPerDegree)
}

function clamp01(n) {
  if (n <= 0) return 0
  if (n >= 1) return 1
  return n
}

function smoothstep01(t) {
  const x = clamp01(t)
  return x * x * (3 - 2 * x)
}
