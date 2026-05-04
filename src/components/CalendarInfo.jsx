export default function CalendarInfo({ dayData, timezoneLabel }) {
  if (!dayData) {
    return (
      <div>
        <p>
          <i className="bi bi-exclamation-triangle"></i> Selecciona una fecha para ver la información.
        </p>
      </div>
    )
  }

  return (
    <div className="calendar-info">
      <div className="calendar-info-top">
        <div className="calendar-info-date">{dayData.weekday}, {dayData.date}</div>
        <div className="calendar-season" title="Estación (aproximada por mes)">
          <i className="bi bi-flower1" aria-hidden="true"></i>
          <span>{dayData.season}</span>
        </div>
      </div>

      <p className="calendar-info-tz">
        <i className="bi bi-globe2" aria-hidden="true"></i> {timezoneLabel}
      </p>

      <div className="calendar-info-section">
        <div className="calendar-info-section-title">
          <i className="bi bi-sun" aria-hidden="true"></i> Sol
        </div>
        <p><i className="bi bi-sunrise"></i> Amanecer: {dayData.sunrise}</p>
        <p><i className="bi bi-sunset"></i> Atardecer: {dayData.sunset}</p>
        <p><i className="bi bi-brightness-high"></i> Mediodía solar: {dayData.solarNoon}</p>
        <p><i className="bi bi-compass"></i> Elevación máxima: {dayData.maxElevation}</p>
        <p><i className="bi bi-clock"></i> Día: {dayData.dayLength} &nbsp;|&nbsp; Noche: {dayData.nightLength}</p>
      </div>

      <div className="calendar-info-section">
        <div className="calendar-info-section-title">
          <i className="bi bi-brightness-alt-high" aria-hidden="true"></i> Luz especial
        </div>
        <p>Golden AM: {dayData.goldenHourMorning}</p>
        <p>Golden PM: {dayData.goldenHourEvening}</p>
        <p>Blue AM: {dayData.blueHourMorning}</p>
        <p>Blue PM: {dayData.blueHourEvening}</p>
      </div>

      <div className="calendar-info-section">
        <div className="calendar-info-section-title">
          <i className="bi bi-moon-stars" aria-hidden="true"></i> Luna
        </div>
        <p>Fase: {dayData.moonPhase} — {dayData.moonIllum}</p>
        <p><i className="bi bi-arrow-up-circle"></i> Salida: {dayData.moonrise}</p>
        <p><i className="bi bi-arrow-down-circle"></i> Puesta: {dayData.moonset}</p>
      </div>
    </div>
  )
}
