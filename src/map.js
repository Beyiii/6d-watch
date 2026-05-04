import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

import iconRetinaUrl from 'leaflet/dist/images/marker-icon-2x.png'
import iconUrl from 'leaflet/dist/images/marker-icon.png'
import shadowUrl from 'leaflet/dist/images/marker-shadow.png'

// Fix para bundlers (Vite/webpack): asegura que el marcador por defecto cargue sus assets.
delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl,
  iconUrl,
  shadowUrl,
})

export function createMap(container, onSelectLocation) {
  const map = L.map(container).setView([-33.4489, -70.6693], 5)

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap contributors',
  }).addTo(map)

  let marker

  const onClick = (e) => {
    const { lat, lng } = e.latlng

    if (marker) {
      marker.setLatLng([lat, lng])
    } else {
      marker = L.marker([lat, lng]).addTo(map)
    }

    onSelectLocation(lat, lng)
  }

  map.on('click', onClick)

  return {
    map,
    destroy() {
      map.off('click', onClick)
      map.remove()
    },
  }
}

export function initMap(onSelectLocation) {
  const container = document.getElementById('map')
  if (!container) return null

  return createMap(container, onSelectLocation)
}