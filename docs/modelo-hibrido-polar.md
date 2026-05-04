# Modelo Polar para Hora Geométrica (ventana extendida)

Este documento define el significado y el método de cálculo de la hora geométrica en latitudes medias y en regiones polares.

## Objetivo

Mantener el significado de los hitos:

- Amanecer → 6
- Mediodía → 12
- Atardecer → 18
- Medianoche → 0

Sin “inventar noche” si el Sol sigue sobre el horizonte. En particular, en día/noche polar la hora geométrica debe seguir existiendo, pero avanzando muy lentamente (porque el intervalo real dura varios días).

## Problema

El modelo clásico sunrise–sunset del día funciona cuando existen eventos cercanos:

- amanecer (sunrise)
- atardecer (sunset)

En regiones polares puede ocurrir:

- Día polar: el Sol no se pone (no hay `sunset` durante varios días)
- Noche polar: el Sol no sale (no hay `sunrise` durante varios días)

En esos escenarios, “hoy” no tiene amanecer/atardecer, pero el ciclo real sigue teniendo un amanecer previo (hace días) y un atardecer próximo (en días).

## Estrategia

La app usa un enfoque en dos capas:

1. Caso normal: usar los eventos de “hoy” cuando existen (duración del día y noche usual).
2. Caso polar/extremo: construir una **ventana extendida** buscando el evento previo y el evento siguiente aunque estén a días de distancia.

Para decidir si estamos en “día” o “noche”, se evalúa la altura del Sol en el instante actual (SunCalc `getPosition(...).altitude`).

## Ventana extendida (modo polar)

### Si el Sol está sobre el horizonte (día)

Se busca:

- $t_\text{sunrise,prev}$: el último amanecer real anterior a `now`
- $t_\text{sunset,next}$: el próximo atardecer real posterior a `now`

Y se mapea linealmente a $[6,18]$:

$$
progress_{day}=\frac{t-t_{\text{sunrise,prev}}}{t_{\text{sunset,next}}-t_{\text{sunrise,prev}}},\quad H_g=6+12\cdot progress_{day}
$$

Interpretación: durante un día polar, la hora geométrica permanece en el rango 6–18 durante varios días, avanzando muy lentamente.

### Si el Sol está bajo el horizonte (noche)

Se busca:

- $t_\text{sunset,prev}$: el último atardecer real anterior a `now`
- $t_\text{sunrise,next}$: el próximo amanecer real posterior a `now`

Y se mapea a la mitad nocturna (18→6, con wrap):

$$
progress_{night}=\frac{t-t_{\text{sunset,prev}}}{t_{\text{sunrise,next}}-t_{\text{sunset,prev}}},\quad H_g=18+12\cdot progress_{night}
$$

Luego se normaliza a $[0,24)$ (es decir, cuando supera 24 se resta 24).

Interpretación: durante una noche polar, la hora geométrica recorre la mitad nocturna 18→6 durante varios días, también avanzando muy lentamente.

## Mensajes UI

Cuando la ventana extendida dura más de 24h (o cuando “hoy” no tiene amanecer/atardecer), se muestra un estado explícito, por ejemplo:

- “Día polar (próximo atardecer en 12 días)”
- “Duración del día: 12d 04h”

Análogo para la noche:

- “Noche polar (próximo amanecer en 8 días)”
- “Duración de la noche: 8d 11h”

## Notas y límites

- La búsqueda de eventos prev/next se limita (por rendimiento) a un máximo de ~370 días hacia atrás/adelante.
- En los días cercanos a los equinoccios (cambio entre polar y no polar), la transición puede ser sensible al umbral “Sol sobre el horizonte” (altitud >= 0).
- Si por alguna razón no se encuentran eventos en el rango de búsqueda, el cálculo puede degradar a “—” para esa parte.
