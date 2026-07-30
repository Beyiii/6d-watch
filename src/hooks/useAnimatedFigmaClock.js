import { useLayoutEffect, useMemo, useRef } from 'react'

import {
  applyFigmaClockState,
  createFigmaClockState,
  deriveValidCivilHour,
  deriveValidGeo,
  deriveValidMoonPhase,
} from '../core/figmaClockEngine.js'

// La lógica real (rotación del dial, flip por hemisferio, destaque de hora civil/geométrica,
// fase lunar, texto de minutos, etc.) vive en `../core/figmaClockEngine.js`, sin dependencias
// de React, para poder reutilizarla también fuera de la app (p. ej. en el runtime del widget
// de Android). Este hook es solo el envoltorio que la conecta al ciclo de vida de React.
export function useAnimatedFigmaClock({ rootRef, snapshot, hemisphere = 'south', readyKey = 'default' }) {
  const stateRef = useRef(null)
  if (!stateRef.current) {
    stateRef.current = createFigmaClockState(readyKey)
  }

  const geo = useMemo(() => deriveValidGeo(snapshot), [snapshot])
  const moonPhase = useMemo(() => deriveValidMoonPhase(snapshot), [snapshot])
  const civilHour = useMemo(() => deriveValidCivilHour(snapshot), [snapshot])

  useLayoutEffect(() => {
    let cancelled = false

    applyFigmaClockState({
      root: rootRef.current,
      geo,
      moonPhase,
      civilHour,
      hemisphere,
      readyKey,
      state: stateRef.current,
      isCancelled: () => cancelled,
    })

    return () => {
      cancelled = true
    }
  }, [civilHour, geo, hemisphere, moonPhase, readyKey, rootRef])
}
