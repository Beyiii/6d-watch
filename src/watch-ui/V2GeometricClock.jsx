import { useLayoutEffect, useRef } from 'react'

import relojV2Raw from '../../public/reloj-v2.svg?raw'
import { useWatch } from '../context/WatchContext.jsx'
import { useAnimatedFigmaClock } from '../hooks/useAnimatedFigmaClock.js'
import { cn } from './lib/utils.js'

const CLOCK_DISPLAY_SCALE = 1.3

export function V2GeometricClock({ className }) {
  const { hasLoadedActiveLocation, location, snapshot } = useWatch()
  const wrapRef = useRef(null)
  const hemisphere = location.lat < 0 ? 'south' : 'north'

  useLayoutEffect(() => {
    const wrap = wrapRef.current
    if (!wrap) return

    wrap.setAttribute('data-ready', '0')
    wrap.innerHTML = relojV2Raw

    return () => {
      wrap.innerHTML = ''
    }
  }, [])

  useAnimatedFigmaClock({
    rootRef: wrapRef,
    snapshot: hasLoadedActiveLocation ? snapshot : null,
    hemisphere,
    readyKey: 'v2-clock',
  })

  return (
    <div className={cn('v2-figma-clock-display', className)}>
      <div
        className="v2-figma-clock-scale"
        style={{
          transform: `scale(${CLOCK_DISPLAY_SCALE})`,
          transformOrigin: 'center center',
        }}
      >
        <div
          ref={wrapRef}
          className="v2-figma-clock"
          data-ready="0"
          role="img"
          aria-label="Reloj geométrico de 24 horas"
        />
      </div>
    </div>
  )
}
