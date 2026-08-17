import { GlassCard, CardLabel } from '../GlassCard.jsx'
import { V2GeometricClock } from '../V2GeometricClock.jsx'
import {
  BlueHourCard,
  GoldenHourCard,
  LunarDataCard,
  SolarDataCard,
} from '../cards/DashboardCards.jsx'
import { DayProgressCard, NextEventCard } from '../DiaPanels.jsx'
import { PageTitle } from '../Placeholder.jsx'

export default function DiaPage() {
  return (
    <main className="flex flex-1 flex-col gap-5">
      <PageTitle
        title="El Día"
        subtitle="Interpretación humana del día actual"
      />

      <div className="grid flex-1 grid-cols-1 gap-5 lg:grid-cols-[1fr_300px]">
        <div className="flex flex-col gap-5">
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_1.2fr]">
            <GlassCard className="relative flex min-h-[320px] items-center justify-center !p-4">
              <CardLabel className="absolute left-4 top-4 z-10">Reloj geométrico</CardLabel>
              <V2GeometricClock className="h-full min-h-[280px] w-full select-none drop-shadow-[0_24px_60px_oklch(0_0_0/0.55)]" />
            </GlassCard>

            <div className="flex flex-col gap-4">
              <DayProgressCard />
              <NextEventCard />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <GoldenHourCard />
            <BlueHourCard />
          </div>
        </div>

        <div className="flex flex-col gap-4">
          <SolarDataCard />
          <LunarDataCard />
        </div>
      </div>
    </main>
  )
}
