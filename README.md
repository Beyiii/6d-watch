# 6D-Watch

6D-Watch es un reloj astronómico y geométrico. Muestra el tiempo a partir del ciclo real del Sol en un lugar y una fecha, junto con la hora civil de siempre.

La aplicación está pensada para quien quiere ver el día como un ciclo de luz: cuándo amanece, cuánto dura el día, cómo se mueve el Sol y en qué punto del periodo diurno o nocturno se encuentra.

## ¿Qué es 6D-Watch?

Un reloj civil divide el día en 24 horas iguales, independientes de si afuera es de día o de noche. Eso es útil y preciso, pero no describe cómo varían los periodos de luz y oscuridad según la latitud, la ubicación y la época del año.

6D-Watch añade una lectura complementaria: la **hora geométrica**. No sustituye a la hora civil. Divide el periodo diurno (amanecer–atardecer) y el nocturno (atardecer–amanecer siguiente) en tramos iguales, de modo que el amanecer corresponde a las 6, el punto medio del periodo diurno a las 12, el atardecer a las 18 y el punto medio del periodo nocturno a las 0.

Así, la misma hora geométrica representa una posición equivalente dentro del ciclo diurno o nocturno, aunque la duración de estos periodos cambie según la estación y la ubicación.

Para calcularla, la aplicación utiliza la **ubicación**, la **fecha** y la **zona horaria**, y a partir de estos datos obtiene los eventos solares y lunares correspondientes al lugar seleccionado.

## Funcionalidades principales

- Hora civil y hora geométrica, visibles a la vez
- Amanecer, atardecer y duración del día y de la noche
- Información solar y lunar, incluida la fase de la Luna
- Trayectoria solar a lo largo del día
- Mapa con el terminador (línea día/noche) y zonas crepusculares
- Calendario y consulta de un día concreto
- Comparación entre fechas
- Selección de ubicación y comparación entre lugares

## Vistas de la aplicación

- **Inicio.** Reloj geométrico y un resumen del día: horas, luz, ubicación y fase lunar.
- **El Día.** Detalle de la información solar y lunar, junto con datos de los periodos diurno y nocturno.
- **Calendario.** Consulta por fecha, estación y comparación entre días.
- **Mapa.** Vista global de la iluminación terrestre, con terminador, crepúsculos y comparación de ubicaciones.

## ¿Cómo funciona?

El usuario elige un lugar —o utiliza uno guardado— y, si lo desea, una fecha. Con esas coordenadas y la zona horaria correspondiente, 6D-Watch calcula los instantes de amanecer, atardecer y distintos eventos solares y lunares.

Estos datos alimentan el reloj, las tarjetas informativas, el calendario y el mapa, de modo que cada vista presenta una forma distinta de observar el mismo ciclo temporal y astronómico.

También existe una versión para Android, empaquetada con Capacitor, además de la versión web.

## Tecnologías

- React
- Vite
- SunCalc
- Luxon
- Leaflet
- Capacitor
- Tailwind CSS

## Probar la aplicación

Versión web disponible en GitHub Pages:

**[Abrir 6D-Watch](https://Beyiii.github.io/6d-watch)**

## Proyecto

6D-Watch se desarrolló como proyecto de memoria de Ingeniería Civil en Computación.