package com.belen.clockapp.widget.svgclock;

import com.belen.clockapp.astronomy.GeometricTimeCalculator;
import com.belen.clockapp.astronomy.WidgetLocation;

import org.shredzone.commons.suncalc.MoonIllumination;

import java.time.ZonedDateTime;
import java.util.Locale;

/**
 * Estado visual ya calculado. El renderer NO recalcula hora geométrica:
 * solo aplica transformaciones al SVG / Canvas.
 */
public final class VisualClockState {

    public final double geometricHour;
    public final int geometricMinutes;
    public final double civilHour;
    public final double latitude;
    public final boolean northHemisphere;
    public final double moonPhase01;
    public final int activeGeoHourIndex;
    public final double pointerAngleDeg;
    public final double yinYangRotationDeg;
    public final String locationName;

    public VisualClockState(
            double geometricHour,
            int geometricMinutes,
            double civilHour,
            double latitude,
            boolean northHemisphere,
            double moonPhase01,
            int activeGeoHourIndex,
            double pointerAngleDeg,
            double yinYangRotationDeg,
            String locationName
    ) {
        this.geometricHour = geometricHour;
        this.geometricMinutes = geometricMinutes;
        this.civilHour = civilHour;
        this.latitude = latitude;
        this.northHemisphere = northHemisphere;
        this.moonPhase01 = moonPhase01;
        this.activeGeoHourIndex = activeGeoHourIndex;
        this.pointerAngleDeg = pointerAngleDeg;
        this.yinYangRotationDeg = yinYangRotationDeg;
        this.locationName = locationName;
    }

    /**
     * Fuente de verdad: {@link GeometricTimeCalculator#calculateNow(WidgetLocation)}.
     * Ángulos = mismas fórmulas que {@code figmaClockEngine.computeAngleDeg}.
     */
    public static VisualClockState fromCalculator(WidgetLocation location) {
        WidgetLocation loc = location != null ? location : WidgetLocation.santiago();
        GeometricTimeCalculator.WidgetState state =
                GeometricTimeCalculator.calculateNow(loc);
        ZonedDateTime now = ZonedDateTime.now(
                resolveZone(loc.getTimezone())
        );

        Double ghObj = state.getGeometricHour();
        double geometricHour = ghObj != null ? clamp24(ghObj) : 0d;
        int minutes = (int) Math.floor((geometricHour - Math.floor(geometricHour)) * 60d);
        boolean north = loc.getLatitude() >= 0d;
        double pointerAngleDeg = north
                ? -15d * (18d - geometricHour)
                : -15d * (geometricHour - 6d);
        double yinYangRotationDeg = pointerAngleDeg + 90d;
        int activeGeoHourIndex = (12 - (int) Math.floor(geometricHour) + 24) % 24;

        MoonIllumination illumination = MoonIllumination.compute()
                .on(now)
                .at(loc.getLatitude(), loc.getLongitude())
                .execute();
        // commons-suncalc getPhase() = grados (-180..180, 0=llena).
        // La app JS / figmaClockEngine esperan fase [0,1] estilo SunCalc.
        double moonPhase01 = moonPhaseDegreesTo01(illumination.getPhase());

        return new VisualClockState(
                geometricHour,
                minutes,
                now.getHour(),
                loc.getLatitude(),
                north,
                moonPhase01,
                activeGeoHourIndex,
                pointerAngleDeg,
                yinYangRotationDeg,
                loc.getName()
        );
    }

    public static double clamp24(double hour) {
        double h = hour % 24d;
        if (h < 0) {
            h += 24d;
        }
        return h;
    }

    /** -180 (nueva) → 0; 0 (llena) → 0.5; +180 (nueva) → 1. */
    public static double moonPhaseDegreesTo01(double phaseDeg) {
        if (!Double.isFinite(phaseDeg)) {
            return 0d;
        }
        double p = ((phaseDeg + 180d) / 360d) % 1d;
        if (p < 0) {
            p += 1d;
        }
        return p;
    }

    public String hemisphere() {
        return northHemisphere ? "north" : "south";
    }

    public String describe() {
        return String.format(
                Locale.US,
                "gh=%.6f minutes=%d civil=%.0f hemi=%s moon01=%.4f activeIdx=%d pointer=%.4f dial=%.4f",
                geometricHour,
                geometricMinutes,
                civilHour,
                hemisphere(),
                moonPhase01,
                activeGeoHourIndex,
                pointerAngleDeg,
                yinYangRotationDeg
        );
    }

    private static java.time.ZoneId resolveZone(String timezone) {
        try {
            return timezone == null || timezone.isEmpty()
                    ? java.time.ZoneId.systemDefault()
                    : java.time.ZoneId.of(timezone);
        } catch (Exception ignored) {
            return java.time.ZoneId.systemDefault();
        }
    }
}
