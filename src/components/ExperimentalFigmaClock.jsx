import { useLayoutEffect, useMemo, useRef } from 'react'

import relojFigmaRaw from '../../docs/reloj-figma.svg?raw'

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
// Ajuste fino del minutero (unidades SVG). X negativo → izquierda; Y positivo → abajo.
const MINUTES_X_NUDGE = -4
const MINUTES_Y_NUDGE = -3

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
  minutesText.setAttribute('font-family', MINUTES_STYLE.fontFamily)
  minutesText.setAttribute('font-size', String(MINUTES_STYLE.fontSize))
  minutesText.setAttribute('font-weight', MINUTES_STYLE.fontWeight)
  minutesText.setAttribute('fill', MINUTES_STYLE.fill)
  minutesText.setAttribute('stroke', MINUTES_STYLE.stroke)
  minutesText.setAttribute('stroke-width', String(MINUTES_STYLE.strokeWidth))
  minutesText.setAttribute('paint-order', 'stroke fill')
  minutesText.setAttribute('stroke-linejoin', 'round')
  minutesText.setAttribute('stroke-linecap', 'round')
  minutesText.setAttribute('opacity', '1')
}

function deriveMinutesAnchor(dialRotor, legacyMinutesEl) {
  const indicator = dialRotor?.querySelector('#indicador')
  let x = 432.5
  let y = 346.5

  if (indicator?.getBBox) {
    try {
      const ind = indicator.getBBox()
      x = ind.x + ind.width / 2
    } catch {
      // fallback
    }
  }

  if (legacyMinutesEl?.getBBox) {
    try {
      const bb = legacyMinutesEl.getBBox()
      y = bb.y + bb.height / 2
    } catch {
      // fallback
    }
  }

  return { x, y }
}

export default function ExperimentalFigmaClock({ snapshot, hemisphere = 'south' }) {
  const wrapRef = useRef(null)
  const geomRef = useRef({
    dialCx: null,
    dialCy: null,
    horasExteriorCx: null,
    horasExteriorCy: null,
    minutesX: null,
    minutesY: null,
  })
  const baseTransformsRef = useRef({
    dialRotor: null,
    horasExterior: null,
    numerosColoresItems: null,
    yinYangDiskPaths: null,
  })

  const geo = useMemo(() => {
    const gh = clamp24(snapshot?.raw?.geometricHour)
    const geoHms = snapshot?.raw?.geoHms ?? null
    const minutes = geoHms && typeof geoHms.m === 'number' ? geoHms.m : Math.floor((gh - Math.floor(gh)) * 60)
    return {
      gh,
      minutes: Math.floor(minutes || 0),
    }
  }, [snapshot])

  useLayoutEffect(() => {
    let cancelled = false

    const run = async () => {
      // Esperar fuentes reales antes de mostrar: en Chrome la calibración dinámica
      // medía con el fallback del sistema y dejaba el texto más pequeño.
      await document.fonts.ready
      if (cancelled) return

      const wrap = wrapRef.current
      if (!wrap) return

      const svg = wrap.querySelector('svg')
      if (!svg) return

      const direction = hemisphere === 'north' ? -1 : 1
      const pointerAngleDeg = computeAngleDeg(geo.gh, direction)
      const yinyangRotationDeg = pointerAngleDeg + 90

      const dialRotor = svg.querySelector('#dial-rotor')
      const yinYang = svg.querySelector('#yin-yang')
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
        const anchor = deriveMinutesAnchor(dialRotor, legacyMinutes)
        geomRef.current.minutesX = anchor.x
        geomRef.current.minutesY = anchor.y
      }

      const horasExterior = svg.querySelector('#horas-exterior')
      const numerosColores = svg.querySelector('#numeros-colores')

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
      const minutesX = snapHalfPx(geomRef.current.minutesX + MINUTES_X_NUDGE)
      const minutesY = snapHalfPx(geomRef.current.minutesY + MINUTES_Y_NUDGE)

      if (!minutesText) {
        minutesText = document.createElementNS(SVG_NS, 'text')
        minutesText.setAttribute('data-role', 'geo-minutes-text')
        minutesText.setAttribute('text-anchor', 'middle')
        minutesText.setAttribute('dominant-baseline', 'middle')
        minutesText.setAttribute('text-rendering', 'geometricPrecision')
        minutesText.setAttribute('font-variant-numeric', 'tabular-nums')
        dialRotor?.appendChild(minutesText)
      } else if (dialRotor) {
        dialRotor.appendChild(minutesText)
      }

      minutesText.setAttribute('x', String(minutesX))
      minutesText.setAttribute('y', String(minutesY))
      applyMinutesTextStyle(minutesText)
      minutesText.textContent = pad2(geo.minutes)
      minutesText.setAttribute('transform', `rotate(${-yinyangRotationDeg} ${minutesX} ${minutesY})`)

      wrap.setAttribute('data-ready', '1')
    }

    run()

    return () => {
      cancelled = true
    }
  }, [geo, hemisphere])

  return (
    <div
      ref={wrapRef}
      className="experimental-figma-clock"
      data-ready="0"
      // eslint-disable-next-line react/no-danger
      dangerouslySetInnerHTML={{ __html: relojFigmaRaw }}
    />
  )
}
