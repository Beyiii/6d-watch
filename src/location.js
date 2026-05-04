import { initMap } from './map.js'

export function initLocation(onLocationChange) {

  initMap((lat, lon) => {
    console.log("Selected location:", lat, lon)

    onLocationChange({
      lat,
      lon
    })
  })
}