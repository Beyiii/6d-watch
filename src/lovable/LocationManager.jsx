import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useWatch } from '../context/WatchContext.jsx'
import { cn } from './lib/utils.js'
import {
  getActiveLocationLabel,
  getLoadingLocationLabel,
  matchSavedLocation,
  MATCH_TOLERANCE,
} from './locationDisplay.js'
import {
  ChevronDownIcon,
  LocationIcon,
} from './icons.jsx'

export { MATCH_TOLERANCE, matchSavedLocation, formatCoordsShort, getActiveLocationName } from './locationDisplay.js'
export { getActiveLocationLabel, getLoadingLocationLabel } from './locationDisplay.js'

/** Etiqueta informativa sobre el reloj — sin interacción. */
export function LocationBadge() {
  const { location, locationName, savedLocations } = useWatch()
  const savedMatch = matchSavedLocation(location, savedLocations)
  const isLoading = !savedMatch && locationName === null
  const name = isLoading
    ? getLoadingLocationLabel({ location })
    : getActiveLocationLabel({ location, locationName, savedLocations })

  return (
    <div
      className="absolute left-4 top-4 z-30 flex max-w-[min(100%-2rem,240px)] items-center gap-2 rounded-full border border-white/10 bg-background/60 px-3 py-2 text-sm shadow-[0_8px_24px_-8px_oklch(0_0_0/0.55)] backdrop-blur-md"
      aria-label={`Ubicación activa: ${name}`}
    >
      <LocationIcon className="h-4 w-4 shrink-0 text-sun" />
      <span className={cn('truncate font-medium', isLoading && 'animate-pulse text-muted-foreground')}>
        {name}
      </span>
    </div>
  )
}

/** Selector de ubicaciones guardadas — embebido en la tarjeta Ubicación. */
export function LocationManager({ onOpenChange }) {
  const { location, locationName, onSelectLocation, savedLocations, addSavedLocation, removeSavedLocation } = useWatch()
  const [open, setOpen] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [visible, setVisible] = useState(false)
  const [showSaveForm, setShowSaveForm] = useState(false)
  const [saveName, setSaveName] = useState('')
  const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0, width: 0 })
  const rootRef = useRef(null)
  const triggerRef = useRef(null)
  const menuRef = useRef(null)
  const saveInputRef = useRef(null)

  const activeMatch = matchSavedLocation(location, savedLocations)
  const isLoading = !activeMatch && locationName === null
  const resolvedName = isLoading
    ? getLoadingLocationLabel({ location })
    : getActiveLocationLabel({ location, locationName, savedLocations })
  const isUnsaved = !activeMatch

  const updateMenuPosition = useCallback(() => {
    if (!triggerRef.current) return
    const rect = triggerRef.current.getBoundingClientRect()
    setMenuPosition({
      top: rect.bottom + 8,
      left: rect.left,
      width: rect.width,
    })
  }, [])

  useEffect(() => {
    onOpenChange?.(open)
  }, [open, onOpenChange])

  useEffect(() => () => onOpenChange?.(false), [onOpenChange])

  useEffect(() => {
    if (open) {
      setMounted(true)
      const id = requestAnimationFrame(() => setVisible(true))
      return () => cancelAnimationFrame(id)
    }
    setVisible(false)
  }, [open])

  // Reset save form when menu closes
  useEffect(() => {
    if (!open) {
      const id = setTimeout(() => setShowSaveForm(false), 200)
      return () => clearTimeout(id)
    }
  }, [open])

  // Reset save form when location becomes saved (after saving)
  useEffect(() => {
    if (!isUnsaved) setShowSaveForm(false)
  }, [isUnsaved])

  // Pre-fill save name with the geocoded name (or timezone fallback) when form opens
  useEffect(() => {
    if (showSaveForm) {
      const defaultName = isLoading
        ? getLoadingLocationLabel({ location })
        : getActiveLocationLabel({ location, locationName, savedLocations })
      setSaveName(defaultName)
      requestAnimationFrame(() => saveInputRef.current?.select())
    }
  }, [showSaveForm, isLoading, location, locationName, savedLocations])

  useEffect(() => {
    if (!open) return
    updateMenuPosition()
    window.addEventListener('resize', updateMenuPosition)
    window.addEventListener('scroll', updateMenuPosition, true)
    return () => {
      window.removeEventListener('resize', updateMenuPosition)
      window.removeEventListener('scroll', updateMenuPosition, true)
    }
  }, [open, showSaveForm, updateMenuPosition])

  useEffect(() => {
    if (!open) return
    function onPointerDown(e) {
      const target = e.target
      if (rootRef.current?.contains(target) || menuRef.current?.contains(target)) return
      setOpen(false)
    }
    function onKeyDown(e) {
      if (e.key === 'Escape') {
        if (showSaveForm) setShowSaveForm(false)
        else setOpen(false)
      }
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open, showSaveForm])

  function handleSave(e) {
    e.preventDefault()
    const name = saveName.trim()
    if (!name) return
    addSavedLocation(name, location.lat, location.lon)
    setShowSaveForm(false)
  }

  function handleDelete(e, id) {
    e.stopPropagation()
    removeSavedLocation(id)
  }

  return (
    <div className="relative mt-3" ref={rootRef}>
      <button
        ref={triggerRef}
        type="button"
        aria-label="Gestionar ubicaciones guardadas"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm transition-colors hover:bg-white/10"
      >
        <LocationIcon className="h-4 w-4 shrink-0 text-sun" />
        <span className={cn(
          'min-w-0 flex-1 truncate text-left font-medium',
          isLoading && 'animate-pulse text-muted-foreground',
        )}>
          {resolvedName}
        </span>
        <ChevronDownIcon
          className={cn(
            'h-4 w-4 shrink-0 text-muted-foreground transition-transform',
            open && 'rotate-180',
          )}
        />
      </button>

      {mounted &&
        createPortal(
          <div
            ref={menuRef}
            style={{
              position: 'fixed',
              top: menuPosition.top,
              left: menuPosition.left,
              width: menuPosition.width,
              zIndex: 100,
            }}
            className={cn(
              'lovable-root origin-top',
              'transition-[opacity,transform] duration-150 ease-out',
              visible ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 -translate-y-1 scale-95',
            )}
            onTransitionEnd={() => {
              if (!visible) setMounted(false)
            }}
          >
            <div
              role="menu"
              className="glass-popover overflow-hidden rounded-2xl p-2 text-card-foreground"
            >
              {/* Save current map location (only shown when unsaved) */}
              {isUnsaved && (
                <div className="mb-2 border-b border-white/10 pb-2">
                  {!showSaveForm ? (
                    <button
                      type="button"
                      onClick={() => setShowSaveForm(true)}
                      className="flex w-full items-center gap-2 rounded-xl border border-sun/25 bg-sun/10 px-3 py-2 text-sm font-medium text-sun transition-colors hover:bg-sun/20"
                    >
                      <PlusIcon className="h-4 w-4 shrink-0" />
                      <span className="truncate">Guardar ubicación actual</span>
                    </button>
                  ) : (
                    <form onSubmit={handleSave} className="space-y-2">
                      <p className="px-1 text-[0.7rem] uppercase tracking-wider text-muted-foreground">
                        Nombre de la ubicación
                      </p>
                      <input
                        ref={saveInputRef}
                        type="text"
                        value={saveName}
                        onChange={(e) => setSaveName(e.target.value)}
                        placeholder="Ej. Casa, Trabajo…"
                        className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/60 focus:border-sun/40 focus:outline-none focus:ring-1 focus:ring-sun/30"
                      />
                      <div className="flex gap-2">
                        <button
                          type="submit"
                          disabled={!saveName.trim()}
                          className="flex-1 rounded-xl bg-sun/15 px-3 py-1.5 text-sm font-medium text-sun transition-colors hover:bg-sun/25 disabled:opacity-40"
                        >
                          Guardar
                        </button>
                        <button
                          type="button"
                          onClick={() => setShowSaveForm(false)}
                          className="rounded-xl px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-white/10"
                        >
                          Cancelar
                        </button>
                      </div>
                    </form>
                  )}
                </div>
              )}

              {/* Saved locations list */}
              {savedLocations.length > 0 ? (
                <>
                  <p className="px-2 pb-1.5 pt-1 text-[0.7rem] uppercase tracking-wider text-muted-foreground">
                    Ubicaciones guardadas
                  </p>
                  <div className="space-y-0.5">
                    {savedLocations.map((loc) => {
                      const isCurrent =
                        Math.abs(location.lat - loc.lat) < MATCH_TOLERANCE &&
                        Math.abs(location.lon - loc.lon) < MATCH_TOLERANCE
                      return (
                        <div key={loc.id} className="group flex items-center gap-1">
                          <button
                            type="button"
                            role="menuitem"
                            onClick={() => {
                              onSelectLocation(loc.lat, loc.lon)
                              setOpen(false)
                            }}
                            className="flex min-w-0 flex-1 items-center gap-2.5 rounded-xl px-2.5 py-2 text-left transition-colors hover:bg-white/10"
                          >
                            <LocationIcon
                              className={cn(
                                'h-4 w-4 shrink-0',
                                isCurrent ? 'text-sun' : 'text-muted-foreground',
                              )}
                            />
                            <span className="flex min-w-0 flex-col leading-tight">
                              <span className="truncate text-sm font-medium">{loc.name}</span>
                              <span className="truncate text-[0.7rem] text-muted-foreground">
                                {loc.coords}
                              </span>
                            </span>
                            {isCurrent && (
                              <span className="ml-auto h-1.5 w-1.5 shrink-0 rounded-full bg-sun shadow-[0_0_6px] shadow-sun" />
                            )}
                          </button>
                          <button
                            type="button"
                            aria-label={`Eliminar ${loc.name}`}
                            onClick={(e) => handleDelete(e, loc.id)}
                            className="grid h-7 w-7 shrink-0 place-items-center rounded-lg text-muted-foreground/40 opacity-0 transition-[opacity,colors] hover:bg-white/10 hover:text-foreground group-hover:opacity-100"
                          >
                            <TrashIcon className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      )
                    })}
                  </div>
                </>
              ) : (
                <p className="px-2 py-3 text-center text-[0.75rem] text-muted-foreground">
                  No hay ubicaciones guardadas.
                </p>
              )}
            </div>
          </div>,
          document.body,
        )}
    </div>
  )
}

function PlusIcon(props) {
  return (
    <svg
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      viewBox="0 0 24 24"
      {...props}
    >
      <path d="M12 5v14M5 12h14" />
    </svg>
  )
}

function TrashIcon(props) {
  return (
    <svg
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      viewBox="0 0 24 24"
      {...props}
    >
      <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" />
    </svg>
  )
}
