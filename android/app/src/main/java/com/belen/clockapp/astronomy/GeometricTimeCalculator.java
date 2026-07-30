package com.belen.clockapp.astronomy;

import org.shredzone.commons.suncalc.SunTimes;

import java.time.Duration;
import java.time.DateTimeException;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.time.format.DateTimeFormatter;

public final class GeometricTimeCalculator {

    private static final DateTimeFormatter CIVIL_HM = DateTimeFormatter.ofPattern("HH:mm");

    private GeometricTimeCalculator() {
    }

    public static WidgetState calculateNow() {
        return calculateAt(ZonedDateTime.now(), WidgetLocation.santiago());
    }

    public static WidgetState calculateNow(WidgetLocation location) {
        return calculateAt(ZonedDateTime.now(), location);
    }

    public static WidgetState calculateAt(ZonedDateTime now, WidgetLocation location) {
        WidgetLocation activeLocation = location != null ? location : WidgetLocation.santiago();
        ZoneId zoneId = resolveZoneId(activeLocation.getTimezone());
        ZonedDateTime localNow = now.withZoneSameInstant(zoneId);
        LocalDate today = localNow.toLocalDate();

        // Importante: commons-suncalc con .on(ZonedDateTime a mediodía) busca el *próximo*
        // rise/set desde ese instante, así que el amanecer matutino (antes del mediodía)
        // se salta al día siguiente. Usar LocalDate (medianoche) alinea con SunCalc.getTimes(noon)
        // de la app: amanecer/atardecer del día civil local.
        SunTimes todayTimes = sunTimesForLocalDate(
                today,
                zoneId,
                activeLocation.getLatitude(),
                activeLocation.getLongitude()
        );
        SunTimes yesterdayTimes = sunTimesForLocalDate(
                today.minusDays(1),
                zoneId,
                activeLocation.getLatitude(),
                activeLocation.getLongitude()
        );
        SunTimes tomorrowTimes = sunTimesForLocalDate(
                today.plusDays(1),
                zoneId,
                activeLocation.getLatitude(),
                activeLocation.getLongitude()
        );

        ZonedDateTime sunriseToday = todayTimes.getRise();
        ZonedDateTime sunsetToday = todayTimes.getSet();
        ZonedDateTime sunsetYesterday = yesterdayTimes.getSet();
        ZonedDateTime nextSunrise = tomorrowTimes.getRise();

        if (sunriseToday == null || sunsetToday == null || sunsetYesterday == null || nextSunrise == null) {
            return WidgetState.unavailable();
        }

        boolean isDay = !localNow.isBefore(sunriseToday) && localNow.isBefore(sunsetToday);
        ZonedDateTime activeSunset = localNow.isBefore(sunriseToday) ? sunsetYesterday : sunsetToday;
        ZonedDateTime activeNextSunrise = localNow.isBefore(sunriseToday) ? sunriseToday : nextSunrise;

        Double geometricHour = computeGeometricHour(localNow, sunriseToday, activeSunset, activeNextSunrise);
        String civilTimeHm = localNow.format(CIVIL_HM);

        return new WidgetState(
                "6D-Watch",
                formatGeometricTimeHm(geometricHour),
                civilTimeHm,
                "Ubicación: " + activeLocation.getName(),
                "Estado: " + (isDay ? "Día" : "Noche"),
                isDay,
                geometricHour,
                sunriseToday,
                sunsetToday,
                activeNextSunrise,
                activeSunset
        );
    }

    private static SunTimes sunTimesForLocalDate(
            LocalDate localDate,
            ZoneId zoneId,
            double latitude,
            double longitude
    ) {
        return SunTimes.compute()
                .on(localDate)
                .timezone(zoneId)
                .at(latitude, longitude)
                .execute();
    }

    private static ZoneId resolveZoneId(String timezone) {
        if (timezone != null && !timezone.isEmpty()) {
            try {
                return ZoneId.of(timezone);
            } catch (DateTimeException ignored) {
                // Fall through to device timezone.
            }
        }

        try {
            return ZoneId.systemDefault();
        } catch (DateTimeException ignored) {
            return ZoneId.of("UTC");
        }
    }

    private static Double computeGeometricHour(ZonedDateTime now, ZonedDateTime sunrise, ZonedDateTime sunset, ZonedDateTime nextSunrise) {
        if (now == null || sunrise == null || sunset == null || nextSunrise == null) {
            return null;
        }

        if (!now.isBefore(sunrise) && now.isBefore(sunset)) {
            double progressDay = progress(now, sunrise, sunset);
            return 6 + progressDay * 12;
        }

        double progressNight = progress(now, sunset, nextSunrise);
        double geometricHour = 18 + progressNight * 12;

        return geometricHour >= 24 ? geometricHour - 24 : geometricHour;
    }

    private static double progress(ZonedDateTime now, ZonedDateTime start, ZonedDateTime end) {
        long elapsedMillis = Duration.between(start, now).toMillis();
        long totalMillis = Duration.between(start, end).toMillis();

        if (totalMillis <= 0) {
            return 0;
        }

        double progress = (double) elapsedMillis / (double) totalMillis;
        if (progress < 0) {
            return 0;
        }
        if (progress > 1) {
            return 1;
        }
        return progress;
    }

    /** Formato de widget de datos: horas y minutos (sin segundos). */
    private static String formatGeometricTimeHm(Double geometricHour) {
        if (geometricHour == null || !Double.isFinite(geometricHour)) {
            return "--:--";
        }

        int totalSeconds = (int) Math.floor(geometricHour * 3600);
        int hours = totalSeconds / 3600;
        int minutes = (totalSeconds % 3600) / 60;

        return String.format("%02d:%02d", hours, minutes);
    }

    public static final class WidgetState {
        private final String titleText;
        private final String geometricTimeText;
        private final String civilTimeText;
        private final String locationText;
        private final String stateText;
        private final boolean day;
        private final Double geometricHour;
        private final ZonedDateTime sunrise;
        private final ZonedDateTime sunset;
        private final ZonedDateTime nextSunrise;
        /** Atardecer activo de la ventana nocturna (hoy o ayer). */
        private final ZonedDateTime previousSunset;

        private WidgetState(
                String titleText,
                String geometricTimeText,
                String civilTimeText,
                String locationText,
                String stateText,
                boolean day,
                Double geometricHour,
                ZonedDateTime sunrise,
                ZonedDateTime sunset,
                ZonedDateTime nextSunrise,
                ZonedDateTime previousSunset
        ) {
            this.titleText = titleText;
            this.geometricTimeText = geometricTimeText;
            this.civilTimeText = civilTimeText;
            this.locationText = locationText;
            this.stateText = stateText;
            this.day = day;
            this.geometricHour = geometricHour;
            this.sunrise = sunrise;
            this.sunset = sunset;
            this.nextSunrise = nextSunrise;
            this.previousSunset = previousSunset;
        }

        private static WidgetState unavailable() {
            return new WidgetState(
                    "6D-Watch",
                    "--:--",
                    "--:--",
                    "Ubicación: Santiago",
                    "Estado: --",
                    false,
                    null,
                    null,
                    null,
                    null,
                    null
            );
        }

        public String getTitleText() {
            return titleText;
        }

        public String getGeometricTimeText() {
            return "Hora geométrica " + geometricTimeText;
        }

        public String getCivilTimeText() {
            return "Hora civil " + civilTimeText;
        }

        public String getLocationText() {
            return locationText;
        }

        public String getStateText() {
            return stateText;
        }

        public boolean isDay() {
            return day;
        }

        public Double getGeometricHour() {
            return geometricHour;
        }

        public ZonedDateTime getSunrise() {
            return sunrise;
        }

        public ZonedDateTime getSunset() {
            return sunset;
        }

        public ZonedDateTime getNextSunrise() {
            return nextSunrise;
        }

        public ZonedDateTime getPreviousSunset() {
            return previousSunset;
        }
    }
}