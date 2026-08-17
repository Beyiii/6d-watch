/**
 * Semicircular sun trajectory used in Golden Hour / Blue Hour cards.
 * @param {{ progress?: number, variant?: 'golden' | 'blue' }} props
 */
export function SolarArc({ progress = 0.5, variant = 'golden' }) {
  const w = 280
  const h = 70
  const pad = 8
  const path = `M ${pad} ${h - 4} Q ${w / 2} ${-h * 0.4} ${w - pad} ${h - 4}`

  const t = Math.min(Math.max(progress, 0), 1)
  const x = (1 - t) * (1 - t) * pad + 2 * (1 - t) * t * (w / 2) + t * t * (w - pad)
  const y =
    (1 - t) * (1 - t) * (h - 4) + 2 * (1 - t) * t * (-h * 0.4) + t * t * (h - 4)

  const color =
    variant === 'golden'
      ? { stroke: 'oklch(0.78 0.16 55)', glow: 'oklch(0.85 0.17 75)' }
      : { stroke: 'oklch(0.55 0.18 255)', glow: 'oklch(0.7 0.18 250)' }

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-16 w-full">
      <defs>
        <linearGradient id={`arc-fade-${variant}`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor={color.stroke} stopOpacity="0" />
          <stop offset="50%" stopColor={color.stroke} stopOpacity="0.9" />
          <stop offset="100%" stopColor={color.stroke} stopOpacity="0" />
        </linearGradient>
        <radialGradient id={`sun-${variant}`} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor={color.glow} />
          <stop offset="100%" stopColor={color.stroke} stopOpacity="0" />
        </radialGradient>
      </defs>
      <line
        x1={0}
        y1={h - 4}
        x2={w}
        y2={h - 4}
        stroke="oklch(0.85 0.05 250 / 0.2)"
        strokeDasharray="2 4"
      />
      <path d={path} stroke={`url(#arc-fade-${variant})`} strokeWidth={1.4} fill="none" />
      <circle cx={x} cy={y} r={14} fill={`url(#sun-${variant})`} opacity={0.7} />
      <circle cx={x} cy={y} r={4} fill={color.glow} />
    </svg>
  )
}
