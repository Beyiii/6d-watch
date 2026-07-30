package com.belen.clockapp.astronomy;

import org.junit.Test;

import java.time.Instant;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.time.format.DateTimeFormatter;

/**
 * Imprime filas PARITY para comparar con el script JS de la app (misma Instant UTC).
 */
public class MultiCityParityProbeTest {

    private static final DateTimeFormatter HM = DateTimeFormatter.ofPattern("HH:mm");
    private static final Instant FIXED = Instant.parse("2026-07-22T23:35:00Z");

    @Test
    public void printParityRowsForFixedInstant() {
        WidgetLocation[] cities = new WidgetLocation[] {
                new WidgetLocation(-33.4489, -70.6693, "America/Santiago", "Santiago"),
                new WidgetLocation(19.4326, -99.1332, "America/Mexico_City", "Ciudad de Mexico"),
                new WidgetLocation(40.7128, -74.0060, "America/New_York", "Nueva York"),
                new WidgetLocation(51.5074, -0.1278, "Europe/London", "Londres"),
                new WidgetLocation(35.6762, 139.6503, "Asia/Tokyo", "Tokio"),
                new WidgetLocation(-33.8688, 151.2093, "Australia/Sydney", "Sidney"),
                new WidgetLocation(1.3521, 103.8198, "Asia/Singapore", "Singapur")
        };

        for (WidgetLocation city : cities) {
            ZoneId zone = ZoneId.of(city.getTimezone());
            ZonedDateTime local = FIXED.atZone(zone);
            GeometricTimeCalculator.WidgetState state =
                    GeometricTimeCalculator.calculateAt(FIXED.atZone(ZoneId.of("UTC")), city);

            System.out.println("PARITY"
                    + "|city=" + city.getName()
                    + "|tz=" + city.getTimezone()
                    + "|localDate=" + local.toLocalDate()
                    + "|civil=" + local.format(HM)
                    + "|widgetCivil=" + state.getCivilTimeText().replace("Hora civil ", "")
                    + "|gh=" + state.getGeometricHour()
                    + "|geoHm=" + state.getGeometricTimeText().replace("Hora geométrica ", "")
                    + "|day=" + state.isDay()
                    + "|sunrise=" + state.getSunrise()
                    + "|sunset=" + state.getSunset()
                    + "|nextSunrise=" + state.getNextSunrise()
                    + "|prevSunset=" + state.getPreviousSunset());
        }
    }
}