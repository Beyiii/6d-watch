import { useMemo } from 'react'

function seedRandom(seed) {
  let s = seed
  return () => {
    s = (s * 9301 + 49297) % 233280
    return s / 233280
  }
}

export function StarField({ count = 240 }) {
  const stars = useMemo(() => {
    const rand = seedRandom(42)
    return Array.from({ length: count }, () => {
      const r = rand()
      const size = r < 0.78 ? 0.4 + rand() * 0.5 : r < 0.96 ? 0.8 + rand() * 0.7 : 1.4 + rand() * 1.1
      const bright = r > 0.94
      const tintRoll = rand()
      const tint =
        tintRoll < 0.75
          ? 'white'
          : tintRoll < 0.9
            ? 'oklch(0.9 0.05 250)'
            : 'oklch(0.88 0.08 60)'
      return {
        cx: rand() * 100,
        cy: rand() * 100,
        r: size,
        opacity: bright ? 0.95 : 0.2 + rand() * 0.45,
        dur: 4 + rand() * 8,
        delay: rand() * 8,
        min: 0.1 + rand() * 0.15,
        max: bright ? 1 : 0.5 + rand() * 0.3,
        tint,
      }
    })
  }, [count])

  return (
    <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      {/* Deep space base */}
      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse at 50% -10%, oklch(0.22 0.05 262) 0%, oklch(0.14 0.035 265) 50%, oklch(0.08 0.025 268) 100%)',
        }}
      />

      {/* Atmospheric lights */}
      <div
        className="absolute -top-32 left-[18%] h-[520px] w-[680px] rounded-full opacity-[0.18] blur-3xl animate-drift"
        style={{
          background:
            'radial-gradient(circle, oklch(0.5 0.16 258) 0%, oklch(0.4 0.12 260 / 0.4) 45%, transparent 75%)',
        }}
      />
      <div
        className="absolute top-[40%] right-[8%] h-[420px] w-[520px] rounded-full opacity-[0.13] blur-3xl animate-drift"
        style={{
          background: 'radial-gradient(circle, oklch(0.55 0.14 35) 0%, transparent 70%)',
          animationDelay: '-12s',
        }}
      />
      <div
        className="absolute -bottom-24 left-[5%] h-[400px] w-[600px] rounded-full opacity-[0.12] blur-3xl animate-drift"
        style={{
          background: 'radial-gradient(circle, oklch(0.45 0.14 290) 0%, transparent 70%)',
          animationDelay: '-6s',
        }}
      />

      {/* Dark dust pockets */}
      <div
        className="absolute top-[15%] right-[28%] h-[260px] w-[360px] rounded-full opacity-50 blur-3xl"
        style={{ background: 'radial-gradient(circle, oklch(0.05 0.02 268) 0%, transparent 70%)' }}
      />
      <div
        className="absolute bottom-[15%] right-[40%] h-[220px] w-[300px] rounded-full opacity-40 blur-3xl"
        style={{ background: 'radial-gradient(circle, oklch(0.06 0.02 270) 0%, transparent 70%)' }}
      />

      {/* Noise overlay */}
      <svg className="absolute inset-0 h-full w-full opacity-[0.04] mix-blend-overlay" preserveAspectRatio="none">
        <filter id="lvl-noise">
          <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" stitchTiles="stitch" />
          <feColorMatrix values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 0.6 0" />
        </filter>
        <rect width="100%" height="100%" filter="url(#lvl-noise)" />
      </svg>

      {/* Stars */}
      <div className="absolute inset-0">
        {stars.map((s, i) => {
          const sizePx = s.r * 2
          return (
            <div
              key={i}
              className="absolute rounded-full animate-twinkle"
              style={{
                left: `${s.cx}%`,
                top: `${s.cy}%`,
                width: `${sizePx}px`,
                height: `${sizePx}px`,
                backgroundColor: s.tint,
                opacity: s.opacity,
                transform: 'translate(-50%, -50%)',
                '--tw-dur': `${s.dur}s`,
                '--tw-min': s.min,
                '--tw-max': s.max,
                animationDelay: `${s.delay}s`,
              }}
            />
          )
        })}
      </div>

      {/* Vignette */}
      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse at 50% 50%, transparent 55%, oklch(0.05 0.02 268 / 0.5) 100%)',
        }}
      />
    </div>
  )
}
