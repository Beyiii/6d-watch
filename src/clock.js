// ─── clock.js ─────────────────────────────────────────────────────────────────
// Componente de reloj analógico reutilizable.
//
// Exporta dos funciones:
//   createClock(containerId, options)  → crea el HTML del reloj en el contenedor
//   updateClock(containerId, hours, minutes, seconds)  → mueve las manecillas
//
// No depende de ningún estado global: recibe la hora como parámetros.
// main.js llama a updateClock() cada segundo con la hora civil o geométrica.

// ─── createClock() ────────────────────────────────────────────────────────────
// Inserta el HTML del reloj en el contenedor indicado.
//
// options:
//   label      → texto sobre el reloj (ej. "Hora civil")
//   geometric  → true para aplicar la clase .geometric (estilos oscuros)
//   numbers    → array de 12 strings para los números (por defecto "1"…"12")

export function createClock(containerId, options = {}) {
  const {
    label     = '',
    geometric = false,
    numbers   = ['1','2','3','4','5','6','7','8','9','10','11','12'],
  } = options

  const clockClass = geometric ? 'clock geometric' : 'clock'
  const displayClass = geometric ? 'clock-time-display geometric' : 'clock-time-display'

  const liItems = numbers
    .map(n => `<li><span>${n}</span></li>`)
    .join('\n            ')

  document.getElementById(containerId).innerHTML = `
    <div class="clock-group">
      ${label ? `<div class="clock-label">${label}</div>` : ''}
      <div class="${clockClass}" id="${containerId}-face">
        <div class="hourHand"></div>
        <div class="minuteHand"></div>
        <div class="secondHand"></div>
        <div class="center"></div>
        <ul>
          ${liItems}
        </ul>
      </div>
      <div class="${displayClass}" id="${containerId}-display">--:--:--</div>
    </div>
  `
}

// ─── updateClock() ────────────────────────────────────────────────────────────
// Mueve las manecillas del reloj al tiempo indicado.
//
// hours   → número decimal o entero [0, 12) o [0, 24)
//           si es ≥ 12 se hace módulo 12 automáticamente (compatible con 24h)
// minutes → entero [0, 60)
// seconds → entero [0, 60)
// displayText → string opcional para el display digital (ej. "14:32:07")
//               si no se pasa, se formatea automáticamente

export function updateAnalogClock(containerId, hours, minutes, seconds, displayText) {
  const face = document.getElementById(`${containerId}-face`)
  if (!face) return

  const h12 = hours % 12  // convierte 24h → 12h para la esfera

  // Grados de cada manecilla
  // La hora incluye la fracción de minuto para que el horario se mueva suavemente
  const hourDeg   = (h12 / 12) * 360 + (minutes / 60) * 30
  const minuteDeg = (minutes / 60) * 360 + (seconds / 60) * 6
  const secondDeg = (seconds / 60) * 360

  face.querySelector('.hourHand').style.transform   = `rotate(${hourDeg}deg)`
  face.querySelector('.minuteHand').style.transform = `rotate(${minuteDeg}deg)`
  face.querySelector('.secondHand').style.transform = `rotate(${secondDeg}deg)`

  // Display digital
  const display = document.getElementById(`${containerId}-display`)
  if (display) {
    display.textContent = displayText ?? formatHMS(hours, minutes, seconds)
  }
}

// ─── formatHMS() ──────────────────────────────────────────────────────────────
// Helper interno para formatear "HH:MM:SS".

function formatHMS(h, m, s) {
  return [h, m, s].map(n => Math.floor(n).toString().padStart(2, '0')).join(':')
}
