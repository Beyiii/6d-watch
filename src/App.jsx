import { useCallback, useEffect, useMemo, useState } from 'react'
import { DateTime } from 'luxon'
import tzLookup from '@photostructure/tz-lookup'

import { getDynamicBackgroundColors } from './core/background.js'

import { useClockData } from './hooks/useClockData.js'
import GeoClock from './components/GeoClock.jsx'
import Map from './components/Map.jsx'
import SolarArc from './components/SolarArc.jsx'
import Calendar from './components/Calendar.jsx'
import CalendarInfo from './components/CalendarInfo.jsx'
import ExperimentalFigmaClock from './components/ExperimentalFigmaClock.jsx'

import { getCalendarDay } from './calendar.js'

const INITIAL_LOCATION = {
  lat: -33.4489,
  lon: -70.6693,
  timezone: tzLookup(-33.4489, -70.6693),
}

export default function App() {
  const [location, setLocation] = useState(INITIAL_LOCATION)
  const { snapshot } = useClockData(location)

  const [geoModalOpen, setGeoModalOpen] = useState(false)

  const [calendarMonth, setCalendarMonth] = useState(() =>
    DateTime.now().setZone(INITIAL_LOCATION.timezone).startOf('month')
  )

  const [selectedDate, setSelectedDate] = useState(() =>
    DateTime.now().setZone(INITIAL_LOCATION.timezone).startOf('day')
  )

  const onSelectLocation = useCallback((lat, lon) => {
    const timezone = tzLookup(lat, lon)

    setLocation({
      lat,
      lon,
      timezone,
    })

    // Simplificación: al cambiar ubicación, el calendario vuelve a "hoy" en ese lugar.
    const now = DateTime.now().setZone(timezone)
    setSelectedDate(now.startOf('day'))
    setCalendarMonth(now.startOf('month'))
  }, [])

  const bgColors = useMemo(() => {
    const gh = snapshot?.raw?.geometricHour
    if (typeof gh !== 'number' || !Number.isFinite(gh)) return null
    return getDynamicBackgroundColors(gh)
  }, [snapshot])

  useEffect(() => {
    if (!bgColors) return
    document.body.style.setProperty('--dynamic-bg-start', bgColors.start)
    document.body.style.setProperty('--dynamic-bg-mid', bgColors.mid)
    document.body.style.setProperty('--dynamic-bg-end', bgColors.end)
  }, [bgColors])

  useEffect(() => {
    if (!geoModalOpen) return

    const onKeyDown = (e) => {
      if (e.key === 'Escape') setGeoModalOpen(false)
    }

    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [geoModalOpen])

  const calendarDayData = useMemo(() => {
    const { lat, lon, timezone } = location
    return getCalendarDay(selectedDate.setZone(timezone), lat, lon, timezone)
  }, [location, selectedDate])

  const timezoneLabel = useMemo(() => {
    return `${location.timezone} · Lat ${location.lat.toFixed(4)} · Lon ${location.lon.toFixed(4)}`
  }, [location])

  return (
    <div id="container">
      <header className="hero">
        <h1 className="app-title">6D-Watch</h1>
        <p className="app-kicker">Reloj Geométrico</p>
        <p className="app-description">
          Visualiza la hora civil y la hora geométrica según el ciclo real del Sol en cualquier ubicación.
        </p>
        <div className="hero-divider" aria-hidden="true"></div>
      </header>

      <div id="dashboard">
        <section id="primary-card" className="card">
          <div className="primary-meta">
            <div className="primary-field">
              <div className="primary-label">Ubicación</div>
              <div className="primary-value">
                <span className="primary-location-line">{snapshot.ui.locationLine1}</span>
                <span className="primary-location-line">{snapshot.ui.locationLine2}</span>
              </div>
            </div>

            <div className="primary-field">
              <div className="primary-label">Día</div>
              <div className="primary-day">{snapshot.ui.dateLong}</div>
            </div>

            <div className="primary-time-block">
              <div className="primary-label">Hora civil</div>
              <div className="primary-time">{snapshot.ui.civilTime}</div>
            </div>

            <div className="primary-time-block">
              <div className="primary-label">Hora geométrica</div>
              <div className="primary-time">{snapshot.ui.geometricTime}</div>
            </div>
          </div>

          <GeoClock
            snapshot={snapshot}
            hemisphere={location.lat < 0 ? 'south' : 'north'}
            bgMid={bgColors?.mid ?? null}
            wrapId="geo-clock-wrap"
            onOpen={() => setGeoModalOpen(true)}
          />
        </section>

        <section id="map-card" className="card">
          <h3>
            <i className="bi bi-map"></i> Mapa
          </h3>
          <Map onSelectLocation={onSelectLocation} />
        </section>

        <section id="solar-card" className="card">
          <h3>
            <i className="bi bi-sun"></i> Datos solares
          </h3>

          {snapshot.solarCycle ? (
            <>
              <p>
                <i className="bi bi-exclamation-triangle"></i> {snapshot.solarCycle.statusLine}
              </p>
              <p>
                <i className="bi bi-clock"></i> {snapshot.solarCycle.durationLine}
              </p>
              <p>
                <i className="bi bi-brightness-high"></i> Mediodía: {snapshot.solar.solarNoon.local}{' '}
                <span className="small">({snapshot.solar.solarNoon.santiago})</span>
              </p>
              <p>
                <i className="bi bi-compass"></i> Elevación máxima: {snapshot.solar.maxElevationDeg}°
              </p>
              <p>
                <i className="bi bi-clock"></i> Día: {snapshot.solar.dayLength} &nbsp;|&nbsp; Noche:{' '}
                {snapshot.solar.nightLength}
              </p>
            </>
          ) : (
            <>
              <p>
                <i className="bi bi-sunrise"></i> Amanecer: {snapshot.solar.sunrise.local}{' '}
                <span className="small">({snapshot.solar.sunrise.santiago})</span>
              </p>
              <p>
                <i className="bi bi-sunset"></i> Atardecer: {snapshot.solar.sunset.local}{' '}
                <span className="small">({snapshot.solar.sunset.santiago})</span>
              </p>
              <p>
                <i className="bi bi-brightness-high"></i> Mediodía: {snapshot.solar.solarNoon.local}{' '}
                <span className="small">({snapshot.solar.solarNoon.santiago})</span>
              </p>
              <p>
                <i className="bi bi-compass"></i> Elevación máxima: {snapshot.solar.maxElevationDeg}°
              </p>
              <p>
                <i className="bi bi-clock"></i> Día: {snapshot.solar.dayLength} &nbsp;|&nbsp; Noche:{' '}
                {snapshot.solar.nightLength}
              </p>
            </>
          )}
        </section>

        <section id="lunar-card" className="card">
          <h3>
            <i className="bi bi-moon-stars"></i> Datos lunares
          </h3>

          <>
            <p>
              Fase: {snapshot.lunar.phaseName} — {snapshot.lunar.illumination}%
            </p>
            <p>
              <i className="bi bi-arrow-up-circle"></i> Salida: {snapshot.lunar.moonrise.local}{' '}
              <span className="small">({snapshot.lunar.moonrise.santiago})</span>
            </p>
            <p>
              <i className="bi bi-arrow-down-circle"></i> Puesta: {snapshot.lunar.moonset.local}{' '}
              <span className="small">({snapshot.lunar.moonset.santiago})</span>
            </p>
          </>
        </section>

        <section id="solar-arc-card" className="card">
          <h3>
            <i className="bi bi-sun"></i> Trayectoria solar
          </h3>
          <SolarArc location={location} snapshot={snapshot} />
        </section>

        <section id="special-light-card" className="card">
          <h3>
            <i className="bi bi-brightness-alt-high"></i> Luz especial
          </h3>

          <>
            <p>
              Golden AM: {snapshot.specialLight.goldenAM.start.local} → {snapshot.specialLight.goldenAM.end.local}{' '}
              <span className="small">
                ({snapshot.specialLight.goldenAM.start.santiago} → {snapshot.specialLight.goldenAM.end.santiago})
              </span>
            </p>
            <p>
              Golden PM: {snapshot.specialLight.goldenPM.start.local} → {snapshot.specialLight.goldenPM.end.local}{' '}
              <span className="small">
                ({snapshot.specialLight.goldenPM.start.santiago} → {snapshot.specialLight.goldenPM.end.santiago})
              </span>
            </p>
            <p>
              Blue AM: {snapshot.specialLight.blueAM.start.local} → {snapshot.specialLight.blueAM.end.local}{' '}
              <span className="small">
                ({snapshot.specialLight.blueAM.start.santiago} → {snapshot.specialLight.blueAM.end.santiago})
              </span>
            </p>
            <p>
              Blue PM: {snapshot.specialLight.bluePM.start.local} → {snapshot.specialLight.bluePM.end.local}{' '}
              <span className="small">
                ({snapshot.specialLight.bluePM.start.santiago} → {snapshot.specialLight.bluePM.end.santiago})
              </span>
            </p>
          </>
        </section>

        <section id="calendar-card" className="card">
          <h3>
            <i className="bi bi-calendar3"></i> Calendario
          </h3>
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
        </section>

        <section id="calendar-info-card" className="card">
          <h3>
            <i className="bi bi-info-circle"></i> Información del día
          </h3>
          <CalendarInfo dayData={calendarDayData} timezoneLabel={timezoneLabel} />
        </section>

        <section id="experimental-clock-card" className="card">
          <h3>
            <i className="bi bi-bezier2"></i> Experimental
          </h3>
          <ExperimentalFigmaClock snapshot={snapshot} hemisphere={location.lat < 0 ? 'south' : 'north'} />
        </section>
      </div>

      {geoModalOpen ? (
        <div
          className="modal-overlay"
          role="dialog"
          aria-modal="true"
          aria-label="Reloj geométrico"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setGeoModalOpen(false)
          }}
        >
          <div className="modal-card">
            <button className="modal-close" type="button" onClick={() => setGeoModalOpen(false)} aria-label="Cerrar">
              <i className="bi bi-x-lg" aria-hidden="true"></i>
            </button>
            <GeoClock
              snapshot={snapshot}
              hemisphere={location.lat < 0 ? 'south' : 'north'}
              bgMid={bgColors?.mid ?? null}
              dialSize={560}
            />
          </div>
        </div>
      ) : null}
    </div>
  )
}
