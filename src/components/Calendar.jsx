import { useEffect, useMemo, useRef, useState } from 'react'
import { DateTime } from 'luxon'

const WEEKDAYS_ES = ['L', 'M', 'X', 'J', 'V', 'S', 'D']
const MONTHS_ES = [
  'Enero',
  'Febrero',
  'Marzo',
  'Abril',
  'Mayo',
  'Junio',
  'Julio',
  'Agosto',
  'Septiembre',
  'Octubre',
  'Noviembre',
  'Diciembre',
]

function capitalizeFirst(text) {
  if (!text) return text
  return text.charAt(0).toUpperCase() + text.slice(1)
}

export default function Calendar({
  timezone,
  monthCursor,
  selectedDate,
  onMonthChange,
  onSelectDate,
  onJumpToDate,
}) {
  const monthStart = monthCursor.setZone(timezone).startOf('month')
  const daysInMonth = monthStart.daysInMonth
  const offset = monthStart.weekday - 1 // Luxon: 1=Lunes ... 7=Domingo

  const monthLabel = capitalizeFirst(monthStart.setLocale('es').toFormat('LLLL yyyy'))

  const [pickerOpen, setPickerOpen] = useState(false)
  const pickerRef = useRef(null)
  const monthButtonRef = useRef(null)

  const today = DateTime.now().setZone(timezone)

  const cells = []

  for (let i = 0; i < offset; i++) {
    cells.push({ type: 'empty', key: `e-${i}` })
  }

  for (let day = 1; day <= daysInMonth; day++) {
    const date = monthStart.set({ day }).startOf('day')
    const isSelected = selectedDate.hasSame(date, 'day')
    const isToday = today.hasSame(date, 'day')

    cells.push({
      type: 'day',
      key: date.toISODate(),
      day,
      date,
      isSelected,
      isToday,
    })
  }

  const handlePrevMonth = () => onMonthChange(monthStart.minus({ months: 1 }))
  const handleNextMonth = () => onMonthChange(monthStart.plus({ months: 1 }))

  const years = useMemo(() => {
    const center = monthStart.year
    const span = 50
    const list = []
    for (let y = center - span; y <= center + span; y += 1) list.push(y)
    return list
  }, [monthStart.year])

  useEffect(() => {
    if (!pickerOpen) return

    const onKeyDown = (e) => {
      if (e.key === 'Escape') {
        setPickerOpen(false)
        monthButtonRef.current?.focus?.()
      }
    }

    const onPointerDown = (e) => {
      const pickerEl = pickerRef.current
      const buttonEl = monthButtonRef.current
      const target = e.target

      if (!pickerEl || !target) return
      if (pickerEl.contains(target)) return
      if (buttonEl && buttonEl.contains(target)) return
      setPickerOpen(false)
    }

    document.addEventListener('keydown', onKeyDown)
    document.addEventListener('mousedown', onPointerDown)

    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.removeEventListener('mousedown', onPointerDown)
    }
  }, [pickerOpen])

  const handleDateInput = (e) => {
    const iso = e.target.value
    if (!iso) return

    const next = DateTime.fromISO(iso, { zone: timezone }).startOf('day')
    onJumpToDate(next)
  }

  return (
    <div className="calendar">
      <div className="calendar-controls">
        <button className="calendar-nav" type="button" onClick={handlePrevMonth} aria-label="Mes anterior">
          <i className="bi bi-chevron-left" aria-hidden="true"></i>
        </button>

        <button
          ref={monthButtonRef}
          type="button"
          className="calendar-month calendar-month-button"
          aria-label="Elegir mes y año"
          aria-haspopup="dialog"
          aria-expanded={pickerOpen}
          onClick={() => setPickerOpen((v) => !v)}
        >
          {monthLabel}
        </button>

        <button className="calendar-nav" type="button" onClick={handleNextMonth} aria-label="Mes siguiente">
          <i className="bi bi-chevron-right" aria-hidden="true"></i>
        </button>

        {pickerOpen ? (
          <div ref={pickerRef} className="calendar-picker" role="dialog" aria-label="Selector de mes y año">
            <div className="calendar-picker-section">
              <div className="calendar-picker-title">Mes</div>
              <div className="calendar-picker-months" role="list">
                {MONTHS_ES.map((name, idx) => {
                  const monthNumber = idx + 1
                  const isActive = monthStart.month === monthNumber
                  return (
                    <button
                      key={name}
                      type="button"
                      className={['calendar-picker-button', isActive ? 'is-active' : ''].filter(Boolean).join(' ')}
                      onClick={() => {
                        onMonthChange(monthStart.set({ month: monthNumber }))
                        setPickerOpen(false)
                      }}
                    >
                      {name}
                    </button>
                  )
                })}
              </div>
            </div>

            <div className="calendar-picker-section">
              <div className="calendar-picker-title">Año</div>
              <div className="calendar-picker-years" role="list">
                {years.map((y) => {
                  const isActive = monthStart.year === y
                  return (
                    <button
                      key={y}
                      type="button"
                      className={['calendar-picker-button', isActive ? 'is-active' : ''].filter(Boolean).join(' ')}
                      onClick={() => {
                        onMonthChange(monthStart.set({ year: y }))
                      }}
                    >
                      {y}
                    </button>
                  )
                })}
              </div>
            </div>
          </div>
        ) : null}

        <div className="calendar-search">
          <label className="calendar-search-label" htmlFor="calendar-date-input">
            Buscar
          </label>
          <input
            id="calendar-date-input"
            className="calendar-date-input"
            type="date"
            value={selectedDate.toISODate()}
            onChange={handleDateInput}
          />
        </div>
      </div>

      <div className="calendar-weekdays" aria-hidden="true">
        {WEEKDAYS_ES.map((d) => (
          <div key={d} className="calendar-weekday">
            {d}
          </div>
        ))}
      </div>

      <div className="calendar-grid" role="grid" aria-label="Calendario mensual">
        {cells.map((cell) => {
          if (cell.type === 'empty') {
            return <div key={cell.key} className="calendar-cell calendar-cell-empty" aria-hidden="true" />
          }

          const className = [
            'calendar-cell',
            'calendar-day',
            cell.isSelected ? 'is-selected' : '',
            cell.isToday ? 'is-today' : '',
          ]
            .filter(Boolean)
            .join(' ')

          return (
            <button
              key={cell.key}
              type="button"
              role="gridcell"
              className={className}
              onClick={() => onSelectDate(cell.date)}
              aria-label={cell.date.setLocale('es').toFormat("cccc dd 'de' LLLL, yyyy")}
              aria-selected={cell.isSelected}
            >
              {cell.day}
            </button>
          )
        })}
      </div>
    </div>
  )
}
