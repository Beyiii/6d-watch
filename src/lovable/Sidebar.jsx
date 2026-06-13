import { cn } from './lib/utils.js'
import {
  SunIcon,
  MoonIcon,
  LocationIcon,
  SettingsIcon,
  LogoIcon,
} from './icons.jsx'
import { X } from 'lucide-react'

export function AppSidebar({ open, onClose, active, onSelect }) {
  const menuItems = [
    { id: 'reloj', label: 'Reloj Solar', icon: <SunIcon className="h-5 w-5" /> },
    { id: 'astronomia', label: 'Astronomía', icon: <MoonIcon className="h-5 w-5" /> },
    { id: 'ubicacion', label: 'Ubicación', icon: <LocationIcon className="h-5 w-5" /> },
    { id: 'ajustes', label: 'Ajustes', icon: <SettingsIcon className="h-5 w-5" /> },
  ]

  return (
    <>
      {/* Overlay */}
      {open && (
        <div
          className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm transition-opacity duration-300"
          onClick={onClose}
        />
      )}

      {/* Sidebar container */}
      <div
        className={cn(
          'fixed top-0 bottom-0 left-0 z-50 w-[280px] border-r border-white/10 bg-background/80 backdrop-blur-xl transition-all duration-300 ease-in-out flex flex-col p-6',
          open ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-full bg-sun/15 text-sun">
              <LogoIcon className="h-5 w-5" />
            </span>
            <span className="text-xl font-semibold tracking-tight">
              6D<span className="text-muted-foreground">-Watch</span>
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid h-8 w-8 place-items-center rounded-full border border-white/10 bg-white/5 text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <nav className="flex-1 space-y-2">
          {menuItems.map((item) => {
            const isActive = active === item.id
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelect(item.id)}
                className={cn(
                  'flex w-full items-center gap-3.5 rounded-xl px-4 py-3 text-sm font-medium transition-all duration-200',
                  isActive
                    ? 'bg-sun/15 text-sun shadow-[0_0_15px_-3px_rgba(240,195,95,0.2)]'
                    : 'text-muted-foreground hover:bg-white/5 hover:text-foreground',
                )}
              >
                {item.icon}
                {item.label}
              </button>
            )
          })}
        </nav>

        <div className="border-t border-white/5 pt-4 text-xs text-muted-foreground text-center">
          <p>© 2026 6D-Watch. All rights reserved.</p>
        </div>
      </div>
    </>
  )
}
