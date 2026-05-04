# Bitácora de desarrollo

Este documento registra el progreso del desarrollo del reloj geométrico basado en el ciclo solar.

El objetivo es documentar decisiones de diseño, implementación y avances para facilitar la futura redacción de la memoria del proyecto.

---

### Etapa inicial del proyecto

Se definió el objetivo del proyecto:

Desarrollar un sistema de medición del tiempo basado en el ciclo solar local, donde el día y la noche se adapten dinámicamente a la duración real de la luz solar.

Se decidió representar el tiempo mediante una **hora geométrica** dentro de un ciclo normalizado de 24 unidades.

---

### Diseño del modelo temporal

Se diseñó un modelo donde:

- sunrise corresponde a la hora geométrica 6
- sunset corresponde a la hora geométrica 18

Esto divide el ciclo solar en dos partes:

- periodo diurno → 6 a 18
- periodo nocturno → 18 a 6

El modelo permite representar el ciclo completo día–noche dentro de un reloj continuo de 24 unidades.

---

### Modelo matemático

Se definió el cálculo del progreso dentro del día y la noche utilizando interpolación lineal.

Durante el día:

progress_day = (t - t_sunrise) / (t_sunset - t_sunrise)

Hg = 6 + progress_day × 12

Durante la noche:

progress_night = (t - t_sunset) / (t_nextSunrise - t_sunset)

Hg = 18 + progress_night × 12

Se incorporó una normalización circular:

Hg = (Hg + 24) mod 24

para mantener el resultado dentro del intervalo [0, 24).

---

### Implementación inicial

Se implementó el cálculo en JavaScript utilizando:

- fechas del sistema
- diferencias de tiempo en milisegundos
- interpolación lineal

Se desarrolló una función principal:

computeGeometricHour()

Esta función recibe:

- hora actual
- sunrise
- sunset
- next sunrise

y retorna la hora geométrica.

---

### Integración de datos solares

Se integró la librería SunCalc para calcular:

- salida del Sol
- puesta del Sol
- salida del Sol del día siguiente

a partir de coordenadas geográficas.

Las primeras pruebas se realizaron utilizando las coordenadas de Santiago de Chile.

---

### Visualización de resultados

Se implementó una visualización básica donde se muestra:

Hora geométrica: XX.XX

También se agregó formateo a formato de reloj:

HH:MM

---

### Estado actual

El sistema actualmente:

- calcula sunrise y sunset correctamente
- calcula el progreso del día o la noche
- genera una hora geométrica continua
- convierte el resultado a formato HH:MM

Las pruebas iniciales muestran resultados coherentes con la posición real del Sol.

---

## Martes 17 de marzo de 2026
 
### Refactorización y corrección de bugs en el cálculo de hora geométrica
 
Se identificaron y corrigieron varios problemas en la implementación inicial, y se realizó una refactorización general del código.
 
---
 
### Problema 1 — Tiempos solares desactualizados tras la medianoche
 
**Problema:** `sunrise` y `sunset` se calculaban una sola vez al iniciar la aplicación. Si el reloj seguía corriendo pasada la medianoche, los valores quedaban desactualizados y los cálculos eran incorrectos.
 
**Solución:** Se implementó un sistema de caché por fecha. Se almacena la fecha (`YYYY-MM-DD`) para la que se calcularon los tiempos solares. En cada tick del reloj se compara la fecha actual con la cacheada, y si cambió, se recalculan todos los tiempos. De este modo los datos se mantienen correctos sin recalcular innecesariamente cada segundo.
 
---
 
### Problema 2 — Bug en el cálculo de noche durante la madrugada
 
**Problema:** Si la hora civil era, por ejemplo, las 02:00 AM del martes, la función `computeGeometricHour` recibía el `sunset` del martes (que aún no había ocurrido). La resta `now - sunset` resultaba negativa, produciendo un `progressNight` incorrecto.
 
**Causa raíz:** La madrugada del martes pertenece a la noche que comenzó con el `sunset` del lunes, no al ciclo del martes.
 
**Solución:** Se incorporó el cálculo del `sunsetYesterday` en `getSunTimes()`. En `updateClock()` se evalúa si la hora actual es anterior al `sunriseToday`; en ese caso se usa `sunsetYesterday` como punto de partida de la noche activa. En cualquier otro caso (día o noche post-atardecer) se usa `sunsetToday`. Así `computeGeometricHour` recibe siempre un `sunset` que es anterior a `now`, y la resta nunca es negativa.
 
Los tres casos cubiertos son:
 
| Hora civil      | `isBeforeSunrise` | `activeSunset`     | Periodo          |
|-----------------|-------------------|--------------------|------------------|
| Lunes 14:00     | false             | sunsetToday        | Día              |
| Lunes 21:00     | false             | sunsetToday        | Noche            |
| Martes 02:00    | true              | sunsetYesterday    | Madrugada        |
 
---
 
### Problema 3 — Normalización de Hg con módulo
 
**Problema:** La expresión `(Hg + 24) % 24` era correcta pero poco legible, ya que no era evidente por qué se sumaba 24 ni qué rango de valores se esperaba.
 
**Decisión:** Se reemplazó por `Hg >= 24 ? Hg - 24 : Hg`. Como `Hg` durante la noche solo puede caer en el rango `[18, 30)`, una simple resta condicional es suficiente y comunica mejor la intención.
 
---
 
### Refactorización — Separación de funciones
 
Se separó el código en funciones con responsabilidades bien definidas:
 
- `getSunTimes(now)` — obtiene y cachea los tiempos solares (hoy, ayer y mañana).
- `computeGeometricHour(now, sunrise, sunset, nextSunrise)` — calcula la hora geométrica decimal. No toma decisiones sobre qué fechas usar; eso es responsabilidad de quien la llama.
- `formatGeometricTime(geometricHour)` — convierte la hora geométrica decimal a `HH:MM:SS`.
- `formatCivilTime(date)` — convierte un objeto `Date` a `HH:MM:SS`.
- `formatDuration(ms)` — convierte milisegundos a `Xh YYm`.
 
---
 
### Nuevas funcionalidades añadidas
 
**Segundos geométricos:** `formatGeometricTime` ahora retorna `HH:MM:SS`. Los segundos se obtienen convirtiendo la hora decimal a segundos totales (`geometricHour × 3600`) y extrayendo el resto.
 
**Duración del día y la noche:** Se calculan como:
- `dayLength = sunsetToday - sunriseToday`
- `nightLength = nextSunrise - sunsetToday`
 
y se muestran en formato `Xh YYm`.
 
**Visualización de ambos relojes:** Se muestra simultáneamente la hora civil (`HH:MM:SS`) y la hora geométrica (`HH:MM:SS`) en el DOM.
 
---
 
### Estado al cierre de la sesión
 
El sistema actualmente:
 
- calcula sunrise y sunset correctamente y los recalcula automáticamente al cambiar la fecha
- maneja correctamente los tres periodos del ciclo solar (día, noche, madrugada)
- genera una hora geométrica continua en `[0, 24)`
- muestra hora geométrica y hora civil en formato `HH:MM:SS`
- muestra la duración del día y la noche en formato `Xh YYm`

---

## Miercoles 18 de marzo de 2026

### 📝 Idea clave del reloj geométrico

El reloj geométrico no busca representar la posición física exacta del Sol en el cielo, sino el progreso del ciclo día–noche definido por los eventos solares (sunrise y sunset).

El modelo transforma un fenómeno natural irregular en una escala temporal continua y uniforme, donde:

Hg = 0–12 representa la noche

Hg = 12–24 representa el día (o viceversa según convención)

De esta forma, el reloj expresa en qué fase del día estamos, más que la posición exacta del Sol.

El mediodía solar (solarNoon) no se usa como base del modelo, sino como referencia de validación, verificando que Hg ≈ 12 en ese instante.

**👉 En resumen: el sistema no modela directamente el movimiento del Sol, sino el ritmo del ciclo solar de forma geométrica, continua e interpretable.**

## Sabado 28 de marzo de 2026
### ✅ Avances del día

Se implementó la selección de ubicación mediante un mapa interactivo utilizando Leaflet con datos de OpenStreetMap.

Funcionalidades logradas:

- Visualización de mapa en la interfaz.
- Selección de cualquier punto del mundo mediante clic.
- Obtención de coordenadas (`lat`, `lon`) dinámicamente.
- Visualización de la ubicación seleccionada en pantalla.
- Separación modular del código:
  - `main.js` → lógica principal
  - `astronomy.js` → cálculos solares y lunares
  - `location.js` / `map.js` → manejo de ubicación

---

### 🧠 Decisiones importantes

- Se priorizó funcionalidad sobre estética (UI desordenada temporalmente).
- Se eligió Leaflet por simplicidad y rapidez de implementación.
- Se pospone el uso de herramientas más complejas (3D, MapLibre, etc.) para etapas posteriores.
- Se mantiene arquitectura modular para facilitar escalabilidad.

---

### 🌍 Insight clave

El sistema ahora permite seleccionar cualquier punto del planeta, incluso zonas no habitadas, reforzando la idea de que el modelo depende únicamente de:

> posición en la Tierra + el Sol

---

### 🔜 Próximos pasos

- Conectar las coordenadas seleccionadas con el cálculo de eventos solares.
- Reemplazar coordenadas fijas (Santiago) por ubicación dinámica.
- Incorporar manejo de zona horaria para cada ubicación.
- Mejorar progresivamente la interfaz visual (fase posterior).

---

### 🧡 Nota personal

Se retomó el proyecto tras una pausa, logrando avanzar hacia una funcionalidad clave: pasar de un sistema local a un explorador global.

## Lunes 30 de marzo de 2026

### ✅ Avances del día

Se integró la selección dinámica de ubicación con el sistema de cálculo del reloj geométrico.

Funcionalidades logradas:

- Eliminación de coordenadas fijas (Santiago) en los cálculos.
- Actualización automática del sistema al cambiar de ubicación.
- Implementación de estado global (`currentLocation`) para manejar:
  - latitud
  - longitud
  - zona horaria (temporalmente fija)
- Reinicio del caché diario al cambiar de ubicación.

---

### ⚠️ Limitación actual

Actualmente, el sistema utiliza:

```text
timezone = "UTC"
```

Esto implica que:

- La hora utilizada en los cálculos NO corresponde a la hora local real del lugar seleccionado.
- Todas las ubicaciones del mundo comparten la misma referencia temporal (UTC).
- Puede existir desalineación entre:
  - el estado real del Sol en la ubicación (día/noche)
  - y la interpretación del modelo

Ejemplo:

> Una ubicación puede estar en pleno día, pero el sistema interpretarla como noche debido al desfase horario.

---

### 🧠 Insight técnico

El modelo depende de dos componentes fundamentales:

- Posición geográfica (latitud, longitud)
- Referencia temporal (hora local)

Actualmente:

```text
posición → correcta
tiempo → global (UTC)
```

Para lograr precisión real:

```text
posición → correcta
tiempo → local (según zona horaria)
```

---

### 🔜 Próximos pasos

- Integrar una API de zona horaria (ej: GeoNames o TimeZoneDB).
- Obtener `timezone` a partir de `lat/lon`.
- Reemplazar `"UTC"` por la zona horaria real del lugar.
- Validar coherencia entre:
  - hora civil
  - eventos solares
  - hora geométrica

---

### 🧡 Nota personal

Se logró un avance clave: el sistema ahora es completamente dinámico a nivel geográfico.

El siguiente paso es alinear correctamente la dimensión temporal para representar fielmente el ciclo solar en cualquier punto del planeta.