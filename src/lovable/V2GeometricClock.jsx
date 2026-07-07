import { useLayoutEffect, useRef } from 'react'

import relojFigmaAdaptadoRaw from '../../public/reloj-figma-adaptado.svg?raw'
import { useWatch } from '../context/WatchContext.jsx'
import { useAnimatedFigmaClock } from '../hooks/useAnimatedFigmaClock.js'
import { cn } from './lib/utils.js'

export function V2GeometricClock({ className }) {
  const { location, snapshot } = useWatch()
  const wrapRef = useRef(null)
  const hemisphere = location.lat < 0 ? 'south' : 'north'

  useLayoutEffect(() => {
    const wrap = wrapRef.current
    if (!wrap) return

    wrap.setAttribute('data-ready', '0')
    wrap.innerHTML = relojFigmaAdaptadoRaw

    return () => {
      wrap.innerHTML = ''
    }
  }, [])

  useAnimatedFigmaClock({
    rootRef: wrapRef,
    snapshot,
    hemisphere,
    readyKey: 'v2-clock',
  })

  return (
    <div
      ref={wrapRef}
      className={cn('v2-figma-clock', className)}
      data-ready="0"
      role="img"
      aria-label="Reloj geométrico de 24 horas"
    />
  )
}
