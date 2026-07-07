import { cn } from './lib/utils.js'
import { GlassCard, CardLabel } from './GlassCard.jsx'

export function PlaceholderPanel({ label, className, minHeight = 'min-h-[120px]', hint }) {
  return (
    <GlassCard className={className}>
      {label ? <CardLabel>{label}</CardLabel> : null}
      <div
        className={cn(
          'mt-4 flex items-center justify-center rounded-xl border border-dashed border-white/10 bg-white/[0.02]',
          minHeight,
        )}
      >
        <span className="px-4 text-center text-sm text-muted-foreground/50">
          {hint ?? 'Contenido próximamente'}
        </span>
      </div>
    </GlassCard>
  )
}

export function PageTitle({ title, subtitle }) {
  return (
    <div className="mb-1">
      <h2 className="text-2xl font-semibold tracking-tight">{title}</h2>
      {subtitle ? (
        <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
      ) : null}
    </div>
  )
}
