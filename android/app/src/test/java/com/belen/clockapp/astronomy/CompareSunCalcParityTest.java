package com.belen.clockapp.astronomy;

import org.junit.Test;
import org.shredzone.commons.suncalc.SunTimes;

import java.time.LocalDate;
import java.time.ZoneId;
import java.time.ZonedDateTime;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;

public class CompareSunCalcParityTest {

    @Test
    public void calculateAt_matchesAppStyleWindowForSantiagoEvening() {
        ZoneId zone = ZoneId.of("America/Santiago");
        ZonedDateTime now = ZonedDateTime.of(2026, 7, 22, 20, 35, 0, 0, zone);

        GeometricTimeCalculator.WidgetState state =
                GeometricTimeCalculator.calculateAt(now, WidgetLocation.santiago());

        // App (SunCalc + same classic night formula) ~ 20.285 for this instant.
        assertFalse(state.isDay());
        assertTrue(state.getGeometricHour() > 19.5);
        assertTrue(state.getGeometricHour() < 21.0);
        assertEquals(2026, state.getSunrise().getYear());
        assertEquals(7, state.getSunrise().getMonthValue());
        assertEquals(22, state.getSunrise().getDayOfMonth());

        SunTimes today = SunTimes.compute()
                .on(LocalDate.of(2026, 7, 22))
                .timezone(zone)
                .at(-33.4489, -70.6693)
                .execute();
        assertEquals(today.getRise().toEpochSecond(), state.getSunrise().toEpochSecond());
        assertEquals(today.getSet().toEpochSecond(), state.getSunset().toEpochSecond());

        System.out.println("FIXED_GH=" + state.getGeometricHour());
        System.out.println("FIXED_SUNRISE=" + state.getSunrise());
        System.out.println("FIXED_SUNSET=" + state.getSunset());
        System.out.println("FIXED_NEXT_SUNRISE=" + state.getNextSunrise());
    }
}