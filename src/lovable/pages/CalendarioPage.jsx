import Calendar from '../../components/Calendar.jsx'
import CalendarInfo from '../../components/CalendarInfo.jsx'
import { useWatch } from '../../context/WatchContext.jsx'
import { CelestialPreviewCard } from '../CelestialPreview.jsx'
import { GlassCard, CardLabel } from '../GlassCard.jsx'
import { SeasonCard } from '../SeasonCard.jsx'
import { PlaceholderPanel, PageTitle } from '../Placeholder.jsx'

const SEASON_KEYS = {
  Primavera: 'primavera',
  Verano: 'verano',
  Otoño: 'otono',
  Invierno: 'invierno',
}

export default function CalendarioPage() {
  const {
    location,
    calendarMonth,
    setCalendarMonth,
    selectedDate,
    setSelectedDate,
    calendarDayData,
    timezoneLabel,
  } = useWatch()

  const seasonKey = SEASON_KEYS[calendarDayData?.season] ?? 'otono'

  return (
    <main className="grid flex-1 grid-cols-1 gap-5 lg:grid-cols-[1fr_300px]">
      <div className="flex flex-col gap-5">
        <PageTitle
          title="Calendario Solar"
          subtitle="Explora fechas y ciclos de luz"
        />

        <GlassCard>
          <CardLabel>Calendario principal</CardLabel>
          <div className="mt-4">
            <Calendar
              timezone={location.timezone}
              monthCursor={calendarMonth}
              selectedDate={selectedDate.setZone(location.timezone)}
              onMonthChange={(nextMonth) => setCalendarMonth(nextMonth.startOf('month'))}
              onSelectDate={(date) => setSelectedDate(date.startOf('day'))}
              onJumpToDate={(date) => {
                setSelectedDate(date.startOf('day'))
                setCalendarMonth(date.startOf('month'))
              }}
            />
          </div>
        </GlassCard>

        <PlaceholderPanel
          label="Comparación entre fechas"
          minHeight="min-h-[140px]"
          hint="Comparar duración del día entre dos fechas"
        />
      </div>

      <div className="flex flex-col gap-4">
        <GlassCard>
          <CardLabel>Información del día</CardLabel>
          <div className="mt-4">
            <CalendarInfo dayData={calendarDayData} timezoneLabel={timezoneLabel} />
          </div>
        </GlassCard>

        <SeasonCard current={seasonKey} />
        <CelestialPreviewCard />
      </div>
    </main>
  )
}
