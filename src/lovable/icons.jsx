/** @type {import('react')} */

const base = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.6,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  viewBox: '0 0 24 24',
}

export function SunIcon(props) {
  return (
    <svg {...base} {...props}>
      <circle cx="12" cy="12" r="3.6" />
      <path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M5.6 18.4 7 17M17 7l1.4-1.4" />
    </svg>
  )
}

export function SunriseIcon(props) {
  return (
    <svg {...base} {...props}>
      <path d="M4 18h16" />
      <path d="M7 14a5 5 0 0 1 10 0" />
      <path d="M12 4v4M5.6 8.6 7 10M18.4 8.6 17 10M3 21h18" />
    </svg>
  )
}

export function SunsetIcon(props) {
  return (
    <svg {...base} {...props}>
      <path d="M4 18h16" />
      <path d="M7 14a5 5 0 0 1 10 0" />
      <path d="M12 8V4M5.6 8.6 7 10M18.4 8.6 17 10M3 21h18" />
      <path d="m9 6 3 3 3-3" />
    </svg>
  )
}

export function MoonIcon(props) {
  return (
    <svg {...base} {...props}>
      <path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5Z" />
    </svg>
  )
}

export function MoonPhaseIcon({ phase = 0.34, ...props }) {
  const r = 10
  const rx = Math.abs(0.5 - phase) * 2 * r
  const waxing = phase < 0.5
  return (
    <svg {...base} {...props}>
      <circle cx="12" cy="12" r={r} stroke="currentColor" fill="none" opacity="0.35" />
      <path
        d={`M 12 ${12 - r} A ${rx} ${r} 0 0 ${waxing ? 0 : 1} 12 ${12 + r} A ${r} ${r} 0 0 ${waxing ? 0 : 1} 12 ${12 - r} Z`}
        fill="currentColor"
        stroke="none"
        opacity="0.9"
      />
    </svg>
  )
}

export function LocationIcon(props) {
  return (
    <svg {...base} {...props}>
      <path d="M12 21s-7-7.5-7-12a7 7 0 0 1 14 0c0 4.5-7 12-7 12Z" />
      <circle cx="12" cy="9" r="2.5" />
    </svg>
  )
}

export function SearchIcon(props) {
  return (
    <svg {...base} {...props}>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </svg>
  )
}

export function GlobeIcon(props) {
  return (
    <svg {...base} {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18" />
      <path d="M12 3c2.5 2.4 3.9 5.6 4 9-0.1 3.4-1.5 6.6-4 9-2.5-2.4-3.9-5.6-4-9 0.1-3.4 1.5-6.6 4-9Z" />
    </svg>
  )
}

export function SettingsIcon(props) {
  return (
    <svg {...base} {...props}>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z" />
    </svg>
  )
}

export function ChevronDownIcon(props) {
  return (
    <svg {...base} {...props}>
      <path d="m6 9 6 6 6-6" />
    </svg>
  )
}

export function LogoIcon(props) {
  return (
    <svg {...base} {...props} strokeWidth={1.4}>
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="4.5" />
      <path d="M12 3v18M3 12h18" opacity="0.5" />
    </svg>
  )
}
