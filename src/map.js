import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

import iconRetinaUrl from 'leaflet/dist/images/marker-icon-2x.png'
import iconUrl from 'leaflet/dist/images/marker-icon.png'
import shadowUrl from 'leaflet/dist/images/marker-shadow.png'

import { createSolarTerminatorOverlay } from './mapOverlays/solarTerminatorOverlay.js'

// Fix para bundlers (Vite/webpack): asegura que el marcador por defecto cargue sus assets.
delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl,
  iconUrl,
  shadowUrl,
})

export function createMap(container, onSelectLocation, initialLat, initialLon, options = {}) {
  const { overlayMode = 'compact' } = options
  const worldBounds = L.latLngBounds(
    L.latLng(-85, -180),
    L.latLng(85, 180),
  )

  const wrapBounds = L.latLngBounds(
    L.latLng(-85, -270),
    L.latLng(85, 270),
  )

  const map = L.map(container, {
    minZoom: 1,
    maxBounds: wrapBounds,
    maxBoundsViscosity: 1.0,
    worldCopyJump: false,
  }).setView([-33.4489, -70.6693], 5)

  // Extra safety: keep the view inside bounds while dragging (prevents wrap/repeat).
  const clampToBounds = () => {
    map.panInsideBounds(wrapBounds, { animate: false })
  }

  map.on('drag', clampToBounds)

  const logZoom = () => {
    // Useful to pick an exact minZoom where the terminator still looks good.
    // eslint-disable-next-line no-console
    console.log('[map] zoom:', map.getZoom())
  }

  map.on('zoomend', logZoom)

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap contributors',
    noWrap: false,
    minZoom: 1,
  }).addTo(map)

  const solarOverlay = createSolarTerminatorOverlay(map, { mode: overlayMode })

  let marker

  const updateMarker = (lat, lon) => {
    if (marker) {
      marker.setLatLng([lat, lon])
    } else {
      marker = L.marker([lat, lon]).addTo(map)
    }
  }

  if (initialLat !== undefined && initialLon !== undefined) {
    updateMarker(initialLat, initialLon)
  }

  const onClick = (e) => {
    const { lat, lng } = e.latlng
    updateMarker(lat, lng)
    onSelectLocation(lat, lng)
  }

  map.on('click', onClick)

  return {
    map,
    updateMarker,
    destroy() {
      map.off('click', onClick)
      map.off('drag', clampToBounds)
      map.off('zoomend', logZoom)
      solarOverlay.destroy()
      map.remove()
    },
  }
}

export function initMap(onSelectLocation) {
  const container = document.getElementById('map')
  if (!container) return null

  return createMap(container, onSelectLocation)
}