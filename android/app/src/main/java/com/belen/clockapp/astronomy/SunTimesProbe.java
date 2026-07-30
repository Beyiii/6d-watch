package com.belen.clockapp.astronomy;

import org.shredzone.commons.suncalc.SunTimes;

import java.time.ZoneId;
import java.time.ZonedDateTime;

public final class SunTimesProbe {

    private static final ZoneId SANTIAGO_ZONE = ZoneId.of("America/Santiago");
    private static final double SANTIAGO_LATITUDE = -33.4489;
    private static final double SANTIAGO_LONGITUDE = -70.6693;

    private SunTimesProbe() {
    }

    public static Result calculateToday() {
        ZonedDateTime dateTime = ZonedDateTime.now(SANTIAGO_ZONE);
        SunTimes sunTimes = SunTimes.compute()
                .on(dateTime)
                .at(SANTIAGO_LATITUDE, SANTIAGO_LONGITUDE)
                .execute();

        return new Result(sunTimes.getRise(), sunTimes.getSet());
    }

    public static String describeToday() {
        Result result = calculateToday();
        return "sunrise=" + formatDateTime(result.sunrise)
                + ", sunset=" + formatDateTime(result.sunset);
    }

    private static String formatDateTime(ZonedDateTime dateTime) {
        return dateTime != null ? dateTime.toString() : "n/a";
    }

    public static final class Result {
        public final ZonedDateTime sunrise;
        public final ZonedDateTime sunset;

        public Result(ZonedDateTime sunrise, ZonedDateTime sunset) {
            this.sunrise = sunrise;
            this.sunset = sunset;
        }
    }
}