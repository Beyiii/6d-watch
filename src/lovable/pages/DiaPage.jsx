import { useWatch } from '../../context/WatchContext.jsx'
import { GlassCard } from '../GlassCard.jsx'
import { SolarDial } from '../SolarDial.jsx'
import {
  BlueHourCard,
  GoldenHourCard,
  LunarDataCard,
  SolarDataCard,
} from '../cards/DashboardCards.jsx'
import { PlaceholderPanel, PageTitle } from '../Placeholder.jsx'

export default function DiaPage() {
  const { dayProgress } = useWatch()

  return (
    <main className="flex flex-1 flex-col gap-5">
      <PageTitle
        title="El Día"
        subtitle="Interpretación humana del día actual"
      />

      <div className="grid flex-1 grid-cols-1 gap-5 lg:grid-cols-[1fr_300px]">
        <div className="flex flex-col gap-5">
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_1.2fr]">
            <PlaceholderPanel
              label="Reloj geométrico"
              minHeight="min-h-[320px]"
              hint="Visualización del tiempo geométrico del día"
            />
            <div className="flex flex-col gap-4">
              <PlaceholderPanel
                label="Progreso del día"
                minHeight="min-h-[100px]"
                hint="Barra de progreso luz / oscuridad"
              />
              <PlaceholderPanel
                label="Duración de la luz"
                minHeight="min-h-[100px]"
                hint="Horas de luz y oscuridad"
              />
              <div className="grid grid-cols-2 gap-3">
                <PlaceholderPanel
                  label="Amanecer"
                  minHeight="min-h-[88px]"
                  className="!p-4"
                />
                <PlaceholderPanel
                  label="Atardecer"
                  minHeight="min-h-[88px]"
                  className="!p-4"
                />
              </div>
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
          <PlaceholderPanel
            label="Interpretación del día"
            minHeight="min-h-[200px]"
            hint="Resumen y consejo del día"
            className="flex-1"
          />
        </div>
      </div>

      <GlassCard className="flex items-center justify-center !p-6">
        <SolarDial dayProgress={dayProgress} />
      </GlassCard>
    </main>
  )
}
