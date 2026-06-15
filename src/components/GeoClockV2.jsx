import { useId, useMemo } from 'react'

import { getDynamicBackgroundColors } from '../core/background.js'
import './GeoClockV2.css'

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
  const h = ((hour % 24) + 24) % 24

  if (direction === 1) {
    // Sur
    return -15 * (h - 6)
  }

  // Norte
  return -15 * (18 - h)
}

function computeCivilAngleDeg(hour) {
  const h = ((hour % 24) + 24) % 24
  return -90 + 15 * (h - 12)
}

function MoonPhaseGlyph({ cx, cy, r, phase, glowId }) {
  const p = typeof phase === 'number' && Number.isFinite(phase) ? ((phase % 1) + 1) % 1 : 0
  const illumination = (1 - Math.cos(2 * Math.PI * p)) / 2
  const alpha = 0.2 + 0.72 * illumination

  return (
    <g className="geo2-moon" aria-label="Fase lunar" filter={glowId ? `url(#${glowId})` : undefined}>
      <circle cx={cx} cy={cy} r={r} fill={`rgba(232, 240, 252, ${alpha.toFixed(3)})`} />
    </g>
  )
}

export default function GeoClockV2({
  snapshot,
  hemisphere = 'south',
  bgMid = null,
  dialSize = 460,
  wrapId = null,
  onOpen = null,
}) {
  const uid = useId().replace(/:/g, '')
  const goldId = `geo2Gold-${uid}`
  const goldRimId = `geo2GoldRim-${uid}`
  const innerDiskId = `geo2InnerDisk-${uid}`
  const yinDepthId = `geo2YinDepth-${uid}`
  const yinDarkId = `geo2YinDark-${uid}`
  const yinLightId = `geo2YinLight-${uid}`
  const shadowId = `geo2Shadow-${uid}`
  const ringSheenId = `geo2RingSheen-${uid}`
  const softGlowId = `geo2SoftGlow-${uid}`
  const markerGlowId = `geo2MarkerGlow-${uid}`
  const goldHaloId = `geo2GoldHalo-${uid}`
  const blueHaloId = `geo2BlueHalo-${uid}`

  const direction = hemisphere === 'north' ? -1 : 1
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
  const rMarker = 13 * scale

  return (
    <div
      id={wrapId || undefined}
      className={['geo2-dial-wrap', onOpen ? 'is-clickable' : ''].filter(Boolean).join(' ')}
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
        className="geo2-dial"
        viewBox={`0 0 ${size} ${size}`}
        overflow="visible"
        role="img"
        aria-label="Reloj geométrico"
      >
        <defs>
          {/* Aro dorado pulido */}
          <linearGradient id={goldId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgba(255, 240, 198, 0.98)" />
            <stop offset="42%" stopColor="rgba(214, 168, 96, 0.96)" />
            <stop offset="100%" stopColor="rgba(120, 80, 30, 0.94)" />
          </linearGradient>
          <linearGradient id={goldRimId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgba(255, 226, 158, 0.9)" />
            <stop offset="50%" stopColor="rgba(190, 140, 70, 0.0)" />
            <stop offset="100%" stopColor="rgba(90, 130, 200, 0.55)" />
          </linearGradient>

          {/* Volumen del disco central */}
          <radialGradient id={innerDiskId} cx="38%" cy="30%" r="80%">
            <stop offset="0%" stopColor="rgba(40, 52, 80, 0.55)" />
            <stop offset="42%" stopColor="rgba(14, 20, 36, 0.78)" />
            <stop offset="100%" stopColor="rgba(3, 6, 14, 0.96)" />
          </radialGradient>

          {/* Brillo radial sobre el aro de color (iluminado desde el interior) */}
          <radialGradient id={ringSheenId} cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="rgba(255,255,255,0)" />
            <stop offset="74%" stopColor="rgba(255,255,255,0)" />
            <stop offset="88%" stopColor="rgba(255,255,255,0.16)" />
            <stop offset="100%" stopColor="rgba(255,255,255,0)" />
          </radialGradient>

          {/* Yin-yang pulido */}
          <radialGradient id={yinLightId} cx="34%" cy="26%" r="82%">
            <stop offset="0%" stopColor="rgba(255, 248, 226, 0.5)" />
            <stop offset="46%" stopColor="rgba(255, 244, 214, 0.0)" />
            <stop offset="100%" stopColor="rgba(120, 90, 40, 0.35)" />
          </radialGradient>
          <radialGradient id={yinDepthId} cx="34%" cy="28%" r="80%">
            <stop offset="0%" stopColor="rgba(255, 255, 255, 0.34)" />
            <stop offset="40%" stopColor="rgba(255, 255, 255, 0.06)" />
            <stop offset="64%" stopColor="rgba(255, 255, 255, 0)" />
            <stop offset="100%" stopColor="rgba(0, 0, 0, 0.4)" />
          </radialGradient>
          <radialGradient id={yinDarkId} cx="30%" cy="24%" r="88%">
            <stop offset="0%" stopColor="rgba(40, 48, 72, 0.98)" />
            <stop offset="48%" stopColor="rgba(16, 22, 38, 0.97)" />
            <stop offset="100%" stopColor="rgba(4, 7, 14, 0.99)" />
          </radialGradient>

          {/* Halos astronómicos */}
          <radialGradient id={goldHaloId} cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="rgba(255, 214, 140, 0.5)" />
            <stop offset="60%" stopColor="rgba(255, 200, 120, 0.12)" />
            <stop offset="100%" stopColor="rgba(255, 200, 120, 0)" />
          </radialGradient>
          <radialGradient id={blueHaloId} cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="rgba(96, 150, 255, 0.42)" />
            <stop offset="60%" stopColor="rgba(80, 130, 240, 0.1)" />
            <stop offset="100%" stopColor="rgba(80, 130, 240, 0)" />
          </radialGradient>

          <filter id={shadowId} filterUnits="userSpaceOnUse" x="-260" y="-260" width="1240" height="1240">
            <feDropShadow dx="0" dy="14" stdDeviation="16" floodColor="rgba(0,0,0,0.55)" />
          </filter>
          <filter id={softGlowId} filterUnits="userSpaceOnUse" x="-260" y="-260" width="1240" height="1240">
            <feGaussianBlur stdDeviation={3.2 * scale} result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <filter id={markerGlowId} filterUnits="userSpaceOnUse" x="-260" y="-260" width="1240" height="1240">
            <feGaussianBlur stdDeviation={2.4 * scale} result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Halo dorado superior y halo azul inferior */}
        <g style={{ mixBlendMode: 'screen' }}>
          <ellipse cx={cx} cy={cy - rGoldOuter * 0.62} rx={rGoldOuter * 1.1} ry={rGoldOuter * 0.8} fill={`url(#${goldHaloId})`} />
          <ellipse cx={cx} cy={cy + rGoldOuter * 0.62} rx={rGoldOuter * 1.1} ry={rGoldOuter * 0.8} fill={`url(#${blueHaloId})`} />
        </g>

        {/* Aro exterior luminoso integrado */}
        <g filter={`url(#${softGlowId})`}>
          <circle cx={cx} cy={cy} r={rGoldOuter + 7 * scale} fill="none" stroke="rgba(150, 180, 240, 0.22)" strokeWidth={1.5 * scale} />
        </g>

        {/* Aro dorado (estética 3D) */}
        <g filter={`url(#${shadowId})`}>
          <circle cx={cx} cy={cy} r={rGoldOuter} fill="none" stroke={`url(#${goldId})`} strokeWidth={rGoldOuter - rGoldInner} />
          <circle cx={cx} cy={cy} r={rGoldOuter} fill="none" stroke={`url(#${goldRimId})`} strokeWidth={(rGoldOuter - rGoldInner) * 0.5} opacity="0.85" />
        </g>

        {/* Disco base inmediatamente debajo del aro dorado (sin huecos) */}
        <circle cx={cx} cy={cy} r={rGoldInner} fill={`url(#${innerDiskId})`} />

        {/* Polígono civil (24 lados) con highlight por trozo */}
        <g className="geo2-civil">
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
                  fill={isActive ? 'rgba(118, 170, 255, 0.16)' : 'rgba(14, 20, 36, 0.34)'}
                  stroke={isActive ? 'rgba(128, 196, 255, 0.55)' : 'rgba(150, 180, 230, 0.07)'}
                  strokeWidth="1"
                />
                <text
                  x={x}
                  y={y}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  className={['geo2-civil-number', isActive ? 'is-active' : ''].filter(Boolean).join(' ')}
                  filter={isActive ? `url(#${markerGlowId})` : undefined}
                >
                  {n}
                </text>
              </g>
            )
          })}
        </g>

        {/* Aro de color geométrico (24 segmentos) iluminado desde el interior */}
        <g className="geo2-color-ring">
          {geoColors.map((color, i) => {
            const a0 = computeAngleDeg(i - 0.5, direction)
            const a1 = computeAngleDeg(i + 0.5, direction)
            const path = ringSegmentPath(cx, cy, rGeoOuter, rGeoInner, a0, a1, sweepFlag)
            return <path key={i} d={path} fill={color} opacity="0.96" />
          })}

          {/* Sombra interna sutil para dar volumen al aro */}
          <circle
            cx={cx}
            cy={cy}
            r={(rGeoOuter + rGeoInner) / 2}
            fill="none"
            stroke={`url(#${ringSheenId})`}
            strokeWidth={rGeoOuter - rGeoInner}
          />
          <circle cx={cx} cy={cy} r={rGeoOuter} fill="none" stroke="rgba(0,0,0,0.28)" strokeWidth={1.5 * scale} />
          <circle cx={cx} cy={cy} r={rGeoInner} fill="none" stroke="rgba(0,0,0,0.32)" strokeWidth={1.5 * scale} />

          {/* Marcadores horarios luminosos (0,3,6,9,12,15,18,21) */}
          {geoLabels.map((h) => {
            const angle = computeAngleDeg(h, direction)
            const { x, y } = polarToCartesian(cx, cy, rGeoLabel, angle)
            const markerColor = geoColors[((h % 24) + 24) % 24]
            return (
              <g key={h} filter={`url(#${markerGlowId})`}>
                <circle cx={x} cy={y} r={rMarker} fill="rgba(8, 12, 22, 0.7)" stroke={markerColor} strokeWidth={1.6 * scale} />
                <circle cx={x} cy={y} r={rMarker} fill="none" stroke="rgba(255,255,255,0.28)" strokeWidth={0.8 * scale} />
                <text
                  x={x}
                  y={y}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  className="geo2-hour-label"
                >
                  {geoLabelText(h)}
                </text>
              </g>
            )
          })}
        </g>

        {/* Aro negro con borde suave */}
        <circle
          cx={cx}
          cy={cy}
          r={(rBlackRingOuter + rBlackRingInner) / 2}
          fill="none"
          stroke="rgba(6, 9, 16, 0.94)"
          strokeWidth={rBlackRingOuter - rBlackRingInner}
        />
        <circle cx={cx} cy={cy} r={rBlackRingInner} fill="none" stroke="rgba(150, 180, 240, 0.1)" strokeWidth={1 * scale} />

        {/* Grupo rotatorio (yin-yang + gota/puntero + fase lunar) */}
        <g transform={`rotate(${yinyangRotationDeg} ${cx} ${cy})`} filter={`url(#${shadowId})`}>
          {/* Yin-yang base pulido */}
          <circle cx={cx} cy={cy} r={rYinYang} fill={lightFill} opacity="0.98" stroke="rgba(255,255,255,0.16)" strokeWidth={2 * scale} />
          <circle cx={cx} cy={cy} r={rYinYang} fill={`url(#${yinLightId})`} opacity="0.9" />
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
          <MoonPhaseGlyph cx={cx} cy={cy + rYinYang / 2.1} r={18 * scale} phase={phase} glowId={markerGlowId} />

          {/* Gota/puntero con los minutos geométricos (en la parte clara, punta hacia el exterior) */}
          <g className="geo2-pointer" transform={`translate(${cx} ${cy - rYinYang / 2.15})`}>
            <g transform={`scale(${scale})`}>
              <path
                d="M 0 -26 C 11 -22 17 -14 17 -6 C 17 12 5 22 0 28 C -5 22 -17 12 -17 -6 C -17 -14 -11 -22 0 -26 Z"
                transform="rotate(180)"
                fill="rgba(7, 10, 18, 0.94)"
                stroke="rgba(180, 200, 240, 0.28)"
                strokeWidth="1"
              />
              <text
                x="0"
                y="-2"
                textAnchor="middle"
                dominantBaseline="middle"
                className="geo2-pointer-text"
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
