import { GlassCard, CardLabel } from './GlassCard.jsx'
import { Sparkles, Calendar, Wind, Sun, Snowflake } from 'lucide-react'

export function SeasonCard({ current }) {
  const getSeasonDetails = (season) => {
    switch (season.toLowerCase()) {
      case 'verano':
        return {
          name: 'Verano',
          range: '21 Dic - 20 Mar',
          progress: 85,
          color: 'text-orange-400 bg-orange-500/10',
          icon: <Sun className="h-5 w-5 text-orange-400" />,
          desc: 'Días largos y cálidos. Pico solar máximo.',
        }
      case 'invierno':
        return {
          name: 'Invierno',
          range: '21 Jun - 20 Sep',
          progress: 15,
          color: 'text-blue-400 bg-blue-500/10',
          icon: <Snowflake className="h-5 w-5 text-blue-400" />,
          desc: 'Noches largas y frías. Conservación energética.',
        }
      case 'primavera':
        return {
          name: 'Primavera',
          range: '21 Sep - 20 Dic',
          progress: 40,
          color: 'text-emerald-400 bg-emerald-500/10',
          icon: <Sparkles className="h-5 w-5 text-emerald-400" />,
          desc: 'Equilibrio lumínico y florecimiento natural.',
        }
      case 'otono':
      default:
        return {
          name: 'Otoño',
          range: '21 Mar - 20 Jun',
          progress: 68,
          color: 'text-amber-500 bg-amber-500/10',
          icon: <Wind className="h-5 w-5 text-amber-500" />,
          desc: 'Transición equinoccial y descenso gradual del Sol.',
        }
    }
  }

  const details = getSeasonDetails(current)

  return (
    <GlassCard className="relative overflow-hidden group">
      <div className="absolute -right-10 -top-10 h-28 w-28 rounded-full bg-amber-500/10 blur-2xl group-hover:bg-amber-500/20 transition-all duration-500" />

      <div className="flex items-center justify-between">
        <CardLabel>Estación actual</CardLabel>
        <span className={`flex h-8 w-8 items-center justify-center rounded-lg ${details.color}`}>
          {details.icon}
        </span>
      </div>

      <div className="mt-3">
        <h3 className="text-2xl font-semibold tracking-tight">{details.name}</h3>
        <p className="text-xs text-muted-foreground flex items-center gap-1.5 mt-1">
          <Calendar className="h-3 w-3 text-sun" />
          {details.range}
        </p>
      </div>

      <p className="mt-3 text-xs text-muted-foreground/90 leading-relaxed">{details.desc}</p>

      {/* Progress Bar */}
      <div className="mt-4 space-y-1.5">
        <div className="flex items-center justify-between text-[10px]">
          <span className="text-muted-foreground">Progreso de estación</span>
          <span className="font-mono text-foreground font-medium">{details.progress}%</span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-white/5">
          <div
            className="h-full rounded-full bg-gradient-to-r from-amber-600 to-amber-400 transition-all duration-500"
            style={{ width: `${details.progress}%` }}
          />
        </div>
      </div>
    </GlassCard>
  )
}
