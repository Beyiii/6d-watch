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

/** Same formula as leaflet.terminator — altitude exactly 0°. */
export function terminatorLatitude(haDeg, decDeg) {
  const decRad = decDeg * D2R
  if (Math.abs(decRad) < 1e-10) return 0

  return Math.atan(-Math.cos(haDeg * D2R) / Math.tan(decRad)) * R2D
}

/**
 * Latitude on the night side of `refLatDeg` where the Sun sits at `altitudeDeg`.
 * Ensures each twilight curve sits progressively closer to the dark pole.
 */
function latitudeForAltitudeOnNightSide(haDeg, decDeg, altitudeDeg, refLatDeg) {
  const ha = haDeg * D2R
  const dec = decDeg * D2R
  const alt = altitudeDeg * D2R

  const a = Math.sin(dec)
  const b = Math.cos(dec) * Math.cos(ha)
  const c = Math.sin(alt)
  const R = Math.hypot(a, b)
  if (R < 1e-12) return null

  const ratio = c / R
  if (ratio < -1 || ratio > 1) return null

  const base = Math.atan2(a, b)
  const spread = Math.acos(ratio)
  const candidates = [
    (base + spread) * R2D,
    (base - spread) * R2D,
  ]

  const nightSouth = decDeg >= 0
  const towardNight = (lat) => (nightSouth ? lat < refLatDeg : lat > refLatDeg)

  const valid = candidates.filter(
    (lat) => Number.isFinite(lat) && lat >= -85 && lat <= 85 && towardNight(lat),
  )

  if (valid.length === 0) return null

  // Pick the curve closest to the reference (outer edge of this band).
  if (nightSouth) {
    return valid.reduce((best, lat) => (lat > best ? lat : best))
  }
  return valid.reduce((best, lat) => (lat < best ? lat : best))
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
 * Compute twilight curves aligned to leaflet.terminator at 0°.
 * @returns {Array<Array<{ lat: number, lng: number }>>}
 */
export function computeTwilightCurves(date, resolution, longitudeRange) {
  const { sunEqPos, gst } = getSunEquatorialState(date)
  const steps = Math.round(longitudeRange * resolution)
  const curves = TWILIGHT_ALTITUDES.map(() => [])

  for (let i = 0; i <= steps; i += 1) {
    const lng = -longitudeRange / 2 + i / resolution
    const ha = hourAngle(lng, sunEqPos, gst)
    const lat0 = terminatorLatitude(ha, sunEqPos.delta)
    if (!Number.isFinite(lat0)) continue

    const row = [lat0]
    let valid = true

    for (let a = 1; a < TWILIGHT_ALTITUDES.length; a += 1) {
      const lat = latitudeForAltitudeOnNightSide(
        ha,
        sunEqPos.delta,
        TWILIGHT_ALTITUDES[a],
        row[a - 1],
      )
      if (lat == null) {
        valid = false
        break
      }
      row.push(lat)
    }

    if (!valid) continue

    row.forEach((lat, idx) => {
      curves[idx].push({ lat, lng })
    })
  }

  return curves
}

/** Band polygon between two altitude curves (same longitude sampling). */
export function buildBandRing(outerCurve, innerCurve) {
  if (!outerCurve?.length || !innerCurve?.length) return []
  if (outerCurve.length !== innerCurve.length) return []

  const innerRev = [...innerCurve].reverse()
  return [...outerCurve, ...innerRev]
}

/** Night region below `curve` closed toward the dark pole. */
export function buildNightRingBelow(curve, sunDeclination, longitudeRange) {
  if (!curve?.length) return []

  const poleLat = sunDeclination >= 0 ? -90 : 90
  const startLng = -longitudeRange / 2
  const endLng = longitudeRange / 2

  return [
    { lat: poleLat, lng: startLng },
    ...curve,
    { lat: poleLat, lng: endLng },
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
