// Motor puro (sin dependencias de React) que aplica al SVG del reloj toda la lógica
// dinámica: rotación del dial, flip por hemisferio, destaque de hora civil/geométrica,
// fase lunar y texto de minutos. Lo usa tanto el hook useAnimatedFigmaClock (app web)
// como el runtime del widget de Android (WebView headless), para no duplicar lógica.

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
  // Coordenadas SVG: 0Â° â†’ derecha, 90Â° â†’ abajo, 180Â° â†’ izquierda, -90Â°(270Â°) â†’ arriba.
  // Queremos que:
  // - Hemisferio sur: 6 â†’ derecha, 12 â†’ arriba, 18 â†’ izquierda, 0 â†’ abajo
  // - Hemisferio norte: 6 â†’ izquierda, 12 â†’ arriba, 18 â†’ derecha, 0 â†’ abajo
  const h = clamp24(hour)
  if (direction === 1) return -15 * (h - 6) // Sur
  return -15 * (18 - h) // Norte
}

function computeGeometricRingSegmentIndex(geometricHour) {
  const gh = Math.floor(clamp24(geometricHour))
  // Misma correspondencia que el puntero geomÃ©trico, truncada a hora entera.
  return (12 - gh + 24) % 24
}

function computeGeometricRingSegmentPosition(geometricHour) {
  const gh = clamp24(geometricHour)
  // PosiciÃ³n continua sobre el anillo de 24 segmentos.
  return (12 - gh + 24) % 24
}

function computeHourFromSouthernRingAngle(angleDeg) {
  const hour = 6 - angleDeg / 15
  return clamp24(Math.round(hour))
}

function resolveElementVisualCenter(el) {
  if (!el?.getBBox) return { x: 0, y: 0 }

  try {
    const bb = el.getBBox()
    return {
      x: bb.x + bb.width / 2,
      y: bb.y + bb.height / 2,
    }
  } catch {
    return { x: 0, y: 0 }
  }
}

function computeRingAngleDegFromCenter(cx, cy, x, y) {
  return Math.atan2(y - cy, x - cx) * (180 / Math.PI)
}

function measureGeoRingSegmentIndex(el, ringCx, ringCy, resetTransforms = []) {
  const saved = resetTransforms.map((node) => ({
    node,
    transform: node.getAttribute('transform'),
  }))
  const savedEl = el.getAttribute('transform')

  saved.forEach(({ node }) => node.removeAttribute('transform'))
  el.removeAttribute('transform')

  try {
    const { x, y } = resolveElementVisualCenter(el)
    const angle = computeRingAngleDegFromCenter(ringCx, ringCy, x, y)
    const hour = computeHourFromSouthernRingAngle(angle)
    return {
      segmentIndex: computeGeometricRingSegmentIndex(hour),
      gx: x,
      gy: y,
    }
  } finally {
    if (savedEl == null) el.removeAttribute('transform')
    else el.setAttribute('transform', savedEl)

    saved.forEach(({ node, transform }) => {
      if (transform == null) node.removeAttribute('transform')
      else node.setAttribute('transform', transform)
    })
  }
}

const SVG_NS = 'http://www.w3.org/2000/svg'

// Referencia fija de minutos: viewBox 40×26, Space Grotesk bold + borde blanco.
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

const DISCO_BASE_CENTER_X = 432.253
const DISCO_BASE_CENTER_Y = 432.259

const CIVIL_NUMBER_ACTIVE_SCALE = 1.11
const CIVIL_NUMBER_INACTIVE_OPACITY = 1
const CIVIL_NUMBER_ACTIVE_STROKE_WIDTH = 0.6

const GEO_NUMBER_ACTIVE_SCALE = 1.13
const GEO_NUMBER_INACTIVE_OPACITY = 0.8
const GEO_NUMBER_ACTIVE_STROKE = '#FFFFFF'
const GEO_NUMBER_ACTIVE_STROKE_WIDTH = 0.9
const GEO_LINE_INACTIVE_OPACITY = 1
const GEO_LINE_ACTIVE_STROKE_BOOST = 1.8
const GEO_LINE_ACTIVE_DARKEN = 0.2

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

function buildScaleAround(cx, cy, scale) {
  if (Math.abs(scale - 1) < 0.001) return ''
  const scx = snapHalfPx(cx)
  const scy = snapHalfPx(cy)
  return `translate(${scx} ${scy}) scale(${scale}) translate(${-scx} ${-scy})`
}

function applyComposedTransform(el, baseTransform, extraTransform) {
  if (!el) return
  const merged = [baseTransform, extraTransform].filter(Boolean).join(' ').trim()
  if (merged) el.setAttribute('transform', merged)
  else el.removeAttribute('transform')
}

// 12 y 0 estÃ¡n en el eje vertical: no se mueven al cambiar hemisferio.
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

export function deriveValidMoonPhase(snapshot) {
  return normalizeMoonPhase(snapshot?.raw?.lunarData?.phase)
}

export function deriveValidCivilHour(snapshot) {
  const hh = snapshot?.ui?.civilTime?.slice?.(0, 2)
  const parsed = Number.parseInt(hh, 10)
  if (!Number.isFinite(parsed)) return null
  return ((parsed % 24) + 24) % 24
}

function computeCivilHighlightRotationDeg(civilHour) {
  const h = ((civilHour % 24) + 24) % 24
  return (h - 12) * 15
}

function resolveDiscoBaseCenter(svg) {
  const discoBase = svg.querySelector('#disco-base')
  if (discoBase?.getBBox) {
    try {
      const bb = discoBase.getBBox()
      return {
        cx: bb.x + bb.width / 2,
        cy: bb.y + bb.height / 2,
      }
    } catch {
      // fallback
    }
  }

  return {
    cx: DISCO_BASE_CENTER_X,
    cy: DISCO_BASE_CENTER_Y,
  }
}

function ensureNumeroAlumbradoRotor(discoBase) {
  const numeroAlumbrado = discoBase?.querySelector('#numero-alumbrado')
  if (!numeroAlumbrado) return null

  const existingRotor = discoBase.querySelector('[data-role="civil-hour-highlight-rotor"]')
  if (existingRotor) return existingRotor

  const parent = numeroAlumbrado.parentElement
  if (!parent) return null

  const rotor = document.createElementNS(SVG_NS, 'g')
  rotor.setAttribute('id', 'numero-alumbrado-rotor')
  rotor.setAttribute('data-role', 'civil-hour-highlight-rotor')
  parent.insertBefore(rotor, numeroAlumbrado)
  rotor.appendChild(numeroAlumbrado)
  return rotor
}

function applyCivilHourHighlight(svg, civilHour, baseTransformsRef, geomRef) {
  const discoBase = svg.querySelector('#disco-base')
  const rotor = ensureNumeroAlumbradoRotor(discoBase)
  if (!rotor) return

  if (geomRef.current.discoBaseCx == null || geomRef.current.discoBaseCy == null) {
    const { cx, cy } = resolveDiscoBaseCenter(svg)
    geomRef.current.discoBaseCx = cx
    geomRef.current.discoBaseCy = cy
  }

  if (baseTransformsRef.current.numeroAlumbradoRotor === null) {
    baseTransformsRef.current.numeroAlumbradoRotor = rotor.getAttribute('transform') ?? ''
  }

  const cx = snapHalfPx(geomRef.current.discoBaseCx)
  const cy = snapHalfPx(geomRef.current.discoBaseCy)
  const angle = computeCivilHighlightRotationDeg(civilHour)
  const rotation = Math.abs(angle) < 0.001 ? '' : `rotate(${angle} ${cx} ${cy})`

  applyComposedTransform(rotor, baseTransformsRef.current.numeroAlumbradoRotor, rotation)
}

function civilHourToNumberId(civilHour) {
  const h = ((civilHour % 24) + 24) % 24
  return h === 0 ? '24' : String(h)
}

function ensureCivilNumberRotor(numberPath) {
  if (!numberPath?.parentElement) return null

  const parent = numberPath.parentElement
  if (parent.getAttribute('data-role') === 'civil-number-rotor') return parent

  const rotor = document.createElementNS(SVG_NS, 'g')
  rotor.setAttribute('data-role', 'civil-number-rotor')
  rotor.setAttribute('data-number-id', numberPath.id ?? '')
  parent.insertBefore(rotor, numberPath)
  rotor.appendChild(numberPath)
  return rotor
}

function readCivilNumberPathBase(path) {
  return {
    fill: path.getAttribute('fill') ?? '',
    stroke: path.getAttribute('stroke'),
    strokeWidth: path.getAttribute('stroke-width'),
    strokeLinejoin: path.getAttribute('stroke-linejoin'),
    strokeLinecap: path.getAttribute('stroke-linecap'),
    paintOrder: path.getAttribute('paint-order'),
  }
}

function restoreCivilNumberPathStyle(path, pathBase) {
  if (pathBase.stroke == null) path.removeAttribute('stroke')
  else path.setAttribute('stroke', pathBase.stroke)

  if (pathBase.strokeWidth == null) path.removeAttribute('stroke-width')
  else path.setAttribute('stroke-width', pathBase.strokeWidth)

  if (pathBase.strokeLinejoin == null) path.removeAttribute('stroke-linejoin')
  else path.setAttribute('stroke-linejoin', pathBase.strokeLinejoin)

  if (pathBase.strokeLinecap == null) path.removeAttribute('stroke-linecap')
  else path.setAttribute('stroke-linecap', pathBase.strokeLinecap)

  if (pathBase.paintOrder == null) path.removeAttribute('paint-order')
  else path.setAttribute('paint-order', pathBase.paintOrder)
}

function applyCivilNumberPathWeight(path, pathBase, isActive) {
  if (!isActive) {
    restoreCivilNumberPathStyle(path, pathBase)
    return
  }

  const strokePaint = pathBase.fill || path.getAttribute('fill') || ''
  if (!strokePaint) return

  path.setAttribute('stroke', strokePaint)
  path.setAttribute('stroke-width', String(CIVIL_NUMBER_ACTIVE_STROKE_WIDTH))
  path.setAttribute('stroke-linejoin', 'round')
  path.setAttribute('stroke-linecap', 'round')
  path.setAttribute('paint-order', 'stroke fill')
}

function initCivilNumberItems(numerosGroup, baseTransformsRef) {
  if (baseTransformsRef.current.civilNumberItems !== null) {
    return baseTransformsRef.current.civilNumberItems
  }

  const items = Array.from(numerosGroup.querySelectorAll(':scope > path'))
    .map((path) => {
      const id = path.id
      if (!id) return null

      const rotor = ensureCivilNumberRotor(path)
      if (!rotor) return null

      rotor.removeAttribute('style')
      rotor.removeAttribute('filter')

      let gx = 0
      let gy = 0
      if (rotor.getBBox) {
        try {
          const bb = rotor.getBBox()
          gx = bb.x + bb.width / 2
          gy = bb.y + bb.height / 2
        } catch {
          // fallback
        }
      }

      return {
        id,
        rotor,
        path,
        base: rotor.getAttribute('transform') ?? '',
        pathBase: readCivilNumberPathBase(path),
        gx,
        gy,
      }
    })
    .filter(Boolean)

  baseTransformsRef.current.civilNumberItems = items
  return items
}

function applyCivilNumberHighlight(svg, civilHour, baseTransformsRef) {
  if (civilHour == null) return

  const numerosGroup = svg.querySelector('#numeros')
  if (!numerosGroup) return

  // Limpia el filtro de versiones anteriores durante una recarga en caliente.
  svg.querySelector('#civil-hour-golden-glow')?.remove()

  const items = initCivilNumberItems(numerosGroup, baseTransformsRef)
  const activeId = civilHourToNumberId(civilHour)

  items.forEach(({ id, rotor, path, base, pathBase, gx, gy }) => {
    const isActive = id === activeId
    const scaleTransform = isActive
      ? buildScaleAround(gx, gy, CIVIL_NUMBER_ACTIVE_SCALE)
      : ''

    applyComposedTransform(rotor, base, scaleTransform)
    rotor.removeAttribute('filter')
    rotor.setAttribute('opacity', isActive ? '1' : String(CIVIL_NUMBER_INACTIVE_OPACITY))
    applyCivilNumberPathWeight(path, pathBase, isActive)
  })
}

function applyCivilHourHighlights(svg, civilHour, baseTransformsRef, geomRef) {
  if (civilHour == null) return
  applyCivilHourHighlight(svg, civilHour, baseTransformsRef, geomRef)
  applyCivilNumberHighlight(svg, civilHour, baseTransformsRef)
}

function readGeoLinePathBase(path) {
  return {
    stroke: path.getAttribute('stroke') ?? '',
    strokeWidth: path.getAttribute('stroke-width'),
    strokeLinecap: path.getAttribute('stroke-linecap'),
    strokeDasharray: path.getAttribute('stroke-dasharray'),
  }
}

function restoreGeoLinePathStyle(path, pathBase) {
  path.setAttribute('stroke', pathBase.stroke)

  if (pathBase.strokeWidth == null) path.removeAttribute('stroke-width')
  else path.setAttribute('stroke-width', pathBase.strokeWidth)

  if (pathBase.strokeLinecap == null) path.removeAttribute('stroke-linecap')
  else path.setAttribute('stroke-linecap', pathBase.strokeLinecap)

  if (pathBase.strokeDasharray == null) path.removeAttribute('stroke-dasharray')
  else path.setAttribute('stroke-dasharray', pathBase.strokeDasharray)
}

function applyGeoLinePathWeight(path, pathBase, isActive) {
  if (!isActive) {
    restoreGeoLinePathStyle(path, pathBase)
    return
  }

  const baseWidth = Number.parseFloat(pathBase.strokeWidth ?? '3')
  const activeWidth = Number.isFinite(baseWidth)
    ? baseWidth + GEO_LINE_ACTIVE_STROKE_BOOST
    : 3 + GEO_LINE_ACTIVE_STROKE_BOOST

  path.setAttribute('stroke', darkenGeoLineStroke(pathBase.stroke))
  path.setAttribute('stroke-width', String(activeWidth))
}

function darkenGeoLineStroke(strokeColor) {
  const base = parseColor(strokeColor)
  if (!base) return strokeColor

  const darkened = mixRgb(base, { r: 0, g: 0, b: 0 }, GEO_LINE_ACTIVE_DARKEN)
  const r = Math.round(darkened.r)
  const g = Math.round(darkened.g)
  const b = Math.round(darkened.b)
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`
}

function applyGeoNumberPathWeight(path, pathBase, isActive) {
  if (!isActive) {
    restoreCivilNumberPathStyle(path, pathBase)
    return
  }

  path.setAttribute('stroke', GEO_NUMBER_ACTIVE_STROKE)
  path.setAttribute('stroke-width', String(GEO_NUMBER_ACTIVE_STROKE_WIDTH))
  path.setAttribute('stroke-linejoin', 'round')
  path.setAttribute('stroke-linecap', 'round')
  path.setAttribute('paint-order', 'stroke fill')
}

function initGeoRingHighlightItems(numerosColores, lineasGeoHoras, ringCx, ringCy, baseTransformsRef) {
  if (baseTransformsRef.current.geoRingHighlightItems !== null) {
    return baseTransformsRef.current.geoRingHighlightItems
  }

  const items = []

  if (numerosColores) {
    Array.from(numerosColores.querySelectorAll(':scope > g')).forEach((group) => {
      const id = group.id
      if (!id) return

      const { segmentIndex, gx, gy } = measureGeoRingSegmentIndex(group, ringCx, ringCy)
      const path = group.querySelector(':scope > path')

      group.removeAttribute('filter')

      items.push({
        kind: 'number',
        id,
        el: group,
        path,
        pathBase: path ? readCivilNumberPathBase(path) : null,
        base: group.getAttribute('transform') ?? '',
        gx,
        gy,
        segmentIndex,
      })
    })
  }

  if (lineasGeoHoras) {
    Array.from(lineasGeoHoras.querySelectorAll(':scope > path')).forEach((path) => {
      const id = path.id
      if (!id) return

      const { segmentIndex } = measureGeoRingSegmentIndex(
        path,
        ringCx,
        ringCy,
        [lineasGeoHoras]
      )

      items.push({
        kind: 'line',
        id,
        el: path,
        pathBase: readGeoLinePathBase(path),
        segmentIndex,
      })
    })
  }

  baseTransformsRef.current.geoRingHighlightItems = items
  return items
}

function applyGeoRingHighlight(
  activeGeo,
  numerosColores,
  lineasGeoHoras,
  isNorth,
  horasRcx,
  baseTransformsRef,
  geomRef
) {
  if (!activeGeo) return

  const ringCx = geomRef.current.horasExteriorCx
  const ringCy = geomRef.current.horasExteriorCy
  if (ringCx == null || ringCy == null) return

  const items = initGeoRingHighlightItems(
    numerosColores,
    lineasGeoHoras,
    ringCx,
    ringCy,
    baseTransformsRef
  )
  const activeSegmentIndex = computeGeometricRingSegmentIndex(activeGeo.gh)

  items.forEach((item) => {
    const isActive = item.segmentIndex === activeSegmentIndex

    if (item.kind === 'number') {
      const shouldMirror = isNorth && !NUMEROS_SKIP_MIRROR_IDS.has(item.id)
      const mirrorTranslate = shouldMirror
        ? buildHorizontalMirrorTranslate(horasRcx, item.gx)
        : ''
      const scaleTransform = isActive
        ? buildScaleAround(item.gx, item.gy, GEO_NUMBER_ACTIVE_SCALE)
        : ''

      applyComposedTransform(
        item.el,
        item.base,
        [mirrorTranslate, scaleTransform].filter(Boolean).join(' ')
      )
      item.el.setAttribute(
        'opacity',
        isActive ? '1' : String(GEO_NUMBER_INACTIVE_OPACITY)
      )

      if (item.path && item.pathBase) {
        applyGeoNumberPathWeight(item.path, item.pathBase, isActive)
      }
      return
    }

    item.el.setAttribute(
      'opacity',
      isActive ? '1' : String(GEO_LINE_INACTIVE_OPACITY)
    )
    applyGeoLinePathWeight(item.el, item.pathBase, isActive)
  })
}

function resolveMoonVisualCenter(faseLunar) {
  const moonPivotSource = faseLunar?.querySelector('#Group_2_2_2') ?? faseLunar
  if (moonPivotSource?.getBBox) {
    try {
      const bb = moonPivotSource.getBBox()
      return {
        moonCx: bb.x + bb.width / 2,
        moonCy: bb.y + bb.height / 2,
      }
    } catch {
      // fallback
    }
  }

  return {
    moonCx: MOON_CENTER_X,
    moonCy: MOON_CENTER_Y,
  }
}

function applyMoonHemisphereFlip(moonBaseGroup, moonBorderPath, moonCx, moonCy, isSouth, baseTransformsRef) {
  if (moonBaseGroup && baseTransformsRef.current.moonBaseGroup === null) {
    baseTransformsRef.current.moonBaseGroup = moonBaseGroup.getAttribute('transform') ?? ''
  }

  if (moonBorderPath && baseTransformsRef.current.moonBorderPath === null) {
    baseTransformsRef.current.moonBorderPath = moonBorderPath.getAttribute('transform') ?? ''
  }

  const moonFlip = isSouth ? buildHorizontalFlip(moonCx, moonCy) : ''

  applyComposedTransform(moonBaseGroup, baseTransformsRef.current.moonBaseGroup, moonFlip)
  applyComposedTransform(moonBorderPath, baseTransformsRef.current.moonBorderPath, moonFlip)
}

function applyDynamicMoonPhase(dialRotor, moonPhase, hemisphere) {
  const faseLunar = dialRotor?.querySelector('#fase-lunar')
  if (!faseLunar) return

  const moonBaseGroup = faseLunar.querySelector('#Group_2_2_2')
  const moonDiskPath = moonBaseGroup?.querySelector('#Vector_56_2')
  if (!moonBaseGroup || !moonDiskPath) return

  // El disco (`Group_2_2_2`) ya se voltea geomÃ©tricamente en el sur; la fase dinÃ¡mica
  // usa la misma lÃ³gica que el norte para no invertir la iluminaciÃ³n dos veces.
  const pathHemisphere = hemisphere === 'south' ? 'north' : hemisphere

  // Ocultamos la media luna estÃ¡tica original para que solo se vea la fase dinÃ¡mica.
  const staticCrescent = faseLunar.querySelector('#luna-cuarto-creciente')
  if (staticCrescent) {
    staticCrescent.setAttribute('opacity', '0')
  }

  let defs = faseLunar.querySelector('[data-role="dynamic-moon-defs"]')
  if (!defs) {
    defs = document.createElementNS(SVG_NS, 'defs')
    defs.setAttribute('data-role', 'dynamic-moon-defs')
    faseLunar.insertBefore(defs, faseLunar.firstChild)
  }

  const clipPathId = 'dynamic-moon-disk-clip'
  let clipPath = defs.querySelector(`#${clipPathId}`)
  if (!clipPath) {
    clipPath = document.createElementNS(SVG_NS, 'clipPath')
    clipPath.setAttribute('id', clipPathId)
    defs.appendChild(clipPath)
  }

  let clipShape = clipPath.querySelector('[data-role="dynamic-moon-clip-shape"]')
  if (!clipShape) {
    clipShape = document.createElementNS(SVG_NS, 'path')
    clipShape.setAttribute('data-role', 'dynamic-moon-clip-shape')
    clipPath.appendChild(clipShape)
  }
  clipShape.setAttribute('d', moonDiskPath.getAttribute('d') ?? '')

  let moonContainer = moonBaseGroup.querySelector('#moon-container')
  if (!moonContainer) {
    moonContainer = document.createElementNS(SVG_NS, 'g')
    moonContainer.setAttribute('id', 'moon-container')
    moonContainer.setAttribute('clip-path', `url(#${clipPathId})`)

    // Insertar justo encima del disco base (Vector_56_2) dentro de Group_2_2_2.
    const afterDisk = moonDiskPath.nextSibling
    moonBaseGroup.insertBefore(moonContainer, afterDisk)

    // Light phase gradient
    let lightGrad = defs.querySelector('#moon-light-grad')
    if (!lightGrad) {
      lightGrad = document.createElementNS(SVG_NS, 'linearGradient')
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
    }

    // Light phase
    const lightPhase = document.createElementNS(SVG_NS, 'path')
    lightPhase.setAttribute('data-role', 'dynamic-moon-phase-light')
    lightPhase.setAttribute('fill', 'url(#moon-light-grad)')
    lightPhase.setAttribute('stroke', 'none')
    moonContainer.appendChild(lightPhase)
  }

  moonContainer.setAttribute('clip-path', `url(#${clipPathId})`)

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
      hemisphere: pathHemisphere,
    }))
  }
}

function createGeometryRef() {
  return {
    dialCx: null,
    dialCy: null,
    horasExteriorCx: null,
    horasExteriorCy: null,
    moonCx: null,
    moonCy: null,
    discoBaseCx: null,
    discoBaseCy: null,
    minutesX: null,
    minutesY: null,
  }
}

function createBaseTransformsRef() {
  return {
    dialRotor: null,
    faseLunar: null,
    horasExterior: null,
    lineasGeoHoras: null,
    numerosColoresItems: null,
    yinYangDiskPaths: null,
    hourRingColors: null,
    moonBaseGroup: null,
    moonBorderPath: null,
    numeroAlumbradoRotor: null,
    civilNumberItems: null,
    geoRingHighlightItems: null,
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
  const rawIndex = computeGeometricRingSegmentPosition(geometricHour)
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

export function deriveValidGeo(snapshot) {
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

/**
 * Crea el objeto de estado mutable (geometrÃ­a cacheada + transforms base + Ãºltimos
 * valores vÃ¡lidos) que necesita {@link applyFigmaClockState} para funcionar entre llamadas.
 * Equivalente a la combinaciÃ³n de los `useRef` que antes vivÃ­an dentro del hook.
 */
export function createFigmaClockState(readyKey = 'default') {
  return {
    readyKey,
    geom: createGeometryRef(),
    baseTransforms: createBaseTransformsRef(),
    svg: null,
    lastGeo: null,
  }
}

/**
 * Aplica al SVG del reloj (rotaciÃ³n del dial, flip por hemisferio, destaque de hora
 * civil/geomÃ©trica, fase lunar dinÃ¡mica, texto de minutos, etc.) el estado correspondiente
 * a un instante dado. Es la misma lÃ³gica que usa `useAnimatedFigmaClock` en la app web,
 * extraÃ­da para poder reutilizarla fuera de React (p. ej. en el runtime del widget de
 * Android que corre dentro de un WebView headless).
 *
 * @param {Object} params
 * @param {Element} params.root - Contenedor que envuelve el `<svg>` (mismo rol que `rootRef.current`).
 * @param {{gh: number, minutes: number} | null} params.geo - Hora geomÃ©trica activa.
 * @param {number} params.moonPhase - Fase lunar normalizada (0-1).
 * @param {number | null} params.civilHour - Hora civil activa (0-23).
 * @param {'north' | 'south'} params.hemisphere
 * @param {string} params.readyKey - Se usa para invalidar la cachÃ© cuando cambia el SVG montado.
 * @param {ReturnType<typeof createFigmaClockState>} params.state - Estado mutable persistente.
 * @param {() => boolean} [params.isCancelled] - Permite abortar tras esperar `document.fonts.ready`.
 * @param {boolean} [params.waitForFonts] - Si es false, omite la espera de `document.fonts.ready`.
 */
export async function applyFigmaClockState({
  root,
  geo,
  moonPhase,
  civilHour,
  hemisphere = 'south',
  readyKey = 'default',
  state,
  isCancelled = () => false,
  waitForFonts = true,
}) {
  if (!state) return

  if (state.readyKey !== readyKey) {
    state.readyKey = readyKey
    state.geom = createGeometryRef()
    state.baseTransforms = createBaseTransformsRef()
    state.svg = null
    state.lastGeo = null
  }

  const geomRef = { current: state.geom }
  const baseTransformsRef = { current: state.baseTransforms }

  // Esperar fuentes reales antes de mostrar: en Chrome la calibraciÃ³n dinÃ¡mica
  // medÃ­a con el fallback del sistema y dejaba el texto mÃ¡s pequeÃ±o.
  const needsFontCalibration = geomRef.current.minutesX == null || geomRef.current.minutesY == null
  if (waitForFonts && needsFontCalibration && document.fonts?.status !== 'loaded') {
    await document.fonts.ready
    if (isCancelled()) return
  }

  const wrap = root
  if (!wrap) return

  const svg = wrap.querySelector('svg')
  if (!svg) return

  // React puede desmontar y volver a montar los layout effects en desarrollo.
  // Cuando V2GeometricClock reinserta el SVG, todas las referencias DOM cacheadas
  // apuntan al Ã¡rbol anterior y deben reconstruirse para el SVG actual.
  if (state.svg !== svg) {
    state.svg = svg
    state.geom = createGeometryRef()
    state.baseTransforms = createBaseTransformsRef()
    geomRef.current = state.geom
    baseTransformsRef.current = state.baseTransforms
  }

  const activeGeo = geo ?? state.lastGeo
  if (!activeGeo) {
    wrap.setAttribute('data-ready', '1')
    return
  }
  if (geo) state.lastGeo = geo

  const direction = hemisphere === 'north' ? -1 : 1
      const pointerAngleDeg = computeAngleDeg(activeGeo.gh, direction)
      const yinyangRotationDeg = pointerAngleDeg + 90

      const dialRotor = svg.querySelector('#dial-rotor')
      const yinYang = svg.querySelector('#yin-yang')
      const faseLunar = dialRotor?.querySelector('#fase-lunar')
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
      const lineasGeoHoras =
        svg.querySelector('#lineas-geo-horas') ?? svg.querySelector('#linea-horas-geo')
      const numerosColores = svg.querySelector('#numeros-colores')

      applyDynamicYinYangColor(svg, yinYang, horasExterior, activeGeo, baseTransformsRef)

      if (geomRef.current.moonCx == null || geomRef.current.moonCy == null) {
        const { moonCx, moonCy } = resolveMoonVisualCenter(faseLunar)
        geomRef.current.moonCx = moonCx
        geomRef.current.moonCy = moonCy
      }

      const moonBaseGroup = faseLunar?.querySelector('#Group_2_2_2')
      const moonBorderPath = faseLunar?.querySelector('#Vector_57_2')
      const moonCx = snapHalfPx(geomRef.current.moonCx)
      const moonCy = snapHalfPx(geomRef.current.moonCy)
      const isSouth = hemisphere === 'south'

      applyMoonHemisphereFlip(moonBaseGroup, moonBorderPath, moonCx, moonCy, isSouth, baseTransformsRef)
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

      if (baseTransformsRef.current.lineasGeoHoras === null && lineasGeoHoras) {
        baseTransformsRef.current.lineasGeoHoras = lineasGeoHoras.getAttribute('transform') ?? ''
      }

      // Solo voltean los segmentos de color; el filtro de sombra vive en #anillo-horas.
      applyComposedTransform(
        horasExterior,
        baseTransformsRef.current.horasExterior,
        horasFlip
      )

      applyComposedTransform(
        lineasGeoHoras,
        baseTransformsRef.current.lineasGeoHoras,
        horasFlip
      )

      // Los nÃºmeros se trasladan al lado opuesto (sin scale) para que no queden invertidos.
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

      if (baseTransformsRef.current.faseLunar === null && faseLunar) {
        baseTransformsRef.current.faseLunar = faseLunar.getAttribute('transform') ?? ''
      }

      const dynamicRotation = `rotate(${yinyangRotationDeg} ${rcx} ${rcy})`

      if (dialRotor) {
        dialRotor.setAttribute('transform', `${baseTransformsRef.current.dialRotor} ${dynamicRotation}`.trim())
      }

      // La luna sigue la traslaciÃ³n del dial, pero se mantiene visualmente vertical.
      if (faseLunar) {
        const counterRotation = `rotate(${-yinyangRotationDeg} ${moonCx} ${moonCy})`
        applyComposedTransform(faseLunar, baseTransformsRef.current.faseLunar, counterRotation)
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

      applyCivilHourHighlights(svg, civilHour, baseTransformsRef, geomRef)
      applyGeoRingHighlight(
        activeGeo,
        numerosColores,
        lineasGeoHoras,
        isNorth,
        horasRcx,
        baseTransformsRef,
        geomRef
      )

  wrap.setAttribute('data-ready', '1')
}
