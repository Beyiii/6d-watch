import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Outlet } from 'react-router-dom'
import { StarField } from './StarField.jsx'
import { AppSidebar } from './Sidebar.jsx'
import { ChevronDownIcon, GlobeIcon, LogoIcon, SettingsIcon } from './icons.jsx'
import { cn } from './lib/utils.js'
import './styles.css'

export function V2Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  useEffect(() => {
    document.documentElement.classList.add('watch-ui-route')
    document.body.classList.add('watch-ui-route')
    return () => {
      document.documentElement.classList.remove('watch-ui-route')
      document.body.classList.remove('watch-ui-route')
    }
  }, [])

  return (
    <div className="watch-ui-root relative min-h-screen w-full text-foreground">
      <StarField />

      <AppSidebar
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      <div className="mx-auto flex min-h-screen max-w-[1500px] flex-col gap-6 overflow-visible px-4 py-6 lg:px-8">
        <Header onOpenSidebar={() => setSidebarOpen(true)} />
        <Outlet />
      </div>
    </div>
  )
}

function Header({ onOpenSidebar }) {
  return (
    <header className="flex items-center justify-between gap-4">
      <button
        type="button"
        onClick={onOpenSidebar}
        className="nav-hover group flex items-center gap-3 rounded-full px-2 py-1.5 text-left"
        aria-label="Abrir menú"
      >
        <span className="grid h-10 w-10 place-items-center rounded-full bg-sun/15 text-sun transition-transform group-hover:scale-105">
          <LogoIcon className="h-5 w-5" />
        </span>
        <h1 className="text-xl font-semibold tracking-tight">
          6D<span className="text-muted-foreground">-Watch</span>
        </h1>
      </button>

      <div className="flex items-center gap-2">
        <LanguageMenu />
        <IconButton aria-label="Ajustes">
          <SettingsIcon className="h-4 w-4" />
        </IconButton>
      </div>
    </header>
  )
}

function LanguageMenu() {
  const [open, setOpen] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [visible, setVisible] = useState(false)
  const [language, setLanguage] = useState('es')
  const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0, width: 0 })
  const rootRef = useRef(null)
  const triggerRef = useRef(null)
  const menuRef = useRef(null)

  const languages = [
    { code: 'es', label: 'Español' },
    { code: 'en', label: 'English' },
  ]

  const activeLanguage = languages.find((lang) => lang.code === language) ?? languages[0]

  const updateMenuPosition = useCallback(() => {
    if (!triggerRef.current) return
    const rect = triggerRef.current.getBoundingClientRect()
    setMenuPosition({
      top: rect.bottom + 8,
      left: rect.left,
      width: Math.max(rect.width, 168),
    })
  }, [])

  useEffect(() => {
    if (open) {
      setMounted(true)
      const id = requestAnimationFrame(() => setVisible(true))
      return () => cancelAnimationFrame(id)
    }
    setVisible(false)
  }, [open])

  useEffect(() => {
    if (!open) return
    updateMenuPosition()
    window.addEventListener('resize', updateMenuPosition)
    window.addEventListener('scroll', updateMenuPosition, true)
    return () => {
      window.removeEventListener('resize', updateMenuPosition)
      window.removeEventListener('scroll', updateMenuPosition, true)
    }
  }, [open, updateMenuPosition])

  useEffect(() => {
    if (!open) return
    function onPointerDown(e) {
      const target = e.target
      if (rootRef.current?.contains(target) || menuRef.current?.contains(target)) {
        return
      }
      setOpen(false)
    }
    function onKeyDown(e) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  return (
    <div className="relative" ref={rootRef}>
      <button
        ref={triggerRef}
        type="button"
        aria-label="Seleccionar idioma"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="flex min-w-[148px] items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm transition-colors hover:bg-white/10"
      >
        <GlobeIcon className="h-4 w-4 shrink-0 text-sun" />
        <span className="min-w-0 flex-1 truncate text-left font-medium">
          {activeLanguage.label}
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
              'watch-ui-root origin-top',
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
              <p className="px-2 pb-1.5 pt-1 text-[0.7rem] uppercase tracking-wider text-muted-foreground">
                Idioma
              </p>
              <div className="space-y-0.5">
                {languages.map((lang) => {
                  const isCurrent = lang.code === language
                  return (
                    <button
                      key={lang.code}
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setLanguage(lang.code)
                        setOpen(false)
                      }}
                      className="flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left transition-colors hover:bg-white/10"
                    >
                      <GlobeIcon
                        className={cn(
                          'h-4 w-4 shrink-0',
                          isCurrent ? 'text-sun' : 'text-muted-foreground',
                        )}
                      />
                      <span className="truncate text-sm font-medium">{lang.label}</span>
                      {isCurrent && (
                        <span className="ml-auto h-1.5 w-1.5 shrink-0 rounded-full bg-sun shadow-[0_0_6px] shadow-sun" />
                      )}
                    </button>
                  )
                })}
              </div>
            </div>
          </div>,
          document.body,
        )}
    </div>
  )
}

function IconButton({ children, ...props }) {
  return (
    <button
      type="button"
      className="grid h-10 w-10 place-items-center rounded-full border border-white/10 bg-white/5 text-foreground transition-colors hover:bg-white/10"
      {...props}
    >
      {children}
    </button>
  )
}
