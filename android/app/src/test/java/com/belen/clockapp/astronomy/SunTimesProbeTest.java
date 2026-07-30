package com.belen.clockapp.astronomy;

import org.junit.Test;

import static org.junit.Assert.assertNotNull;

public class SunTimesProbeTest {

    @Test
    public void calculateToday_returnsSunriseAndSunset() {
        SunTimesProbe.Result result = SunTimesProbe.calculateToday();

        assertNotNull(result.sunrise);
        assertNotNull(result.sunset);
    }
}