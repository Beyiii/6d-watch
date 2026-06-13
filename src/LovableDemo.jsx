import { useEffect, useState } from 'react'
import { StarField } from './lovable/StarField.jsx'
import { GlassCard, CardLabel } from './lovable/GlassCard.jsx'
import { SolarDial } from './lovable/SolarDial.jsx'
import { SolarArc } from './lovable/SolarArc.jsx'
import { AppSidebar } from './lovable/Sidebar.jsx'
import { SeasonCard } from './lovable/SeasonCard.jsx'
import { CelestialPreviewCard } from './lovable/CelestialPreview.jsx'
import {
  ChevronDownIcon,
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
            <GlassCard className="flex flex-1 items-center justify-center !p-6">
              <SolarDial dayProgress={0.686} />
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

      <button
        type="button"
        className="group flex items-center gap-2 rounded-full px-3 py-2 text-sm transition-colors hover:bg-white/5"
      >
        <LocationIcon className="h-4 w-4 text-sun" />
        <div className="flex flex-col items-start leading-tight">
          <span className="font-medium">Santiago, Chile</span>
          <span className="text-[0.7rem] text-muted-foreground">33.45° S, 70.66° O</span>
        </div>
        <ChevronDownIcon className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-y-0.5" />
      </button>

      <div className="flex items-center gap-2">
        <IconButton aria-label="Buscar">
          <SearchIcon className="h-4 w-4" />
        </IconButton>
        <IconButton aria-label="Ajustes">
          <SettingsIcon className="h-4 w-4" />
        </IconButton>
      </div>
    </header>
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
