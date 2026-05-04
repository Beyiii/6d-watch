import SunCalc from 'suncalc'

// ─── getSolarEvents() ─────────────────────────────────────────────────────────
// Calcula los eventos solares del día para una ubicación y fecha dadas.
//
// SunCalc.getTimes() retorna un objeto con muchos eventos solares nombrados.
// Los que usamos acá son:
//
//   solarNoon        → mediodía solar (el Sol alcanza su punto más alto)
//   goldenHourEnd    → fin de la golden hour matutina (el Sol sube sobre ~6°)
//   goldenHour       → inicio de la golden hour vespertina (el Sol baja bajo ~6°)
//   blueHourEnd      → no existe en SunCalc directamente; se aproxima con
//                      "nauticalDawn" (Sol entre -12° y -6°, amanecer náutico)
//   blueHour         → análogo vespertino: "nauticalDusk"
//
// Sobre golden hour y blue hour:
//   SunCalc define "goldenHour" como cuando la elevación del Sol es < 6°.
//   La blue hour ocurre cuando está entre -6° y -4°, que SunCalc aproxima
//   con los eventos náuticos (nauticalDawn / nauticalDusk).
//   No son exactos al grado, pero son suficientemente precisos para uso cotidiano.
//
// La elevación máxima se calcula por separado con SunCalc.getPosition()
// en el momento del mediodía solar.

export function getSolarEvents(date, lat, lon) {
  const times = SunCalc.getTimes(date, lat, lon)

  // Elevación máxima del Sol: se consulta la posición en el mediodía solar
  const noonPosition = SunCalc.getPosition(times.solarNoon, lat, lon)
  const maxElevationDeg = noonPosition.altitude * (180 / Math.PI)  // rad → grados

  return {
    solarNoon:       times.solarNoon,        // mediodía solar

    goldenHourMorningStart: times.sunrise,   // golden hour matutina: desde el amanecer
    goldenHourMorningEnd:   times.goldenHourEnd,  // hasta que el Sol sube sobre ~6°

    goldenHourEveningStart: times.goldenHour,     // golden hour vespertina: desde que baja bajo ~6°
    goldenHourEveningEnd:   times.sunset,          // hasta el atardecer

    blueHourMorningStart:   times.nauticalDawn,   // blue hour matutina: Sol entre -12° y -6°
    blueHourMorningEnd:     times.dawn,            // hasta el amanecer civil (~-6°)

    blueHourEveningStart:   times.dusk,            // blue hour vespertina: desde el anochecer civil
    blueHourEveningEnd:     times.nauticalDusk,    // hasta el anochecer náutico

    maxElevationDeg: maxElevationDeg.toFixed(1),   // elevación máxima en grados, 1 decimal
  }
}

// ─── getLunarData() ───────────────────────────────────────────────────────────
// Calcula los datos lunares del día para una ubicación y fecha dadas.
//
// SunCalc.getMoonIllumination() retorna:
//   fraction  → porcentaje de iluminación [0, 1]
//   phase     → fase lunar [0, 1] donde:
//                 0.0 = luna nueva
//                 0.25 = cuarto creciente
//                 0.5 = luna llena
//                 0.75 = cuarto menguante
//
// SunCalc.getMoonTimes() retorna la salida y puesta de la Luna.
// A diferencia del Sol, la Luna puede no salir o no ponerse en un día dado
// (especialmente en latitudes extremas), por eso puede retornar `undefined`.

export function getLunarData(date, lat, lon) {
  const illumination = SunCalc.getMoonIllumination(date)
  const moonTimes    = SunCalc.getMoonTimes(date, lat, lon)

  return {
    phase:           illumination.phase,                          // [0, 1]
    phaseName:       getPhaseName(illumination.phase),            // nombre legible
    illumination:    Math.round(illumination.fraction * 100),     // porcentaje entero

    moonrise: moonTimes.rise  ?? null,   // puede ser undefined si no sale ese día
    moonset:  moonTimes.set   ?? null,   // puede ser undefined si no se pone ese día
  }
}

// ─── getPhaseName() ───────────────────────────────────────────────────────────
// Convierte el valor numérico de fase lunar [0, 1] a un nombre legible.
// Los umbrales son aproximados y dividen el ciclo en 8 fases tradicionales.

function getPhaseName(phase) {
  if (phase < 0.0625) return 'Luna nueva'
  if (phase < 0.1875) return 'Creciente incipiente'
  if (phase < 0.3125) return 'Cuarto creciente'
  if (phase < 0.4375) return 'Creciente gibosa'
  if (phase < 0.5625) return 'Luna llena'
  if (phase < 0.6875) return 'Menguante gibosa'
  if (phase < 0.8125) return 'Cuarto menguante'
  if (phase < 0.9375) return 'Menguante incipiente'
  return 'Luna nueva'
}