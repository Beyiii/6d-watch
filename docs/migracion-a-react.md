# Migración a React (Vite + React)

Fecha: 2026-04-28

Este documento resume los cambios realizados para migrar la UI del proyecto a **React web**, manteniendo la lógica de cálculo separada en módulos reutilizables.

## Objetivo

1. Separar la lógica “pura” (hora geométrica, datos solares/lunares, formateos) de la UI.
2. Mantener esa lógica en módulos reutilizables (sin DOM/React).
3. Migrar la UI a React por etapas, envolviendo lo que ya existía (reloj analógico, Leaflet, arco solar).

## Qué cambió (alto nivel)

- Se creó una capa `src/core/*` con lógica reutilizable (sin DOM).
- Se creó una UI React que renderiza el mismo dashboard que antes estaba en `index.html` + `src/main.js`.
- Se mantuvieron módulos existentes (por ejemplo `src/clock.js`, `src/astronomy.js`) y se “envolvieron” desde React con `useEffect`.

## Archivos agregados

### React / arranque

- [vite.config.js](../vite.config.js)
  - Agregado para habilitar React en Vite mediante `@vitejs/plugin-react`.

- [src/main.jsx](../src/main.jsx)
  - Nuevo entrypoint de React.
  - Monta la app con `ReactDOM.createRoot(...).render(<App />)`.

- [src/App.jsx](../src/App.jsx)
  - UI principal del dashboard.
  - Administra `location` y consume el “snapshot” calculado desde `src/core/*`.
  - Aplica el fondo dinámico seteando CSS variables en `document.body`.

### Hooks

- [src/hooks/useClockData.js](../src/hooks/useClockData.js)
  - Mantiene el “tick” de 1s (estado `nowLuxon`).
  - Implementa un cache por día/ubicación para no recalcular todos los datos de SunCalc cada segundo.
  - Devuelve `snapshot` listo para UI.

### Componentes React (wrappers de módulos existentes)

- [src/components/GeoClock.jsx](../src/components/GeoClock.jsx)
  - Wrapper React para el reloj analógico existente.
  - Inicializa el DOM del reloj 1 vez (con `createClock`) y luego actualiza manecillas (con `updateAnalogClock`).

- [src/components/Map.jsx](../src/components/Map.jsx)
  - Wrapper React para Leaflet.
  - Crea y destruye el mapa correctamente en el ciclo de vida de React (incluye compatibilidad con StrictMode).

- [src/components/SolarArc.jsx](../src/components/SolarArc.jsx)
  - Wrapper React para el arco solar.
  - Mantiene un único loop de `requestAnimationFrame` y usa refs para leer el último estado.

### Lógica core (reutilizable)

- [src/core/geometricTime.js](../src/core/geometricTime.js)
  - `computeGeometricHour()`
  - `formatGeometricTime()`
  - `splitGeometricHMS()`

- [src/core/timeFormat.js](../src/core/timeFormat.js)
  - Helpers de formateo: duración y horas en distintas zonas.

- [src/core/celestial.js](../src/core/celestial.js)
  - Cálculos de dominio (SunCalc + `astronomy.js`) para obtener: amanecer/atardecer, sunrise siguiente, eventos solares y datos lunares.

- [src/core/clockSnapshot.js](../src/core/clockSnapshot.js)
  - Función principal para la UI: `computeClockSnapshot(nowLuxon, location, dailyCelestial?)`.
  - Retorna un objeto con:
    - `ui`: strings listos para render
    - `solar`, `lunar`, `specialLight`: datos formateados
    - `raw`: datos crudos (incluye `geometricHour` y `geoHms`) para componentes como el reloj/arco

- [src/core/background.js](../src/core/background.js)
  - Paleta del gradiente dinámico (anchors + mezcla).
  - `getDynamicBackgroundColors(geometricHour)` retorna `{ start, mid, end }`.

### UI no-React reutilizada

- [src/ui/solarArc.js](../src/ui/solarArc.js)
  - Extraído desde la lógica previa de `src/main.js`.
  - Implementa `ensureSolarArcTemplate()`, `updateSolarArc()`, `setSolarArcFallback()` sin depender de React.

## Archivos modificados

- [package.json](../package.json)
  - Se agregaron dependencias:
    - `react`, `react-dom`
    - `@vitejs/plugin-react` (devDependency)

- [index.html](../index.html)
  - Se reemplazó la estructura HTML del dashboard por un único `<div id="root"></div>`.
  - Se cambió el script de entrada a `/src/main.jsx`.
  - Se agregó `meta viewport`.
  - Se mantuvieron los CSS (`index.css`, `clock.css`) y Bootstrap Icons CDN.

- [src/map.js](../src/map.js)
  - Se agregó `createMap(container, onSelectLocation)` que retorna `{ destroy() }`.
  - Se mantiene `initMap()` como wrapper legacy (usa `document.getElementById('map')`).
  - Se configuraron los assets del marcador por defecto de Leaflet para que funcionen bien con Vite.

## Archivos “legacy” (quedaron, pero ya no son la entrada)

- [src/main.js](../src/main.js)
  - Era el entrypoint anterior (vanilla JS + manipulación directa de DOM).
  - Sigue existiendo por referencia/histórico, pero **ya no se ejecuta** porque [index.html](../index.html) ahora apunta a `/src/main.jsx`.

- [src/location.js](../src/location.js)
  - Se usaba por `src/main.js` para inicializar el mapa.
  - Con React, el mapa ahora se maneja desde [src/components/Map.jsx](../src/components/Map.jsx).

- [src/calendar.js](../src/calendar.js)
  - Se usaba por `src/main.js` para el calendario (que en el dashboard actual estaba oculto).
  - La UI React actual no renderiza calendario, así que este módulo quedó fuera del flujo.

## Archivos que hoy puedes borrar sin problema (si solo te importa la app React actual)

Actualmente hay **3 archivos legacy** que no son usados por la entrada React ni por [src/App.jsx](../src/App.jsx). Si los borras, la app React debería seguir compilando y funcionando igual (según el estado actual):

1. [src/main.js](../src/main.js)
2. [src/location.js](../src/location.js)
3. [src/calendar.js](../src/calendar.js)

Si planeas re-introducir el calendario más adelante, conserva [src/calendar.js](../src/calendar.js) como base.

## Buenas prácticas (simple) para este proyecto en React

- **Un solo entrypoint real**: está bien que exista `main.js` viejo, pero el que manda es el que carga [index.html](../index.html). Ahora el entrypoint es [src/main.jsx](../src/main.jsx).
- **`.jsx` vs `.js`**:
  - Usa **`.jsx`** cuando el archivo contenga JSX (componentes como [src/App.jsx](../src/App.jsx)).
  - Usa **`.js`** para lógica pura, helpers y módulos “de dominio” (como `src/core/*`). Es una buena práctica: más reutilizable y fácil de testear.
- **Evitar DOM directo en componentes (salvo wrappers)**:
  - Lo ideal es que React renderice HTML.
  - Si usas librerías que requieren DOM (Leaflet / reloj analógico existente), envuélvelas como hicimos en componentes tipo wrapper con `useEffect` y cleanup (ver [src/components/Map.jsx](../src/components/Map.jsx)).
- **Efectos y loops**:
  - Para intervalos (`setInterval`) o animaciones (`requestAnimationFrame`), siempre agrega cleanup en el `return` del `useEffect` para evitar fugas.
  - Evita re-crear loops por cambios de estado frecuentes: usa refs para leer el “último snapshot” (ver [src/components/SolarArc.jsx](../src/components/SolarArc.jsx)).
- **Separación recomendada**:
  - `src/core/*`: cálculos puros + snapshots listos para UI.
  - `src/components/*`: UI React + wrappers.
  - `src/hooks/*`: estado/intervalos/caching.

## Cómo correr

- Dev: `npm run dev`
- Build: `npm run build`
- Preview: `npm run preview`

Nota: `npm run dev` es un proceso de larga duración. Si lo detienes manualmente (cerrando terminal o “kill”), es normal que VS Code muestre un exit code distinto de 0.
