const DEFAULT_EPSILON = 0.005

function formatNumber(value) {
  const rounded = Math.round(value * 1000) / 1000
  return Object.is(rounded, -0) ? '0' : String(rounded)
}

export function normalizeMoonPhase(phase) {
  const value = Number(phase)
  if (!Number.isFinite(value)) return 0
  return ((value % 1) + 1) % 1
}

export function isNewMoonPhase(phase, epsilon = DEFAULT_EPSILON) {
  const p = normalizeMoonPhase(phase)
  return p < epsilon || p > 1 - epsilon
}

export function isFullMoonPhase(phase, epsilon = DEFAULT_EPSILON) {
  return Math.abs(normalizeMoonPhase(phase) - 0.5) < epsilon
}

export function buildCirclePath(cx, cy, r) {
  const x = formatNumber(cx)
  const topY = formatNumber(cy - r)
  const bottomY = formatNumber(cy + r)
  const radius = formatNumber(r)

  return [
    `M ${x} ${topY}`,
    `A ${radius} ${radius} 0 1 1 ${x} ${bottomY}`,
    `A ${radius} ${radius} 0 1 1 ${x} ${topY}`,
    'Z',
  ].join(' ')
}

export function buildMoonPhasePath(phase, options = {}) {
  const {
    cx = 12,
    cy = 12,
    r = 10,
    hemisphere = 'north',
    epsilon = DEFAULT_EPSILON,
  } = options

  const p = normalizeMoonPhase(phase)

  if (isNewMoonPhase(p, epsilon)) return ''
  if (isFullMoonPhase(p, epsilon)) return buildCirclePath(cx, cy, r)

  const rx = Math.max(0.01, Math.abs(Math.cos(p * Math.PI * 2)) * r)
  const waxing = p < 0.5
  const isSouth = hemisphere === 'south'
  const lightOnRight = isSouth ? !waxing : waxing

  const isCrescent = p < 0.25 || p > 0.75
  const outerSweep = lightOnRight ? 1 : 0
  const terminatorSweep = isCrescent ? (1 - outerSweep) : outerSweep

  const x = formatNumber(cx)
  const topY = formatNumber(cy - r)
  const bottomY = formatNumber(cy + r)
  const radius = formatNumber(r)
  const terminatorRx = formatNumber(rx)

  return [
    `M ${x} ${topY}`,
    `A ${radius} ${radius} 0 0 ${outerSweep} ${x} ${bottomY}`,
    `A ${terminatorRx} ${radius} 0 0 ${terminatorSweep} ${x} ${topY}`,
    'Z',
  ].join(' ')
}
