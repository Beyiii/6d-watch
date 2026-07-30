package com.belen.clockapp.astronomy;

import org.junit.Test;

import java.time.ZoneId;
import java.time.ZonedDateTime;

import static org.junit.Assert.assertNotNull;

public class GeometricTimeCalculatorTest {

    @Test
    public void calculateAt_returnsDaySnapshotForNoonInSantiago() {
        ZonedDateTime fixedNoon = ZonedDateTime.of(2026, 7, 9, 12, 0, 0, 0, ZoneId.of("America/Santiago"));

        GeometricTimeCalculator.WidgetState widgetState = GeometricTimeCalculator.calculateAt(
            fixedNoon,
            WidgetLocation.santiago()
        );

        assertNotNull(widgetState.getSunrise());
        assertNotNull(widgetState.getSunset());
        assertNotNull(widgetState.getNextSunrise());
        assertNotNull(widgetState.getGeometricHour());
    }
}