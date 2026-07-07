import { useLayoutEffect, useMemo, useRef } from 'react'

import {
  buildMoonPhasePath,
  isNewMoonPhase,
  normalizeMoonPhase,
} from '../core/moonPhasePath.js'

function pad2(n) {
  const nn = Math.floor(Number(n) || 0)
  return nn.toString().padStart(2, '0')
}

function clamp24(h) {
  const v = Number(h)
  if (!Number.isFinite(v)) return 0
  return ((v % 24) + 24) % 24
}

function computeAngleDeg(hour, direction) {
  // Copiado del comportamiento de `GeoClock.jsx`.
  // Coordenadas SVG: 0° → derecha, 90° → abajo, 180° → izquierda, -90°(270°) → arriba.
  // Queremos que:
  // - Hemisferio sur: 6 → derecha, 12 → arriba, 18 → izquierda, 0 → abajo
  // - Hemisferio norte: 6 → izquierda, 12 → arriba, 18 → derecha, 0 → abajo
  const h = clamp24(hour)
  if (direction === 1) return -15 * (h - 6) // Sur
  return -15 * (18 - h) // Norte
}

const SVG_NS = 'http://www.w3.org/2000/svg'

// Referencia fija: docs/00.svg (viewBox 40×26, Space Grotesk bold + borde blanco).
const MINUTES_FONT_FAMILY = "'Space Grotesk', sans-serif"
const MINUTES_FONT_WEIGHT = '700'
const MINUTES_FILL = '#363E46'
const MINUTES_STROKE = '#FFFFFF'
const MINUTES_FONT_SIZE = 30
const MINUTES_STROKE_WIDTH = 2
// Centro local de la parte circular de la gota. La punta no participa en el anclaje.
const DROP_CIRCLE_CENTER_X = 432.5
const DROP_CIRCLE_CENTER_Y = 346.5

const MOON_CENTER_X = 430.725
const MOON_CENTER_Y = 515.623
const MOON_RADIUS = 34.724

const MINUTES_STYLE = {
  fill: MINUTES_FILL,
  fontSize: MINUTES_FONT_SIZE,
  fontFamily: MINUTES_FONT_FAMILY,
  fontWeight: MINUTES_FONT_WEIGHT,
  stroke: MINUTES_STROKE,
  strokeWidth: MINUTES_STROKE_WIDTH,
}

function snapHalfPx(v) {
  const n = Number(v)
  if (!Number.isFinite(n)) return 0
  return Math.round(n * 2) / 2
}

function buildHorizontalFlip(cx, cy) {
  const rcx = snapHalfPx(cx)
  const rcy = snapHalfPx(cy)
  return `translate(${rcx} ${rcy}) scale(-1 1) translate(${-rcx} ${-rcy})`
}

function applyComposedTransform(el, baseTransform, extraTransform) {
  if (!el) return
  const merged = [baseTransform, extraTransform].filter(Boolean).join(' ').trim()
  if (merged) el.setAttribute('transform', merged)
  else el.removeAttribute('transform')
}

// 12 y 0 están en el eje vertical: no se mueven al cambiar hemisferio.
const NUMEROS_SKIP_MIRROR_IDS = new Set(['12_2', '0'])

function buildHorizontalMirrorTranslate(cx, gx) {
  const dx = 2 * cx - 2 * gx
  if (Math.abs(dx) < 0.01) return ''
  return `translate(${snapHalfPx(dx)} 0)`
}

function applyNumerosColoresHemisphere(numerosColores, rcx, isNorth, baseTransformsRef) {
  if (!numerosColores) return

  if (baseTransformsRef.current.numerosColoresItems === null) {
    baseTransformsRef.current.numerosColoresItems = Array.from(
      numerosColores.querySelectorAll(':scope > g')
    ).map((el) => {
      let gx = rcx
      if (el.getBBox) {
        try {
          const bb = el.getBBox()
          gx = bb.x + bb.width / 2
        } catch {
          // fallback al centro del dial
        }
      }
      return {
        el,
        id: el.id,
        base: el.getAttribute('transform') ?? '',
        gx,
      }
    })
  }

  baseTransformsRef.current.numerosColoresItems.forEach(({ el, id, base, gx }) => {
    const shouldMirror = isNorth && !NUMEROS_SKIP_MIRROR_IDS.has(id)
    const mirrorTranslate = shouldMirror ? buildHorizontalMirrorTranslate(rcx, gx) : ''
    applyComposedTransform(el, base, mirrorTranslate)
  })
}

function applyMinutesTextStyle(minutesText) {
  minutesText.removeAttribute('dx')
  minutesText.removeAttribute('dy')
  minutesText.removeAttribute('textLength')
  minutesText.removeAttribute('lengthAdjust')
  minutesText.removeAttribute('letter-spacing')
  minutesText.removeAttribute('alignment-baseline')
  minutesText.removeAttribute('style')

  minutesText.setAttribute('font-family', MINUTES_STYLE.fontFamily)
  minutesText.setAttribute('font-size', String(MINUTES_STYLE.fontSize))
  minutesText.setAttribute('font-weight', MINUTES_STYLE.fontWeight)
  minutesText.setAttribute('fill', MINUTES_STYLE.fill)
  minutesText.setAttribute('stroke', MINUTES_STYLE.stroke)
  minutesText.setAttribute('stroke-width', String(MINUTES_STYLE.strokeWidth))
  minutesText.setAttribute('paint-order', 'stroke fill')
  minutesText.setAttribute('stroke-linejoin', 'round')
  minutesText.setAttribute('stroke-linecap', 'round')
  minutesText.setAttribute('letter-spacing', '0')
  minutesText.setAttribute('alignment-baseline', 'central')
  minutesText.setAttribute('dominant-baseline', 'central')
  minutesText.setAttribute('text-anchor', 'middle')
  minutesText.setAttribute('style', 'line-height: 1; font-kerning: none;')
  minutesText.setAttribute('opacity', '1')
}

function deriveMinutesAnchor() {
  return {
    x: DROP_CIRCLE_CENTER_X,
    y: DROP_CIRCLE_CENTER_Y,
  }
}

function deriveValidMoonPhase(snapshot) {
  return normalizeMoonPhase(snapshot?.raw?.lunarData?.phase)
}

function applyDynamicMoonPhase(dialRotor, moonPhase, hemisphere) {
  const faseLunar = dialRotor?.querySelector('#fase-lunar')
  if (!faseLunar) return

  // Remove existing content except our new moon-container
  Array.from(faseLunar.children).forEach(child => {
    if (child.id !== 'moon-container') {
      child.remove()
    }
  })

  let moonContainer = faseLunar.querySelector('#moon-container')
  if (!moonContainer) {
    moonContainer = document.createElementNS(SVG_NS, 'g')
    moonContainer.setAttribute('id', 'moon-container')
    faseLunar.appendChild(moonContainer)

    const defs = document.createElementNS(SVG_NS, 'defs')
    
    // Dark background gradient
    const darkGrad = document.createElementNS(SVG_NS, 'linearGradient')
    darkGrad.setAttribute('id', 'moon-dark-grad')
    darkGrad.setAttribute('x1', '0')
    darkGrad.setAttribute('y1', '0')
    darkGrad.setAttribute('x2', '1')
    darkGrad.setAttribute('y2', '1')
    darkGrad.innerHTML = `
      <stop offset="0%" stop-color="oklch(0.22 0.04 260)" />
      <stop offset="100%" stop-color="oklch(0.10 0.02 260)" />
    `
    defs.appendChild(darkGrad)

    // Light phase gradient
    const lightGrad = document.createElementNS(SVG_NS, 'linearGradient')
    lightGrad.setAttribute('id', 'moon-light-grad')
    lightGrad.setAttribute('x1', '0')
    lightGrad.setAttribute('y1', '0')
    lightGrad.setAttribute('x2', '1')
    lightGrad.setAttribute('y2', '1')
    lightGrad.innerHTML = `
      <stop offset="0%" stop-color="oklch(0.95 0.02 250)" />
      <stop offset="100%" stop-color="oklch(0.75 0.04 250)" />
    `
    defs.appendChild(lightGrad)

    // Dark blue ring gradient (matches yin-yang indicador)
    const ringGrad = document.createElementNS(SVG_NS, 'linearGradient')
    ringGrad.setAttribute('id', 'moon-ring-grad')
    ringGrad.setAttribute('x1', '0')
    ringGrad.setAttribute('y1', '0')
    ringGrad.setAttribute('x2', '0')
    ringGrad.setAttribute('y2', '1')
    ringGrad.innerHTML = `
      <stop offset="0%" stop-color="#2A3247" />
      <stop offset="100%" stop-color="#1E2638" />
    `
    defs.appendChild(ringGrad)

    moonContainer.appendChild(defs)

    // Dark base
    const darkBase = document.createElementNS(SVG_NS, 'circle')
    darkBase.setAttribute('cx', String(MOON_CENTER_X))
    darkBase.setAttribute('cy', String(MOON_CENTER_Y))
    darkBase.setAttribute('r', String(MOON_RADIUS))
    darkBase.setAttribute('fill', 'url(#moon-dark-grad)')
    moonContainer.appendChild(darkBase)

    // Light phase
    const lightPhase = document.createElementNS(SVG_NS, 'path')
    lightPhase.setAttribute('data-role', 'dynamic-moon-phase-light')
    lightPhase.setAttribute('fill', 'url(#moon-light-grad)')
    lightPhase.setAttribute('stroke', 'none')
    moonContainer.appendChild(lightPhase)

    // Blue outline
    const sharpRing = document.createElementNS(SVG_NS, 'circle')
    sharpRing.setAttribute('cx', String(MOON_CENTER_X))
    sharpRing.setAttribute('cy', String(MOON_CENTER_Y))
    sharpRing.setAttribute('r', String(MOON_RADIUS))
    sharpRing.setAttribute('fill', 'none')
    sharpRing.setAttribute('stroke', 'url(#moon-ring-grad)')
    sharpRing.setAttribute('stroke-width', '2.5')
    moonContainer.appendChild(sharpRing)
  }

  moonContainer.removeAttribute('style')

  const phase = normalizeMoonPhase(moonPhase)
  const moonLight = moonContainer.querySelector('[data-role="dynamic-moon-phase-light"]')
  
  if (isNewMoonPhase(phase)) {
    moonLight.setAttribute('opacity', '0')
  } else {
    moonLight.setAttribute('opacity', '1')
    moonLight.setAttribute('d', buildMoonPhasePath(phase, {
      cx: MOON_CENTER_X,
      cy: MOON_CENTER_Y,
      r: MOON_RADIUS,
      hemisphere,
    }))
  }
}

function createGeometryRef() {
  return {
    dialCx: null,
    dialCy: null,
    horasExteriorCx: null,
    horasExteriorCy: null,
    minutesX: null,
    minutesY: null,
  }
}

function createBaseTransformsRef() {
  return {
    dialRotor: null,
    horasExterior: null,
    numerosColoresItems: null,
    yinYangDiskPaths: null,
    hourRingColors: null,
  }
}

function parseColor(color) {
  if (!color) return null

  const hex = color.trim()
  if (/^#[0-9a-f]{6}$/i.test(hex)) {
    const value = Number.parseInt(hex.slice(1), 16)
    return {
      r: (value >> 16) & 255,
      g: (value >> 8) & 255,
      b: value & 255,
    }
  }

  const rgb = hex.match(/^rgb\(\s*(\d+),\s*(\d+),\s*(\d+)\s*\)$/i)
  if (rgb) {
    return {
      r: Number(rgb[1]),
      g: Number(rgb[2]),
      b: Number(rgb[3]),
    }
  }

  return null
}

function toRgbString({ r, g, b }) {
  return `rgb(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)})`
}

function mixRgb(a, b, t) {
  return {
    r: a.r + (b.r - a.r) * t,
    g: a.g + (b.g - a.g) * t,
    b: a.b + (b.b - a.b) * t,
  }
}

function readHourRingColors(horasExterior) {
  if (!horasExterior) return []
  return Array.from(horasExterior.querySelectorAll(':scope > path'))
    .map((path) => parseColor(path.getAttribute('fill')))
    .filter(Boolean)
}

function sampleSvgHourRingColor(colors, geometricHour) {
  if (!colors.length) return null

  // El SVG arranca arriba en 12 y avanza hacia la derecha con horas descendentes.
  const rawIndex = (12 - clamp24(geometricHour) + 24) % 24
  const segmentCount = colors.length
  const scaledIndex = rawIndex * (segmentCount / 24)
  const index = Math.floor(scaledIndex) % segmentCount
  const nextIndex = (index + 1) % segmentCount
  const t = scaledIndex - Math.floor(scaledIndex)

  return mixRgb(colors[index], colors[nextIndex], t)
}

function applyDynamicYinYangColor(svg, yinYang, horasExterior, activeGeo, baseTransformsRef) {
  const target = yinYang?.querySelector('#Vector_53_2, #vector_53, #Vector_53')
  if (!target) return

  if (baseTransformsRef.current.hourRingColors === null) {
    baseTransformsRef.current.hourRingColors = readHourRingColors(horasExterior)
  }

  const baseColor = sampleSvgHourRingColor(baseTransformsRef.current.hourRingColors, activeGeo.gh)
  if (!baseColor) return

  const fill = target.getAttribute('fill') ?? ''
  const gradientId = fill.match(/^url\(#(.+)\)$/)?.[1]
  const gradient = gradientId ? svg.querySelector(`#${gradientId}`) : null
  const stops = gradient ? Array.from(gradient.querySelectorAll('stop')) : []

  if (stops.length >= 2) {
    const deeper = mixRgb(baseColor, { r: 20, g: 24, b: 34 }, 0.08)
    const brighter = mixRgb(baseColor, { r: 255, g: 255, b: 255 }, 0.36)

    stops[0].setAttribute('stop-color', toRgbString(deeper))
    stops[stops.length - 1].setAttribute('stop-color', toRgbString(brighter))
    return
  }

  target.setAttribute('fill', toRgbString(baseColor))
}

function deriveValidGeo(snapshot) {
  const geometricHour = snapshot?.raw?.geometricHour
  if (typeof geometricHour !== 'number' || !Number.isFinite(geometricHour)) {
    return null
  }

  const gh = clamp24(geometricHour)
  const geoHms = snapshot?.raw?.geoHms ?? null
  const rawMinutes = geoHms && typeof geoHms.m === 'number'
    ? geoHms.m
    : Math.floor((gh - Math.floor(gh)) * 60)
  const minutes = Number.isFinite(rawMinutes) ? rawMinutes : 0

  return {
    gh,
    minutes: Math.floor(minutes),
  }
}

export function useAnimatedFigmaClock({ rootRef, snapshot, hemisphere = 'south', readyKey = 'default' }) {
  const geomRef = useRef(createGeometryRef())
  const baseTransformsRef = useRef(createBaseTransformsRef())
  const readyKeyRef = useRef(readyKey)
  const lastGeoRef = useRef(null)

  const geo = useMemo(() => deriveValidGeo(snapshot), [snapshot])
  const moonPhase = useMemo(() => deriveValidMoonPhase(snapshot), [snapshot])

  useLayoutEffect(() => {
    if (readyKeyRef.current !== readyKey) {
      readyKeyRef.current = readyKey
      geomRef.current = createGeometryRef()
      baseTransformsRef.current = createBaseTransformsRef()
      lastGeoRef.current = null
    }

    let cancelled = false

    const run = async () => {
      const activeGeo = geo ?? lastGeoRef.current
      if (!activeGeo) return
      if (geo) lastGeoRef.current = geo

      // Esperar fuentes reales antes de mostrar: en Chrome la calibración dinámica
      // medía con el fallback del sistema y dejaba el texto más pequeño.
      const needsFontCalibration = geomRef.current.minutesX == null || geomRef.current.minutesY == null
      if (needsFontCalibration && document.fonts?.status !== 'loaded') {
        await document.fonts.ready
        if (cancelled) return
      }

      const wrap = rootRef.current
      if (!wrap) return

      const svg = wrap.querySelector('svg')
      if (!svg) return

      const direction = hemisphere === 'north' ? -1 : 1
      const pointerAngleDeg = computeAngleDeg(activeGeo.gh, direction)
      const yinyangRotationDeg = pointerAngleDeg + 90

      const dialRotor = svg.querySelector('#dial-rotor')
      const yinYang = svg.querySelector('#yin-yang')
      const indicator = dialRotor?.querySelector('#indicador')
      const legacyMinutes = dialRotor?.querySelector('[id="00"]') ?? svg.querySelector('[id="00"]')

      if (legacyMinutes) {
        legacyMinutes.setAttribute('opacity', '0')
        legacyMinutes.setAttribute('pointer-events', 'none')
      }

      if (geomRef.current.dialCx == null || geomRef.current.dialCy == null) {
        const geomSource = yinYang ?? dialRotor
        if (geomSource?.getBBox) {
          try {
            const bb = geomSource.getBBox()
            geomRef.current.dialCx = bb.x + bb.width / 2
            geomRef.current.dialCy = bb.y + bb.height / 2
          } catch {
            // fallback
          }
        }

        if (geomRef.current.dialCx == null || geomRef.current.dialCy == null) {
          geomRef.current.dialCx = 431.623
          geomRef.current.dialCy = 429.622
        }
      }

      if (geomRef.current.minutesX == null || geomRef.current.minutesY == null) {
        const anchor = deriveMinutesAnchor()
        geomRef.current.minutesX = anchor.x
        geomRef.current.minutesY = anchor.y
      }

      const horasExterior = svg.querySelector('#horas-exterior')
      const numerosColores = svg.querySelector('#numeros-colores')

      applyDynamicYinYangColor(svg, yinYang, horasExterior, activeGeo, baseTransformsRef)
      applyDynamicMoonPhase(dialRotor, moonPhase, hemisphere)

      if (geomRef.current.horasExteriorCx == null || geomRef.current.horasExteriorCy == null) {
        if (horasExterior?.getBBox) {
          try {
            const bb = horasExterior.getBBox()
            geomRef.current.horasExteriorCx = bb.x + bb.width / 2
            geomRef.current.horasExteriorCy = bb.y + bb.height / 2
          } catch {
            // fallback
          }
        }

        if (geomRef.current.horasExteriorCx == null || geomRef.current.horasExteriorCy == null) {
          geomRef.current.horasExteriorCx = 432.374
          geomRef.current.horasExteriorCy = 430.474
        }
      }

      const rcx = snapHalfPx(geomRef.current.dialCx)
      const rcy = snapHalfPx(geomRef.current.dialCy)
      const horasRcx = snapHalfPx(geomRef.current.horasExteriorCx)
      const isNorth = hemisphere === 'north'
      const horasFlip = isNorth ? buildHorizontalFlip(horasRcx, geomRef.current.horasExteriorCy) : ''
      const dialFlip = isNorth ? buildHorizontalFlip(rcx, rcy) : ''

      if (baseTransformsRef.current.horasExterior === null && horasExterior) {
        baseTransformsRef.current.horasExterior = horasExterior.getAttribute('transform') ?? ''
      }

      // Solo voltean los segmentos de color; el filtro de sombra vive en #anillo-horas.
      applyComposedTransform(
        horasExterior,
        baseTransformsRef.current.horasExterior,
        horasFlip
      )

      // Los números se trasladan al lado opuesto (sin scale) para que no queden invertidos.
      applyNumerosColoresHemisphere(numerosColores, horasRcx, isNorth, baseTransformsRef)

      if (yinYang && baseTransformsRef.current.yinYangDiskPaths === null) {
        baseTransformsRef.current.yinYangDiskPaths = Array.from(
          yinYang.querySelectorAll(':scope > path')
        ).map((path) => ({
          el: path,
          base: path.getAttribute('transform') ?? '',
        }))
      }

      // Volteo del disco yin-yang (paths directos), sin tocar indicador/minutero/luna.
      baseTransformsRef.current.yinYangDiskPaths?.forEach(({ el, base }) => {
        applyComposedTransform(el, base, dialFlip)
      })

      if (baseTransformsRef.current.dialRotor === null && dialRotor) {
        baseTransformsRef.current.dialRotor = dialRotor.getAttribute('transform') ?? ''
      }

      const dynamicRotation = `rotate(${yinyangRotationDeg} ${rcx} ${rcy})`

      if (dialRotor) {
        dialRotor.setAttribute('transform', `${baseTransformsRef.current.dialRotor} ${dynamicRotation}`.trim())
      }

      let minutesText = svg.querySelector('[data-role="geo-minutes-text"]')
      const minutesX = snapHalfPx(geomRef.current.minutesX)
      const minutesY = snapHalfPx(geomRef.current.minutesY)

      if (!minutesText) {
        minutesText = document.createElementNS(SVG_NS, 'text')
        minutesText.setAttribute('data-role', 'geo-minutes-text')
        minutesText.setAttribute('text-anchor', 'middle')
        minutesText.setAttribute('dominant-baseline', 'central')
        minutesText.setAttribute('text-rendering', 'geometricPrecision')
        minutesText.setAttribute('font-variant-numeric', 'tabular-nums')
        indicator?.appendChild(minutesText)
      } else if (indicator) {
        indicator.appendChild(minutesText)
      }

      minutesText.setAttribute('x', String(minutesX))
      minutesText.setAttribute('y', String(minutesY))
      applyMinutesTextStyle(minutesText)
      minutesText.textContent = pad2(activeGeo.minutes)
      minutesText.setAttribute('transform', `rotate(${-yinyangRotationDeg} ${minutesX} ${minutesY})`)

      wrap.setAttribute('data-ready', '1')
    }

    run()

    return () => {
      cancelled = true
    }
  }, [geo, hemisphere, moonPhase, readyKey, rootRef])
}
