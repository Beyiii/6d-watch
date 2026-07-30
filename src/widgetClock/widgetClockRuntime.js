// Punto de entrada empaquetado por separado (ver scripts/build-widget-clock-runtime.mjs)
// para usarse dentro del WebView headless del widget de Android. Reutiliza exactamente
// la misma lógica de aplicación de estado que la app web (rotación, flip por hemisferio,
// destaque de hora civil/geométrica, fase lunar) importándola desde el hook original:
// no se duplica ni se reimplementa nada de esa lógica aquí.
import { applyFigmaClockState, createFigmaClockState } from '../core/figmaClockEngine.js'

const state = createFigmaClockState('widget-clock')

function normalizeHour24(value) {
  const n = Number(value)
  if (!Number.isFinite(n)) return null
  return ((n % 24) + 24) % 24
}

function notifyReady(success, errorMessage) {
  console.log('[widget-clock] notifyReady success=' + success + ' hasBridge=' + Boolean(window.AndroidClockBridge))
  try {
    if (window.AndroidClockBridge?.onClockReady) {
      window.AndroidClockBridge.onClockReady(success ? '1' : '0', errorMessage ?? '')
      console.log('[widget-clock] bridge.onClockReady call returned normally')
      return
    }
  } catch (err) {
    console.log('[widget-clock] bridge.onClockReady threw: ' + err)
  }
  // Fallback para pruebas manuales fuera de Android (navegador de escritorio):
  // el título del documento sirve como señal observable de "listo".
  document.title = success ? 'clock-ready' : `clock-error:${errorMessage ?? 'unknown'}`
}

/**
 * @param {{geometricHour: number, minutes: number, civilHour: number, moonPhase: number, hemisphere: string}} params
 */
window.__renderWidgetClock = function renderWidgetClock(params) {
  console.log('[widget-clock] renderWidgetClock called with ' + JSON.stringify(params))

  if (!params || typeof params !== 'object') {
    notifyReady(false, 'bad-params')
    return
  }

  const gh = normalizeHour24(params.geometricHour)
  const geo = gh == null ? null : { gh, minutes: Math.max(0, Math.floor(Number(params.minutes) || 0)) }
  const civilHour = normalizeHour24(params.civilHour)
  const moonPhase = Number.isFinite(Number(params.moonPhase)) ? Number(params.moonPhase) : 0
  const hemisphere = params.hemisphere === 'north' ? 'north' : 'south'
  // Misma fórmula que figmaClockEngine.computeAngleDeg (TEMP parity log).
  const direction = hemisphere === 'north' ? -1 : 1
  const pointerAngleDeg = geo == null
    ? null
    : (direction === 1 ? -15 * (geo.gh - 6) : -15 * (18 - geo.gh))
  const yinYangRotationDeg = pointerAngleDeg == null ? null : pointerAngleDeg + 90

  console.log(
    '[GeoClockParity] figmaClockEngineInputs'
      + ' geometricHour=' + params.geometricHour
      + ' ghNormalized=' + (geo ? geo.gh : null)
      + ' minutesToSvg=' + (geo ? geo.minutes : null)
      + ' civilHour=' + civilHour
      + ' moonPhase=' + moonPhase
      + ' hemisphere=' + hemisphere
      + ' pointerAngleDeg=' + pointerAngleDeg
      + ' yinYangRotationDeg=' + yinYangRotationDeg
  )

  const root = document.getElementById('widget-clock-root')
  console.log('[widget-clock] root found=' + Boolean(root) + ' svgChild=' + Boolean(root && root.querySelector('svg')))
  if (!root) {
    notifyReady(false, 'missing-root')
    return
  }

  console.log('[widget-clock] calling applyFigmaClockState...')
  applyFigmaClockState({
    root,
    geo,
    moonPhase,
    civilHour,
    hemisphere,
    readyKey: 'widget-clock',
    state,
    waitForFonts: false,
  })
    .then(() => {
      console.log('[widget-clock] applyFigmaClockState resolved OK')
      notifyReady(true)
    })
    .catch((err) => {
      console.log('[widget-clock] applyFigmaClockState REJECTED: ' + (err && err.stack ? err.stack : err))
      notifyReady(false, err?.message ?? String(err))
    })
}
