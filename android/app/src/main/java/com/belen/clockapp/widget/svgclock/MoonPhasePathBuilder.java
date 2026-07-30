package com.belen.clockapp.widget.svgclock;

import java.util.Locale;

/** Equivalente Java de {@code src/core/moonPhasePath.js#buildMoonPhasePath}. */
public final class MoonPhasePathBuilder {

    private MoonPhasePathBuilder() {
    }

    public static String build(
            double phase01,
            double cx,
            double cy,
            double r,
            String hemisphere
    ) {
        double p = ((phase01 % 1d) + 1d) % 1d;
        if (p < 0.005 || p > 0.995) {
            return "";
        }
        if (Math.abs(p - 0.5) < 0.005) {
            return circle(cx, cy, r);
        }

        double rx = Math.max(0.01, Math.abs(Math.cos(p * Math.PI * 2d)) * r);
        boolean waxing = p < 0.5;
        boolean isSouth = "south".equals(hemisphere);
        boolean lightOnRight = isSouth ? !waxing : waxing;
        boolean crescent = p < 0.25 || p > 0.75;
        int outerSweep = lightOnRight ? 1 : 0;
        int terminatorSweep = crescent ? (1 - outerSweep) : outerSweep;

        String x = fmt(cx);
        String topY = fmt(cy - r);
        String bottomY = fmt(cy + r);
        String radius = fmt(r);
        String terminatorRx = fmt(rx);

        return "M " + x + " " + topY
                + " A " + radius + " " + radius + " 0 0 " + outerSweep + " " + x + " " + bottomY
                + " A " + terminatorRx + " " + radius + " 0 0 " + terminatorSweep + " " + x + " " + topY
                + " Z";
    }

    private static String circle(double cx, double cy, double r) {
        String x = fmt(cx);
        String topY = fmt(cy - r);
        String bottomY = fmt(cy + r);
        String radius = fmt(r);
        return "M " + x + " " + topY
                + " A " + radius + " " + radius + " 0 1 1 " + x + " " + bottomY
                + " A " + radius + " " + radius + " 0 1 1 " + x + " " + topY
                + " Z";
    }

    private static String fmt(double v) {
        double rounded = Math.round(v * 1000d) / 1000d;
        if (rounded == 0d) {
            return "0";
        }
        return String.format(Locale.US, "%s", rounded);
    }
}
