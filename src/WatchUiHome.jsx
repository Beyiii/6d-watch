import { GlassCard } from './watch-ui/GlassCard.jsx'
import { LocationBadge } from './watch-ui/LocationManager.jsx'
import { V2GeometricClock } from './watch-ui/V2GeometricClock.jsx'
import {
  CivilTimeCard,
  CurrentDayCard,
  DurationCards,
  GeometricTimeCard,
  LocationCard,
  MoonPhaseSummaryCard,
  SeasonBadge,
  SolarTrajectoryPlaceholder,
  SunriseSunsetCard,
} from './watch-ui/cards/DashboardCards.jsx'

export default function WatchUiHome() {
  return (
    <main className="
      grid flex-1 gap-4
      grid-cols-1
      lg:grid-cols-[minmax(200px,2fr)_minmax(320px,5.5fr)_minmax(240px,2.5fr)]
      lg:grid-rows-1
      lg:h-[calc(100dvh-7.5rem)]
      lg:max-h-[calc(100dvh-7.5rem)]
      lg:min-h-0
      lg:overflow-visible
    ">
      {/* ── Left column ─────────────────────────────────────────── */}
      <div className="
        grid gap-3 px-1
        lg:min-h-0 lg:overflow-visible
        lg:grid-rows-[auto_auto_1fr_1.4fr_auto]
      ">
        <CurrentDayCard />
        <CivilTimeCard />
        <GeometricTimeCard className="min-h-0" />
        <SunriseSunsetCard className="min-h-0" />
        <div className="grid grid-cols-2 gap-3">
          <DurationCards />
        </div>
      </div>

      {/* ── Centre column ───────────────────────────────────────── */}
      <div className="flex min-h-0 items-stretch px-1 lg:overflow-visible">
        <div className="flex h-full w-full min-h-0 flex-col gap-3">
          <GlassCard className="relative flex min-h-0 flex-[7] items-center justify-center p-4">
            <LocationBadge />
            <SeasonBadge />
            <V2GeometricClock className="h-full w-full min-h-0 select-none drop-shadow-[0_24px_60px_oklch(0_0_0/0.55)]" />
          </GlassCard>

          <SolarTrajectoryPlaceholder className="min-h-0 flex-[3]" />
        </div>
      </div>

      {/* ── Right column ────────────────────────────────────────── */}
      <div className="relative flex min-h-0 flex-1 flex-col gap-3 overflow-visible px-1">
        <LocationCard prominent className="min-h-0 flex-[3.4]" />
        <MoonPhaseSummaryCard className="min-h-0 flex-[1.6]" />
      </div>
    </main>
  )
}

