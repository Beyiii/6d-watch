import { cn } from './lib/utils.js'

export function GlassCard({ className, children, ...props }) {
  return (
    <div
      className={cn(
        'glass glass-hover rounded-2xl p-5 text-card-foreground',
        className,
      )}
      {...props}
    >
      {children}
    </div>
  )
}

export function CardLabel({ children, className }) {
  return (
    <p
      className={cn(
        'text-[0.7rem] font-medium uppercase tracking-[0.18em] text-muted-foreground',
        className,
      )}
    >
      {children}
    </p>
  )
}
