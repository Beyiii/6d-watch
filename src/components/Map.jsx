import { useEffect, useRef } from 'react'
import { createMap } from '../map.js'

export default function Map({ onSelectLocation, markerPosition, overlayMode = 'compact' }) {
  const containerRef = useRef(null)
  const instanceRef = useRef(null)
  const callbackRef = useRef(onSelectLocation)

  useEffect(() => {
    callbackRef.current = onSelectLocation
  }, [onSelectLocation])

  // Mount once — use a stable wrapper for the callback so Leaflet isn't re-created on every render.
  useEffect(() => {
    if (!containerRef.current) return
    const instance = createMap(
      containerRef.current,
      (lat, lon) => callbackRef.current?.(lat, lon),
      markerPosition?.lat,
      markerPosition?.lon,
      { overlayMode },
    )
    instanceRef.current = instance
    return () => {
      instance.destroy()
      instanceRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [overlayMode])

  // Sync marker whenever the active location changes externally (e.g. saved location selected).
  useEffect(() => {
    if (!markerPosition || !instanceRef.current) return
    instanceRef.current.updateMarker(markerPosition.lat, markerPosition.lon)
  }, [markerPosition?.lat, markerPosition?.lon])

  return <div id="map" ref={containerRef}></div>
}
