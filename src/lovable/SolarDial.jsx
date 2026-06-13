import { MoonPhaseIcon } from './icons.jsx'

/**
 * Astronomical solar dial — visually splits day (warm arc, progressive glow)
 * from night (cool, dim arc), with a bright sun on the daylight path.
 * @param {{ dayProgress?: number }} props
 */
export function SolarDial({ dayProgress = 0.68 }) {
  const size = 560
  const cx = size / 2
  const cy = size / 2
  const ringOuter = 250
  const ringInner = 215

  const progress = Math.min(Math.max(dayProgress, 0), 1)

  // Sun angle: sunrise at -180°, noon at -90°, sunset at 0°
  const sunAngle = -180 + progress * 180
  const sunRad = (sunAngle * Math.PI) / 180
  const sunR = (ringOuter + ringInner) / 2
  const sunX = cx + Math.cos(sunRad) * sunR
  const sunY = cy + Math.sin(sunRad) * sunR

  // Moon at opposite
  const moonAngle = sunAngle + 180
  const moonRad = (moonAngle * Math.PI) / 180
  const moonX = cx + Math.cos(moonRad) * sunR
  const moonY = cy + Math.sin(moonRad) * sunR

  const arcPath = (start, end, r) => {
    const s = (start * Math.PI) / 180
    const e = (end * Math.PI) / 180
    const x1 = cx + Math.cos(s) * r
    const y1 = cy + Math.sin(s) * r
    const x2 = cx + Math.cos(e) * r
    const y2 = cy + Math.sin(e) * r
    const large = end - start > 180 ? 1 : 0
    return `M ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2}`
  }

  // Day completed arc circumference for stroke-dash trick
  const dayCirc = Math.PI * ringOuter // half-circle length
  const dayDone = dayCirc * progress

  // tick marks around outer ring
  const ticks = Array.from({ length: 96 }, (_, i) => {
    const a = (i / 96) * Math.PI * 2 - Math.PI / 2
    const r1 = ringOuter + 14
    const r2 = ringOuter + (i % 4 === 0 ? 24 : 18)
    const isDaySide = Math.sin(a) < 0 // top half = day
    return {
      x1: cx + Math.cos(a) * r1,
      y1: cy + Math.sin(a) * r1,
      x2: cx + Math.cos(a) * r2,
      y2: cy + Math.sin(a) * r2,
      strong: i % 4 === 0,
      day: isDaySide,
    }
  })

  return (
    <div className="relative flex items-center justify-center" style={{ aspectRatio: '1 / 1' }}>
      <svg
        viewBox={`0 0 ${size} ${size}`}
        className="h-full w-full max-h-[640px] max-w-[640px]"
        role="img"
        aria-label="Solar dial"
      >
        <defs>
          <linearGradient id="dayBase" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="oklch(0.7 0.13 65)" stopOpacity="0.18" />
            <stop offset="100%" stopColor="oklch(0.7 0.13 65)" stopOpacity="0.18" />
          </linearGradient>
          <linearGradient id="dayDone" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="oklch(0.7 0.16 50)" stopOpacity="0.6" />
            <stop offset="55%" stopColor="oklch(0.88 0.17 75)" stopOpacity="1" />
            <stop offset="100%" stopColor="oklch(0.95 0.15 85)" stopOpacity="1" />
          </linearGradient>
          <linearGradient id="nightArc" x1="1" y1="0" x2="0" y2="0">
            <stop offset="0%" stopColor="oklch(0.42 0.1 258)" stopOpacity="0.55" />
            <stop offset="100%" stopColor="oklch(0.32 0.08 270)" stopOpacity="0.3" />
          </linearGradient>

          <radialGradient id="centerGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="oklch(0.28 0.06 260)" stopOpacity="0.8" />
            <stop offset="100%" stopColor="oklch(0.15 0.04 265)" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="dayHaze" cx="50%" cy="100%" r="60%">
            <stop offset="0%" stopColor="oklch(0.85 0.15 70)" stopOpacity="0.18" />
            <stop offset="100%" stopColor="oklch(0.85 0.15 70)" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="nightHaze" cx="50%" cy="0%" r="60%">
            <stop offset="0%" stopColor="oklch(0.4 0.12 265)" stopOpacity="0.18" />
            <stop offset="100%" stopColor="oklch(0.4 0.12 265)" stopOpacity="0" />
          </radialGradient>

          <radialGradient id="sunGrad" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="oklch(0.99 0.04 90)" />
            <stop offset="35%" stopColor="oklch(0.92 0.15 80)" />
            <stop offset="75%" stopColor="oklch(0.82 0.17 65)" />
            <stop offset="100%" stopColor="oklch(0.68 0.18 55)" />
          </radialGradient>
          <radialGradient id="sunCorona" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="oklch(0.9 0.17 75)" stopOpacity="0.55" />
            <stop offset="60%" stopColor="oklch(0.85 0.17 75)" stopOpacity="0.12" />
            <stop offset="100%" stopColor="oklch(0.85 0.17 75)" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* Background hazes */}
        <ellipse cx={cx} cy={cy} rx={ringOuter} ry={ringOuter * 0.6} fill="url(#dayHaze)" />
        <ellipse cx={cx} cy={cy} rx={ringOuter} ry={ringOuter * 0.6} fill="url(#nightHaze)" />

        {/* Center diffuse glow */}
        <circle cx={cx} cy={cy} r={ringOuter} fill="url(#centerGlow)" />

        {/* Slow rotating decorative ring */}
        <g className="animate-slow-spin" style={{ transformOrigin: `${cx}px ${cy}px` }}>
          <circle cx={cx} cy={cy} r={ringInner - 20} fill="none"
            stroke="oklch(0.7 0.05 250 / 0.08)" strokeWidth={0.5} strokeDasharray="1 6" />
          <circle cx={cx} cy={cy} r={ringInner - 50} fill="none"
            stroke="oklch(0.7 0.05 250 / 0.06)" strokeWidth={0.5} strokeDasharray="1 10" />
        </g>

        {/* Inner concentric rings */}
        {[ringInner - 80, ringInner - 110, ringInner - 140, ringInner - 165].map((r, i) => (
          <circle key={i} cx={cx} cy={cy} r={r} fill="none"
            stroke="oklch(0.7 0.05 250 / 0.07)" strokeWidth={0.6} />
        ))}

        {/* Cross axis */}
        <line x1={cx - ringInner + 30} y1={cy} x2={cx + ringInner - 30} y2={cy}
          stroke="oklch(0.85 0.05 250 / 0.1)" strokeWidth={0.6} />
        <line x1={cx} y1={cy - ringInner + 30} x2={cx} y2={cy + ringInner - 30}
          stroke="oklch(0.85 0.05 250 / 0.1)" strokeWidth={0.6} />

        {/* Tick marks */}
        {ticks.map((t, i) => (
          <line
            key={i}
            x1={t.x1} y1={t.y1} x2={t.x2} y2={t.y2}
            stroke={
              t.day
                ? t.strong ? 'oklch(0.85 0.1 80 / 0.55)' : 'oklch(0.85 0.1 80 / 0.2)'
                : t.strong ? 'oklch(0.75 0.05 260 / 0.45)' : 'oklch(0.75 0.05 260 / 0.15)'
            }
            strokeWidth={t.strong ? 1 : 0.6}
            strokeLinecap="round"
          />
        ))}

        {/* DAY TRAJECTORY */}
        <path d={arcPath(-180, 0, ringOuter)} stroke="oklch(0.85 0.15 75 / 0.12)"
          strokeWidth={10} fill="none" strokeLinecap="round" />
        <path d={arcPath(-180, 0, ringOuter)} stroke="oklch(0.85 0.17 75 / 0.06)"
          strokeWidth={22} fill="none" strokeLinecap="round" />
        <path
          d={arcPath(-180, 0, ringOuter)}
          stroke="url(#dayDone)"
          strokeWidth={10}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={`${dayDone} ${dayCirc}`}
          style={{ filter: 'drop-shadow(0 0 10px oklch(0.85 0.17 75 / 0.55))' }}
        />
        <path
          d={arcPath(-180, 0, ringInner)}
          stroke="oklch(0.9 0.16 70 / 0.7)"
          strokeWidth={2.2}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={`${Math.PI * ringInner * progress} ${Math.PI * ringInner}`}
        />
        <path d={arcPath(-180, 0, ringInner)} stroke="oklch(0.85 0.1 75 / 0.12)"
          strokeWidth={1.2} fill="none" strokeLinecap="round" />

        {/* NIGHT TRAJECTORY */}
        <path d={arcPath(0, 180, ringOuter)} stroke="url(#nightArc)"
          strokeWidth={6} fill="none" strokeLinecap="round" />
        <path d={arcPath(0, 180, ringInner)} stroke="oklch(0.55 0.14 258 / 0.4)"
          strokeWidth={1.4} fill="none" strokeLinecap="round" strokeDasharray="3 6" />

        {/* Horizon divider */}
        <line x1={cx - ringOuter - 12} y1={cy} x2={cx + ringOuter + 12} y2={cy}
          stroke="oklch(0.85 0.05 250 / 0.25)" strokeWidth={0.8} strokeDasharray="2 4" />
        <text x={cx - ringOuter - 18} y={cy + 4} textAnchor="end" fontSize="9"
          fill="oklch(0.85 0.1 75 / 0.55)" fontFamily="ui-monospace, monospace"
          letterSpacing="2">AMANECER</text>
        <text x={cx + ringOuter + 18} y={cy + 4} textAnchor="start" fontSize="9"
          fill="oklch(0.75 0.12 258 / 0.55)" fontFamily="ui-monospace, monospace"
          letterSpacing="2">ATARDECER</text>

        {/* Vertical dividers */}
        <line x1={cx} y1={cy - ringOuter - 20} x2={cx} y2={cy - ringInner + 35}
          stroke="oklch(0.85 0.1 75 / 0.35)" strokeWidth={0.8} />
        <line x1={cx} y1={cy + ringInner - 35} x2={cx} y2={cy + ringOuter + 20}
          stroke="oklch(0.55 0.14 258 / 0.3)" strokeWidth={0.8} />

        {/* Center dot */}
        <circle cx={cx} cy={cy} r={14} fill="oklch(0.12 0.03 268)"
          stroke="oklch(0.7 0.05 250 / 0.3)" />

        {/* Moon */}
        <g transform={`translate(${moonX - 14}, ${moonY - 14})`} opacity={0.85}>
          <circle cx={14} cy={14} r={16} fill="oklch(0.55 0.14 258 / 0.12)" />
          <circle cx={14} cy={14} r={13} fill="oklch(0.2 0.04 265)"
            stroke="oklch(0.7 0.05 250 / 0.35)" />
          <MoonPhaseIcon width={28} height={28} phase={0.34} />
        </g>

        {/* Sun */}
        <g transform={`translate(${sunX}, ${sunY})`} className="animate-sun-glow">
          <circle r={56} fill="url(#sunCorona)" />
          <circle r={34} fill="url(#sunCorona)" opacity={0.8} />
          <circle r={20} fill="url(#sunGrad)" />
          <circle r={20} fill="none" stroke="oklch(0.99 0.04 90 / 0.55)" strokeWidth={0.6} />
          <circle r={28} fill="none" stroke="oklch(0.85 0.17 75 / 0.35)" strokeWidth={0.6} />
        </g>
      </svg>
    </div>
  )
}
