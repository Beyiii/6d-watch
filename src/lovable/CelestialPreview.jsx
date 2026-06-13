import { GlassCard, CardLabel } from './GlassCard.jsx'
import { Orbit, Star } from 'lucide-react'

export function CelestialPreviewCard() {
  const events = [
    {
      title: 'Solsticio de Invierno',
      date: '21 de Junio',
      time: '10:42',
      type: 'Solsticio',
      highlight: true,
    },
    {
      title: 'Luna de Fresa (Llena)',
      date: '14 de Junio',
      time: '20:15',
      type: 'Luna Llena',
    },
    {
      title: 'Pico de Bootidas',
      date: '27 de Junio',
      time: '02:00',
      type: 'Lluvia de estrellas',
    },
  ]

  return (
    <GlassCard className="relative overflow-hidden group">
      <div className="absolute -left-10 -bottom-10 h-28 w-28 rounded-full bg-blue-hour/10 blur-2xl" />

      <div className="flex items-center gap-2 mb-4">
        <Orbit className="h-4 w-4 text-blue-hour animate-pulse" />
        <CardLabel className="text-blue-hour">Eventos Celestes</CardLabel>
      </div>

      <div className="space-y-3">
        {events.map((event, idx) => (
          <div
            key={idx}
            className="group/item relative flex items-center justify-between p-2.5 rounded-xl border border-white/5 bg-white/[0.01] hover:bg-white/[0.03] hover:border-white/10 transition-all duration-300"
          >
            <div className="flex flex-col gap-0.5">
              <span className="text-xs font-semibold text-foreground flex items-center gap-1">
                {event.highlight && <Star className="h-3 w-3 fill-sun text-sun" />}
                {event.title}
              </span>
              <span className="text-[10px] text-muted-foreground">{event.type}</span>
            </div>
            <div className="text-right">
              <span className="block text-xs font-medium text-foreground">{event.date}</span>
              <span className="block text-[9px] font-mono text-muted-foreground">{event.time}</span>
            </div>
          </div>
        ))}
      </div>
    </GlassCard>
  )
}
