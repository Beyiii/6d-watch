import { useRef } from 'react'

import relojFigmaRaw from '../../docs/reloj-figma.svg?raw'
import { useAnimatedFigmaClock } from '../hooks/useAnimatedFigmaClock.js'

export default function ExperimentalFigmaClock({ snapshot, hemisphere = 'south' }) {
  const wrapRef = useRef(null)
  useAnimatedFigmaClock({ rootRef: wrapRef, snapshot, hemisphere })

  return (
    <div
      ref={wrapRef}
      className="experimental-figma-clock"
      data-ready="0"
      // eslint-disable-next-line react/no-danger
      dangerouslySetInnerHTML={{ __html: relojFigmaRaw }}
    />
  )
}
