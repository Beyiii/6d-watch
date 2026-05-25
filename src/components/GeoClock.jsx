import { useId, useMemo } from 'react'

import { getDynamicBackgroundColors } from '../core/background.js'

function toFixed2(n) {
  return n.toString().padStart(2, '0')
}

function polarToCartesian(cx, cy, r, angleDeg) {
  const a = (angleDeg * Math.PI) / 180
  return {
    x: cx + r * Math.cos(a),
    y: cy + r * Math.sin(a),
  }
}

function ringSegmentPath(cx, cy, rOuter, rInner, startAngleDeg, endAngleDeg, sweepFlag) {
  const startOuter = polarToCartesian(cx, cy, rOuter, startAngleDeg)
  const endOuter = polarToCartesian(cx, cy, rOuter, endAngleDeg)
  const startInner = polarToCartesian(cx, cy, rInner, endAngleDeg)
  const endInner = polarToCartesian(cx, cy, rInner, startAngleDeg)

  const delta = sweepFlag === 1
    ? ((endAngleDeg - startAngleDeg) % 360 + 360) % 360
    : ((startAngleDeg - endAngleDeg) % 360 + 360) % 360

  const largeArc = delta > 180 ? 1 : 0
  const innerSweep = sweepFlag === 1 ? 0 : 1

  return [
    `M ${startOuter.x} ${startOuter.y}`,
    `A ${rOuter} ${rOuter} 0 ${largeArc} ${sweepFlag} ${endOuter.x} ${endOuter.y}`,
    `L ${startInner.x} ${startInner.y}`,
    `A ${rInner} ${rInner} 0 ${largeArc} ${innerSweep} ${endInner.x} ${endInner.y}`,
    'Z',
  ].join(' ')
}

function polygonRingSegmentPath(cx, cy, rOuter, rInner, startAngleDeg, endAngleDeg) {
  const outerA = polarToCartesian(cx, cy, rOuter, startAngleDeg)
  const outerB = polarToCartesian(cx, cy, rOuter, endAngleDeg)
  const innerB = polarToCartesian(cx, cy, rInner, endAngleDeg)
  const innerA = polarToCartesian(cx, cy, rInner, startAngleDeg)

  return [
    `M ${outerA.x} ${outerA.y}`,
    `L ${outerB.x} ${outerB.y}`,
    `L ${innerB.x} ${innerB.y}`,
    `L ${innerA.x} ${innerA.y}`,
    'Z',
  ].join(' ')
}

function computeAngleDeg(hour, direction) {
  // Coordenadas SVG: 0° → derecha, 90° → abajo, 180° → izquierda, -90°(270°) → arriba.
  // Queremos que:
  // - Hemisferio sur: 6 → derecha, 12 → arriba, 18 → izquierda, 0 → abajo
  // - Hemisferio norte: 6 → izquierda, 12 → arriba, 18 → derecha, 0 → abajo
  const h = ((hour % 24) + 24) % 24

  if (direction === 1) {
    // Sur
    return -15 * (h - 6)
  }

  // Norte
  return -15 * (18 - h)
}

function computeCivilAngleDeg(hour) {
  // Aro civil fijo (no depende del hemisferio):
  // 12 arriba, 24(0) abajo, 6 izquierda, 18 derecha.
  const h = ((hour % 24) + 24) % 24
  // SVG: 0° derecha, -90° arriba
  return -90 + 15 * (h - 12)
}

function MoonPhaseGlyph({ cx, cy, r, phase }) {
  // Indicador simple (un solo círculo visible) cuya luminosidad varía con la fase.
  const p = typeof phase === 'number' && Number.isFinite(phase) ? ((phase % 1) + 1) % 1 : 0
  const illumination = (1 - Math.cos(2 * Math.PI * p)) / 2
  const alpha = 0.18 + 0.72 * illumination

  return (
    <g className="geo-moon" aria-label="Fase lunar">
      <circle cx={cx} cy={cy} r={r} fill={`rgba(230, 237, 246, ${alpha.toFixed(3)})`} />
    </g>
  )
}

export default function GeoClock({
  snapshot,
  hemisphere = 'south',
  bgMid = null,
  dialSize = 420,
  wrapId = null,
  onOpen = null,
}) {
  const uid = useId().replace(/:/g, '')
  const goldId = `geoGold-${uid}`
  const innerDiskId = `geoInnerDisk-${uid}`
  const yinDepthId = `geoYinDepth-${uid}`
  const yinDarkId = `geoYinDark-${uid}`
  const shadowId = `geoShadow-${uid}`

  const direction = hemisphere === 'north' ? -1 : 1
  // Para segmentos pequeños (15°) el sweep debe respetar el sentido del dial,
  // si no, cada segmento intenta dibujar el arco largo (345°) y tapa el disco.
  const sweepFlag = direction === 1 ? 0 : 1

  const geometricHour = snapshot?.raw?.geometricHour
  const gh = typeof geometricHour === 'number' && Number.isFinite(geometricHour) ? ((geometricHour % 24) + 24) % 24 : 0
  const geoHms = snapshot?.raw?.geoHms ?? { h: 0, m: 0, s: 0 }
  const geoMinutesText = toFixed2(Math.floor(geoHms.m ?? 0))

  const civilHour = (() => {
    const hh = snapshot?.ui?.civilTime?.slice?.(0, 2)
    const parsed = Number.parseInt(hh, 10)
    if (!Number.isFinite(parsed)) return 0
    return parsed
  })()

  const civilHighlight = civilHour === 0 ? 24 : civilHour
  const phase = snapshot?.raw?.lunarData?.phase

  const geoColors = useMemo(() => {
    const colors = []
    for (let h = 0; h < 24; h += 1) {
      const c = getDynamicBackgroundColors(h)
      colors.push(c.mid)
    }
    return colors
  }, [])

  const lightFill = bgMid ?? getDynamicBackgroundColors(gh).mid

  // Dial geometry (base 420, scales with dialSize)
  const size = dialSize
  const baseSize = 420
  const scale = size / baseSize

  const cx = size / 2
  const cy = size / 2
  const rGoldOuter = 202 * scale
  const rGoldInner = 188 * scale
  const rCivilOuter = rGoldInner
  const rCivilInner = 164 * scale
  const rCivilText = 176 * scale
  const rGeoOuter = rCivilInner
  const rGeoInner = 136 * scale
  const rGeoLabel = 150 * scale
  const rBlackRingOuter = rGeoInner
  const rBlackRingInner = 124 * scale
  const rYinYang = rBlackRingInner - 10 * scale

  const pointerAngleDeg = computeAngleDeg(gh, direction)
  const yinyangRotationDeg = pointerAngleDeg + 90

  const civilNumbers = Array.from({ length: 24 }, (_, idx) => idx + 1)
  const geoLabels = [0, 3, 6, 9, 12, 15, 18, 21]
  const geoLabelText = (h) => (h >= 15 ? h - 12 : h)

  return (
    <div
      id={wrapId || undefined}
      className={['geo-dial-wrap', onOpen ? 'is-clickable' : ''].filter(Boolean).join(' ')}
      style={{ '--geo-dial-size': `${dialSize}px` }}
      role={onOpen ? 'button' : undefined}
      tabIndex={onOpen ? 0 : undefined}
      onClick={onOpen ? onOpen : undefined}
      onKeyDown={
        onOpen
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                onOpen()
              }
            }
          : undefined
      }
    >
      <svg
        className="geo-dial"
        viewBox={`0 0 ${size} ${size}`}
        overflow="visible"
        role="img"
        aria-label="Reloj geométrico"
      >
        <defs>
          <linearGradient id={goldId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgba(255, 246, 220, 0.95)" />
            <stop offset="45%" stopColor="rgba(216, 177, 112, 0.95)" />
            <stop offset="100%" stopColor="rgba(140, 96, 38, 0.92)" />
          </linearGradient>
          <radialGradient id={innerDiskId} cx="35%" cy="30%" r="75%">
            <stop offset="0%" stopColor="rgba(255, 255, 255, 0.10)" />
            <stop offset="45%" stopColor="rgba(18, 24, 38, 0.26)" />
            <stop offset="100%" stopColor="rgba(0, 0, 0, 0.42)" />
          </radialGradient>
          <radialGradient id={yinDepthId} cx="34%" cy="28%" r="78%">
            <stop offset="0%" stopColor="rgba(255, 255, 255, 0.28)" />
            <stop offset="40%" stopColor="rgba(255, 255, 255, 0.06)" />
            <stop offset="62%" stopColor="rgba(255, 255, 255, 0)" />
            <stop offset="100%" stopColor="rgba(0, 0, 0, 0.32)" />
          </radialGradient>
          <radialGradient id={yinDarkId} cx="30%" cy="26%" r="85%">
            <stop offset="0%" stopColor="rgba(46, 52, 74, 0.96)" />
            <stop offset="48%" stopColor="rgba(20, 24, 36, 0.94)" />
            <stop offset="100%" stopColor="rgba(8, 10, 16, 0.98)" />
          </radialGradient>
          <filter id={shadowId} filterUnits="userSpaceOnUse" x="-240" y="-240" width="1200" height="1200">
            <feDropShadow dx="0" dy="10" stdDeviation="10" floodColor="rgba(0,0,0,0.45)" />
          </filter>
        </defs>

        {/* Aro dorado (estética 3D) */}
        <g filter={`url(#${shadowId})`}>
          <circle cx={cx} cy={cy} r={rGoldOuter} fill="none" stroke={`url(#${goldId})`} strokeWidth={rGoldOuter - rGoldInner} />
        </g>

        {/* Disco base inmediatamente debajo del aro dorado (sin huecos) */}
        <circle cx={cx} cy={cy} r={rGoldInner} fill={`url(#${innerDiskId})`} />

        {/* Polígono civil (24 lados) con highlight por trozo */}
        <g className="geo-civil">
          {civilNumbers.map((n) => {
            const hourValue = n === 24 ? 0 : n
            const a0 = computeCivilAngleDeg(hourValue - 0.5)
            const a1 = computeCivilAngleDeg(hourValue + 0.5)
            const path = polygonRingSegmentPath(cx, cy, rCivilOuter, rCivilInner, a0, a1)
            const isActive = n === civilHighlight

            const midA = computeCivilAngleDeg(hourValue)
            const { x, y } = polarToCartesian(cx, cy, rCivilText, midA)

            return (
              <g key={n}>
                <path
                  d={path}
                  fill={isActive ? 'rgba(242, 248, 255, 0.14)' : 'rgba(18, 24, 38, 0.22)'}
                  stroke={isActive ? 'rgba(118, 191, 255, 0.38)' : 'rgba(255, 255, 255, 0.08)'}
                  strokeWidth="1"
                />
                <text
                  x={x}
                  y={y}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  className={['geo-civil-number', isActive ? 'is-active' : ''].filter(Boolean).join(' ')}
                >
                  {n}
                </text>
              </g>
            )
          })}
        </g>

        {/* Aro de color geométrico (24 segmentos) */}
        <g className="geo-color-ring">
          {geoColors.map((color, i) => {
            const a0 = computeAngleDeg(i - 0.5, direction)
            const a1 = computeAngleDeg(i + 0.5, direction)
            const path = ringSegmentPath(cx, cy, rGeoOuter, rGeoInner, a0, a1, sweepFlag)
            return <path key={i} d={path} fill={color} opacity="0.95" />
          })}

          {/* Labels (0,3,6,9,12,...) sobre el aro de color */}
          {geoLabels.map((h) => {
            const angle = computeAngleDeg(h, direction)
            const { x, y } = polarToCartesian(cx, cy, rGeoLabel, angle)
            return (
              <text
                key={h}
                x={x}
                y={y}
                textAnchor="middle"
                dominantBaseline="middle"
                className="geo-hour-label"
              >
                {geoLabelText(h)}
              </text>
            )
          })}
        </g>

        {/* Aro negro */}
        <circle
          cx={cx}
          cy={cy}
          r={(rBlackRingOuter + rBlackRingInner) / 2}
          fill="none"
          stroke="rgba(10, 12, 18, 0.88)"
          strokeWidth={rBlackRingOuter - rBlackRingInner}
        />

        {/* Grupo rotatorio (yin-yang + gota/puntero + fase lunar) */}
        <g transform={`rotate(${yinyangRotationDeg} ${cx} ${cy})`}>
          {/* Yin-yang base */}
          <circle cx={cx} cy={cy} r={rYinYang} fill={lightFill} opacity="0.98" stroke="rgba(255,255,255,0.14)" strokeWidth={2 * scale} />
          <circle cx={cx} cy={cy} r={rYinYang} fill={`url(#${yinDepthId})`} opacity="0.96" />

          {/* Lóbulo oscuro (rotado 180° para que la gota quede en la parte clara y la luna en la oscura) */}
          <g transform={`rotate(180 ${cx} ${cy})`}>
            <path
              d={
                [
                  `M ${cx} ${cy - rYinYang}`,
                  `A ${rYinYang} ${rYinYang} 0 0 1 ${cx} ${cy + rYinYang}`,
                  `A ${rYinYang / 2} ${rYinYang / 2} 0 0 0 ${cx} ${cy}`,
                  `A ${rYinYang / 2} ${rYinYang / 2} 0 0 1 ${cx} ${cy - rYinYang}`,
                  'Z',
                ].join(' ')
              }
              fill={`url(#${yinDarkId})`}
            />
          </g>

          {/* Círculo que representa la fase lunar (dentro de la parte oscura) */}
          <MoonPhaseGlyph cx={cx} cy={cy + rYinYang / 2.1} r={18 * scale} phase={phase} />

          {/* Gota/puntero con los minutos geométricos (en la parte clara, punta hacia el exterior) */}
          <g className="geo-pointer" transform={`translate(${cx} ${cy - rYinYang / 2.15})`}>
            <g transform={`scale(${scale})`}>
              <path
                d="M 0 -26 C 11 -22 17 -14 17 -6 C 17 12 5 22 0 28 C -5 22 -17 12 -17 -6 C -17 -14 -11 -22 0 -26 Z"
                transform="rotate(180)"
                fill="rgba(9, 12, 18, 0.92)"
                stroke="rgba(255,255,255,0.18)"
                strokeWidth="1"
              />
              <text
                x="0"
                y="-2"
                textAnchor="middle"
                dominantBaseline="middle"
                className="geo-pointer-text"
                transform={`rotate(${-yinyangRotationDeg})`}
              >
                {geoMinutesText}
              </text>
            </g>
          </g>
        </g>
      </svg>
    </div>
  )
}
