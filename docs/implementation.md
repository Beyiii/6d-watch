# Implementación del reloj geométrico

La implementación del reloj geométrico se basa en el cálculo de eventos solares reales y en la normalización del ciclo día–noche a un intervalo geométrico de 24 unidades.

## Librerías utilizadas

Para obtener los eventos solares se utiliza la librería:

- SunCalc

Esta librería permite calcular eventos astronómicos como:

- salida del Sol
- puesta del Sol
- mediodía solar
- crepúsculos

a partir de:

- latitud
- longitud
- fecha

## Datos necesarios

Para calcular la hora geométrica se requieren los siguientes valores:

- t → hora local actual
- t_sunrise → salida del Sol del día actual
- t_sunset → puesta del Sol del día actual
- t_nextSunrise → salida del Sol del día siguiente

## Obtención de eventos solares

Los eventos solares se calculan utilizando la fecha actual y las coordenadas geográficas del lugar.

Ejemplo conceptual:

- calcular sunrise y sunset para el día actual
- calcular sunrise del día siguiente

Esto permite determinar la duración completa del ciclo día–noche.

## Cálculo de la hora geométrica

El cálculo se divide en dos casos:

### Durante el día

Condición:

t_sunrise ≤ t < t_sunset

Progreso del día:

progress_day = (t - t_sunrise) / (t_sunset - t_sunrise)

Hora geométrica:

Hg = 6 + (progress_day × 12)

Esto mapea el intervalo sunrise–sunset al intervalo geométrico 6–18.

### Durante la noche

Condición:

t_sunset ≤ t < t_nextSunrise

Progreso de la noche:

progress_night = (t - t_sunset) / (t_nextSunrise - t_sunset)

Hora geométrica:

Hg = 18 + (progress_night × 12)

Para mantener la hora dentro del intervalo del reloj se aplica una normalización circular:

Hg = (Hg + 24) mod 24

## Formato de salida

La hora geométrica se calcula inicialmente como un número decimal.

Ejemplo:

17.8918

Luego se puede convertir a formato de reloj:

HH:MM

Por ejemplo:

17:53

## Actualización en tiempo real

El reloj se actualiza periódicamente utilizando un temporizador del sistema (por ejemplo `setInterval`).

Esto permite recalcular la hora geométrica cada segundo o cada minuto para simular el comportamiento de un reloj continuo.