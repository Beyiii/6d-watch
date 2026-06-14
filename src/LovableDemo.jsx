import { useEffect, useRef, useState } from 'react'
import { StarField } from './lovable/StarField.jsx'
import { GlassCard, CardLabel } from './lovable/GlassCard.jsx'
import { SolarDial } from './lovable/SolarDial.jsx'
import { SolarArc } from './lovable/SolarArc.jsx'
import { AppSidebar } from './lovable/Sidebar.jsx'
import { SeasonCard } from './lovable/SeasonCard.jsx'
import { CelestialPreviewCard } from './lovable/CelestialPreview.jsx'
import {
  ChevronDownIcon,
  GlobeIcon,
  LocationIcon,
  LogoIcon,
  MoonPhaseIcon,
  SearchIcon,
  SettingsIcon,
  SunIcon,
  SunriseIcon,
  SunsetIcon,
} from './lovable/icons.jsx'
import './lovable/styles.css'

export default function LovableDemo() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [section, setSection] = useState('reloj')

  useEffect(() => {
    document.documentElement.classList.add('lovable-route')
    document.body.classList.add('lovable-route')
    return () => {
      document.documentElement.classList.remove('lovable-route')
      document.body.classList.remove('lovable-route')
    }
  }, [])

  return (
    <div className="lovable-root relative min-h-screen w-full text-foreground">
      <StarField />

      <AppSidebar
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        active={section}
        onSelect={(k) => {
          setSection(k)
          setSidebarOpen(false)
        }}
      />

      <div className="mx-auto flex min-h-screen max-w-[1500px] flex-col gap-6 px-4 py-6 lg:px-8">
        <Header onOpenSidebar={() => setSidebarOpen(true)} />

        <main className="grid flex-1 grid-cols-1 gap-5 lg:grid-cols-[280px_1fr_300px]">
          <div className="flex flex-col gap-4">
            <CurrentDayCard />
            <CivilTimeCard />
            <GeometricTimeCard />
            <div className="grid grid-cols-2 gap-3">
              <SunTimeCard
                label="Amanecer"
                time="07:37"
                icon={<SunriseIcon className="h-5 w-5 text-sun" />}
              />
              <SunTimeCard
                label="Atardecer"
                time="17:40"
                icon={<SunsetIcon className="h-5 w-5 text-golden" />}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <DurationCard label="Duración del día" value="10h 03m" />
              <DurationCard label="Duración de la noche" value="13h 57m" />
            </div>
            <SeasonCard current="otono" />
          </div>

          <div className="flex flex-col gap-5">
            <GlassCard className="relative flex flex-1 items-center justify-center !p-6">
              <LocationManager />
              <img
                src="/reloj-figma-adaptado.svg"
                alt="Reloj astronómico de 24 horas"
                className="h-auto w-full max-w-[520px] select-none drop-shadow-[0_24px_60px_oklch(0_0_0/0.55)]"
                draggable={false}
              />
            </GlassCard>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <GoldenHourCard />
              <BlueHourCard />
            </div>
          </div>

          <div className="flex flex-col gap-4">
            <LocationCard />
            <SolarDataCard />
            <LunarDataCard />
            <CelestialPreviewCard />
          </div>
        </main>

        <GlassCard className="flex items-center justify-center !p-6">
          <SolarDial dayProgress={0.686} />
        </GlassCard>
      </div>
    </div>
  )
}

function Header({ onOpenSidebar }) {
  return (
    <header className="flex items-center justify-between gap-4">
      <button
        type="button"
        onClick={onOpenSidebar}
        className="nav-hover group flex items-center gap-3 rounded-full px-2 py-1.5 text-left"
        aria-label="Abrir menú"
      >
        <span className="grid h-10 w-10 place-items-center rounded-full bg-sun/15 text-sun transition-transform group-hover:scale-105">
          <LogoIcon className="h-5 w-5" />
        </span>
        <h1 className="text-xl font-semibold tracking-tight">
          6D<span className="text-muted-foreground">-Watch</span>
        </h1>
      </button>

      <div className="flex items-center gap-2">
        <LanguageMenu />
        <IconButton aria-label="Ajustes">
          <SettingsIcon className="h-4 w-4" />
        </IconButton>
      </div>
    </header>
  )
}

function LanguageMenu() {
  const [open, setOpen] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [visible, setVisible] = useState(false)
  const ref = useRef(null)

  // Keep the menu mounted while it animates in and out.
  useEffect(() => {
    if (open) {
      setMounted(true)
      // Next frame: flip to the visible state to trigger the enter transition.
      const id = requestAnimationFrame(() => setVisible(true))
      return () => cancelAnimationFrame(id)
    }
    setVisible(false)
  }, [open])

  useEffect(() => {
    if (!open) return
    function onPointerDown(e) {
      if (ref.current && !ref.current.contains(e.target)) {
        setOpen(false)
      }
    }
    function onKeyDown(e) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  const languages = [
    { code: 'es', label: 'Español' },
    { code: 'en', label: 'English' },
  ]

  return (
    <div className="relative" ref={ref}>
      <IconButton
        aria-label="Seleccionar idioma"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <GlobeIcon className="h-4 w-4" />
      </IconButton>

      {mounted && (
        <div
          role="menu"
          onTransitionEnd={() => {
            // Unmount only after the closing transition finishes.
            if (!visible) setMounted(false)
          }}
          className={[
            'glass absolute right-0 z-50 mt-2 w-40 origin-top-right overflow-hidden rounded-2xl p-1.5 text-card-foreground',
            'transition-[opacity,transform] duration-150 ease-out',
            visible ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 -translate-y-1 scale-95',
          ].join(' ')}
        >
          {languages.map((lang) => (
            <button
              key={lang.code}
              type="button"
              role="menuitem"
              onClick={() => setOpen(false)}
              className="flex w-full items-center rounded-xl px-3 py-2 text-left text-sm transition-colors hover:bg-white/10"
            >
              {lang.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function IconButton({ children, ...props }) {
  return (
    <button
      type="button"
      className="grid h-10 w-10 place-items-center rounded-full border border-white/10 bg-white/5 text-foreground transition-colors hover:bg-white/10"
      {...props}
    >
      {children}
    </button>
  )
}

const SAVED_LOCATIONS = [
  { id: 'scl', name: 'Santiago, Chile', coords: '33.45° S, 70.66° O', current: true },
  { id: 'mad', name: 'Madrid, España', coords: '40.42° N, 3.70° O' },
  { id: 'nyc', name: 'Nueva York, EE. UU.', coords: '40.71° N, 74.01° O' },
  { id: 'tyo', name: 'Tokio, Japón', coords: '35.68° N, 139.69° E' },
]

const SEARCH_RESULTS = [
  { id: 'lon', name: 'Londres', region: 'Inglaterra, Reino Unido' },
  { id: 'par', name: 'París', region: 'Isla de Francia, Francia' },
  { id: 'syd', name: 'Sídney', region: 'Nueva Gales del Sur, Australia' },
  { id: 'cdmx', name: 'Ciudad de México', region: 'CDMX, México' },
  { id: 'cai', name: 'El Cairo', region: 'Gobernación de El Cairo, Egipto' },
]

function LocationManager() {
  const [open, setOpen] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [visible, setVisible] = useState(false)
  const [showSearch, setShowSearch] = useState(false)
  const ref = useRef(null)

  // Keep the menu mounted while it animates in and out.
  useEffect(() => {
    if (open) {
      setMounted(true)
      const id = requestAnimationFrame(() => setVisible(true))
      return () => cancelAnimationFrame(id)
    }
    setVisible(false)
  }, [open])

  // Reset the secondary panel once the menu is fully closed.
  useEffect(() => {
    if (!open) {
      const id = setTimeout(() => setShowSearch(false), 200)
      return () => clearTimeout(id)
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    function onPointerDown(e) {
      if (ref.current && !ref.current.contains(e.target)) {
        setOpen(false)
      }
    }
    function onKeyDown(e) {
      if (e.key === 'Escape') {
        if (showSearch) setShowSearch(false)
        else setOpen(false)
      }
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open, showSearch])

  return (
    <div className="absolute left-4 top-4 z-30" ref={ref}>
      <button
        type="button"
        aria-label="Administrar ubicación"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="group flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-2 text-sm backdrop-blur-md transition-colors hover:bg-white/10"
      >
        <LocationIcon className="h-4 w-4 text-sun" />
        <span className="hidden font-medium sm:inline">Santiago, Chile</span>
        <ChevronDownIcon
          className={`h-4 w-4 text-muted-foreground transition-transform ${
            open ? 'rotate-180' : ''
          }`}
        />
      </button>

      {mounted && (
        <div
          className={[
            'absolute left-0 top-full mt-2 flex items-start gap-2',
            'transition-[opacity,transform] duration-150 ease-out',
            visible ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 -translate-y-1 scale-95',
          ].join(' ')}
          onTransitionEnd={() => {
            if (!visible) setMounted(false)
          }}
        >
          {/* Main panel: saved locations */}
          <div
            role="menu"
            className="glass w-64 origin-top-left overflow-hidden rounded-2xl p-2 text-card-foreground"
          >
            <p className="px-2 pb-1.5 pt-1 text-[0.7rem] uppercase tracking-wider text-muted-foreground">
              Ubicaciones guardadas
            </p>
            <div className="space-y-0.5">
              {SAVED_LOCATIONS.map((loc) => (
                <button
                  key={loc.id}
                  type="button"
                  role="menuitem"
                  onClick={() => setOpen(false)}
                  className="flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left transition-colors hover:bg-white/10"
                >
                  <LocationIcon
                    className={`h-4 w-4 shrink-0 ${loc.current ? 'text-sun' : 'text-muted-foreground'}`}
                  />
                  <span className="flex min-w-0 flex-col leading-tight">
                    <span className="truncate text-sm font-medium">{loc.name}</span>
                    <span className="truncate text-[0.7rem] text-muted-foreground">
                      {loc.coords}
                    </span>
                  </span>
                  {loc.current && (
                    <span className="ml-auto h-1.5 w-1.5 shrink-0 rounded-full bg-sun shadow-[0_0_6px] shadow-sun" />
                  )}
                </button>
              ))}
            </div>

            <div className="mt-2 border-t border-white/10 pt-2">
              <button
                type="button"
                onClick={() => setShowSearch((v) => !v)}
                aria-expanded={showSearch}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-sun/15 px-3 py-2 text-sm font-medium text-sun transition-colors hover:bg-sun/25"
              >
                <PlusIcon className="h-4 w-4" />
                Agregar ubicación
              </button>
            </div>
          </div>

          {/* Secondary panel: city search (slides in to the right of the main menu) */}
          {showSearch && (
            <LocationSearchPanel onClose={() => setShowSearch(false)} />
          )}
        </div>
      )}
    </div>
  )
}

function LocationSearchPanel({ onClose }) {
  const [shown, setShown] = useState(false)

  useEffect(() => {
    const id = requestAnimationFrame(() => setShown(true))
    return () => cancelAnimationFrame(id)
  }, [])

  return (
    <div
      className={[
        'glass w-64 origin-top-left overflow-hidden rounded-2xl p-2 text-card-foreground',
        'transition-[opacity,transform] duration-150 ease-out',
        shown ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-2',
      ].join(' ')}
    >
      <div className="flex items-center justify-between px-2 pb-1.5 pt-1">
        <p className="text-[0.7rem] uppercase tracking-wider text-muted-foreground">
          Agregar ubicación
        </p>
        <button
          type="button"
          onClick={onClose}
          aria-label="Cerrar búsqueda"
          className="grid h-6 w-6 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-white/10 hover:text-foreground"
        >
          <CloseIcon className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="relative">
        <SearchIcon className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          type="text"
          placeholder="Buscar ciudad, región o país"
          className="w-full rounded-xl border border-white/10 bg-white/5 py-2 pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground/70 focus:border-sun/40 focus:outline-none focus:ring-1 focus:ring-sun/30"
        />
      </div>

      <div className="mt-2 space-y-0.5">
        {SEARCH_RESULTS.map((res) => (
          <button
            key={res.id}
            type="button"
            className="flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left transition-colors hover:bg-white/10"
          >
            <LocationIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
            <span className="flex min-w-0 flex-col leading-tight">
              <span className="truncate text-sm font-medium">{res.name}</span>
              <span className="truncate text-[0.7rem] text-muted-foreground">{res.region}</span>
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}

function PlusIcon(props) {
  return (
    <svg
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      viewBox="0 0 24 24"
      {...props}
    >
      <path d="M12 5v14M5 12h14" />
    </svg>
  )
}

function CloseIcon(props) {
  return (
    <svg
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      viewBox="0 0 24 24"
      {...props}
    >
      <path d="M6 6l12 12M18 6 6 18" />
    </svg>
  )
}

function CurrentDayCard() {
  return (
    <GlassCard>
      <CardLabel>Día actual</CardLabel>
      <p className="mt-2 text-xl font-medium">19 de mayo de 2025</p>
      <p className="text-sm text-muted-foreground">Lunes</p>
    </GlassCard>
  )
}

function CivilTimeCard() {
  return (
    <GlassCard>
      <CardLabel>Hora civil</CardLabel>
      <p className="mt-2 font-mono text-4xl font-light tracking-tight tabular-nums">
        18:42<span className="text-2xl text-muted-foreground">:15</span>
      </p>
    </GlassCard>
  )
}

function GeometricTimeCard() {
  return (
    <GlassCard>
      <CardLabel className="text-sun/80">Hora geométrica</CardLabel>
      <p className="mt-2 font-mono text-4xl font-light tabular-nums text-sun">17:28</p>
      <div className="mt-3 space-y-1.5">
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">Día</span>
          <span className="text-foreground">68.6%</span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-white/5">
          <div
            className="h-full rounded-full"
            style={{
              width: '68.6%',
              background: 'linear-gradient(90deg, oklch(0.78 0.16 55), oklch(0.88 0.15 80))',
            }}
          />
        </div>
      </div>
    </GlassCard>
  )
}

function SunTimeCard({ label, time, icon }) {
  return (
    <GlassCard className="!p-4">
      <div className="flex items-center gap-2">
        {icon}
        <CardLabel>{label}</CardLabel>
      </div>
      <p className="mt-2 font-mono text-2xl font-light tabular-nums">{time}</p>
    </GlassCard>
  )
}

function DurationCard({ label, value }) {
  return (
    <GlassCard className="!p-4">
      <CardLabel>{label}</CardLabel>
      <p className="mt-2 font-mono text-lg tabular-nums">{value}</p>
    </GlassCard>
  )
}

function GoldenHourCard() {
  return (
    <GlassCard className="!p-5">
      <div className="flex items-center gap-2">
        <span className="h-2 w-2 rounded-full bg-golden shadow-[0_0_8px] shadow-golden" />
        <CardLabel className="text-golden">Golden Hour</CardLabel>
      </div>
      <div className="mt-4 grid grid-cols-3 gap-3 text-center">
        <TimeStat label="Comienza" value="16:53" />
        <TimeStat label="Máxima" value="17:16" highlight="golden" />
        <TimeStat label="Termina" value="17:40" />
      </div>
      <div className="mt-3">
        <SolarArc variant="golden" progress={0.55} />
      </div>
    </GlassCard>
  )
}

function BlueHourCard() {
  return (
    <GlassCard className="!p-5">
      <div className="flex items-center gap-2">
        <span className="h-2 w-2 rounded-full bg-blue-hour shadow-[0_0_8px] shadow-blue-hour" />
        <CardLabel className="text-blue-hour">Blue Hour</CardLabel>
      </div>
      <div className="mt-4 grid grid-cols-3 gap-3 text-center">
        <TimeStat label="Comienza" value="06:59" />
        <TimeStat label="Máxima" value="07:19" highlight="blue" />
        <TimeStat label="Termina" value="07:37" />
      </div>
      <div className="mt-3">
        <SolarArc variant="blue" progress={0.5} />
      </div>
    </GlassCard>
  )
}

function TimeStat({ label, value, highlight }) {
  const color =
    highlight === 'golden'
      ? 'text-golden'
      : highlight === 'blue'
        ? 'text-blue-hour'
        : 'text-foreground'
  return (
    <div>
      <p className="text-[0.7rem] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className={`mt-1 font-mono text-lg tabular-nums ${color}`}>{value}</p>
    </div>
  )
}

function LocationCard() {
  return (
    <GlassCard>
      <CardLabel>Ubicación</CardLabel>
      <div className="relative mt-3 aspect-[16/10] overflow-hidden rounded-xl border border-white/5 bg-white/[0.02]">
        <WorldMapMini />
      </div>
      <button
        type="button"
        className="mt-3 flex w-full items-center justify-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs text-muted-foreground transition-colors hover:bg-white/10 hover:text-foreground"
      >
        <LocationIcon className="h-3.5 w-3.5" />
        Cambiar ubicación
      </button>
    </GlassCard>
  )
}

function SolarDataCard() {
  return (
    <GlassCard>
      <div className="mb-3 flex items-center gap-2">
        <SunIcon className="h-4 w-4 text-sun" />
        <CardLabel className="text-sun/80">Datos solares</CardLabel>
      </div>
      <Row label="Amanecer" value="07:37" />
      <Row label="Atardecer" value="17:40" />
      <Row label="Elevación máxima" value="56.8°" subValue="13:39" />
      <Row label="Duración del día" value="10h 03m" />
      <Row label="Duración de la noche" value="13h 57m" last />
    </GlassCard>
  )
}

function LunarDataCard() {
  return (
    <GlassCard>
      <div className="mb-3 flex items-center gap-2">
        <MoonPhaseIcon className="h-4 w-4 text-moon" phase={0.34} />
        <CardLabel className="text-moon/80">Datos lunares</CardLabel>
      </div>
      <Row label="Fase lunar" value="Cuarto menguante" />
      <Row label="Iluminación" value="34%" />
      <Row label="Salida de la luna" value="21:10" />
      <Row label="Puesta de la luna" value="08:35" last />
    </GlassCard>
  )
}

function Row({ label, value, subValue, last }) {
  return (
    <div
      className={`flex items-center justify-between py-2 ${
        last ? '' : 'border-b border-white/5'
      }`}
    >
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-right">
        <span className="block font-mono text-sm tabular-nums text-foreground">{value}</span>
        {subValue ? (
          <span className="block font-mono text-[0.7rem] text-muted-foreground">{subValue}</span>
        ) : null}
      </span>
    </div>
  )
}

function WorldMapMini() {
  const dots = []
  const rand = (() => {
    let s = 7
    return () => {
      s = (s * 9301 + 49297) % 233280
      return s / 233280
    }
  })()
  for (let i = 0; i < 600; i++) {
    const x = rand() * 100
    const y = rand() * 60
    const inLand =
      (x > 12 && x < 32 && y > 8 && y < 50 && rand() > 0.4) ||
      (x > 42 && x < 58 && y > 6 && y < 50 && rand() > 0.45) ||
      (x > 58 && x < 85 && y > 6 && y < 38 && rand() > 0.5) ||
      (x > 78 && x < 92 && y > 38 && y < 50 && rand() > 0.55)
    if (inLand) dots.push([x, y, 0.4 + rand() * 0.5])
  }
  return (
    <svg viewBox="0 0 100 60" className="absolute inset-0 h-full w-full">
      <rect width="100" height="60" fill="oklch(0.2 0.04 260 / 0.4)" />
      {dots.map(([x, y, o], i) => (
        <circle key={i} cx={x} cy={y} r={0.3} fill="oklch(0.7 0.05 250)" opacity={o} />
      ))}
      <circle cx={22} cy={44} r={3} fill="oklch(0.85 0.17 75)" opacity={0.2} />
      <circle cx={22} cy={44} r={1.4} fill="oklch(0.85 0.17 75)" />
    </svg>
  )
}
