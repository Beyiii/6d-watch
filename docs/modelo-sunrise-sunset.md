## Modelo geométrico solar (día–noche)

Este modelo define una hora geométrica basada en la posición del ciclo solar.  
El ciclo completo de día y noche se normaliza a un intervalo continuo de **24 unidades geométricas**.

El sistema utiliza eventos solares reales:

- salida del Sol (sunrise)
- puesta del Sol (sunset)
- salida del Sol del día siguiente (next sunrise)

Estos valores pueden obtenerse mediante librerías astronómicas como SunCalc.

---

## Estructura del reloj geométrico

El reloj geométrico se alinea con cuatro puntos del ciclo solar:

| Hora geométrica | Evento solar |
|---|---|
| 6  | Salida del Sol (sunrise) |
| 12 | Mediodía solar aproximado |
| 18 | Puesta del Sol (sunset) |
| 24 / 0 | Medianoche solar |

El intervalo **6–18** corresponde al día.  
El intervalo **18–24–6** corresponde a la noche.

Debido a que la duración real del día y la noche varía según latitud y fecha, cada hora geométrica representa una duración real diferente.

---

## Definiciones

Duración del día:

L_day = t_sunset - t_sunrise

Duración de la noche:

L_night = t_nextSunrise - t_sunset

Donde:

- t: hora local actual
- t_sunrise: salida del Sol
- t_sunset: puesta del Sol
- t_nextSunrise: salida del Sol del día siguiente

---

## Progreso durante el día

Si la hora actual se encuentra durante el día:

t_sunrise ≤ t < t_sunset

El progreso del día se define como:

progress_day = (t - t_sunrise) / (t_sunset - t_sunrise)

La hora geométrica se calcula como:

Hg = 6 + (progress_day × 12)

Esto mapea el intervalo real sunrise–sunset al intervalo geométrico **6–18**.

---

## Progreso durante la noche

Si la hora actual se encuentra durante la noche:

t_sunset ≤ t < t_nextSunrise

El progreso de la noche se define como:

progress_night = (t - t_sunset) / (t_nextSunrise - t_sunset)

La hora geométrica se calcula como:

Hg = 18 + (progress_night × 12)

Para mantener la hora dentro del intervalo del reloj (0–24), se aplica una normalización circular:

Hg = (Hg + 24) mod 24

Esto permite representar correctamente las horas posteriores a la medianoche.

---

## Parámetros del modelo

Input:

- t: hora local actual
- t_sunrise: salida del Sol
- t_sunset: puesta del Sol
- t_nextSunrise: salida del Sol del día siguiente

Output:

- Hora geométrica (Hg) en el rango [0, 24)

---

## Interpretación

Este modelo representa la posición relativa dentro del ciclo solar completo.

La duración real de cada hora geométrica cambia dinámicamente:

- Si el día es más largo (verano), las horas geométricas diurnas se expanden.
- Si el día es más corto (invierno), las horas geométricas diurnas se contraen.
- La noche se adapta de forma equivalente.

De esta forma, el reloj geométrico refleja directamente el ritmo solar local en lugar de un intervalo civil fijo.


---
Referencias:
Dohrn-van Rossum, Gerhard (1996)
History of the Hour: Clocks and Modern Temporal Orders

Rocha, J. (2014)
Unequal Hours and Medieval Timekeeping

North, J. (2005)
God's Clockmaker: Richard of Wallingford and the Invention of Time



🟢 Viernes

Objetivo:
Mostrar hora geométrica en pantalla.

Tarea:
Reemplazar texto inicial por:
Hora geométrica: X.XX

Criterio:
Verla cambiar en tiempo real.

🟢 Sábado (opcional ligero)

Refactor pequeño.
Ordenar código.
Nada más.