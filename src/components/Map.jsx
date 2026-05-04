import { useEffect, useRef } from 'react'

import { createMap } from '../map.js'

export default function Map({ onSelectLocation }) {
  const containerRef = useRef(null)

  useEffect(() => {
    if (!containerRef.current) return

    const instance = createMap(containerRef.current, onSelectLocation)
    return () => instance.destroy()
  }, [onSelectLocation])

  return <div id="map" ref={containerRef}></div>
}
