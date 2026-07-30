package com.belen.clockapp.astronomy;

public final class WidgetLocation {

    private final double latitude;
    private final double longitude;
    private final String timezone;
    private final String name;

    public WidgetLocation(double latitude, double longitude, String timezone, String name) {
        this.latitude = latitude;
        this.longitude = longitude;
        this.timezone = timezone;
        this.name = name;
    }

    public double getLatitude() {
        return latitude;
    }

    public double getLongitude() {
        return longitude;
    }

    public String getTimezone() {
        return timezone;
    }

    public String getName() {
        return name;
    }

    public static WidgetLocation santiago() {
        return new WidgetLocation(-33.4489, -70.6693, "America/Santiago", "Santiago");
    }
}