package com.belen.clockapp.widget.svgclock;

import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.LinearGradient;
import android.graphics.Paint;
import android.graphics.Path;
import android.graphics.RadialGradient;
import android.graphics.RectF;
import android.graphics.Shader;
import android.graphics.Typeface;
import android.util.Log;

import java.util.Locale;

/**
 * Fallback de contingencia (NO es el renderer principal).
 * Solo se usa si {@link NativeSvgGeoClockRenderer} falla.
 */
public final class CanvasGeoClockRenderer {

    private static final String TAG = GeoClockBitmapHelper.VISUAL_TAG;
    private static final int BG = 0xFF030713;
    private static final int GOLD = 0xFFC9A227;
    private static final int GOLD_SOFT = 0xFF8B7355;
    private static final int DISK_DARK = 0xFF121A2A;
    private static final int DISK_LIGHT = 0xFFE8EEF7;
    private static final int TEXT = 0xFF363E46;
    private static final int TEXT_STROKE = 0xFFFFFFFF;
    private static final int MOON = 0xFFD7DEEA;
    private static final int MOON_SHADOW = 0xFF1A2233;

    private CanvasGeoClockRenderer() {
    }

    public static Bitmap render(VisualClockState state, int sizePx) {
        int size = Math.max(120, sizePx);
        Bitmap bitmap = Bitmap.createBitmap(size, size, Bitmap.Config.ARGB_8888);
        Canvas canvas = new Canvas(bitmap);
        canvas.drawColor(BG);

        float cx = size * 0.5f;
        float cy = size * 0.5f;
        float rOuter = size * 0.46f;
        float rRing = size * 0.42f;
        float rDisk = size * 0.32f;

        // Diagnóstico de hora: valores del calculator vs ángulos aplicados.
        Log.i(
                TAG,
                "VISUAL_HOUR_DIAG engine=canvas-fallback"
                        + " calculatorGh=" + state.geometricHour
                        + " calculatorMinutes=" + state.geometricMinutes
                        + " civilHour=" + state.civilHour
                        + " pointerAngleDeg=" + state.pointerAngleDeg
                        + " yinYangRotationDeg=" + state.yinYangRotationDeg
                        + " activeGeoHourIndex=" + state.activeGeoHourIndex
                        + " hemi=" + state.hemisphere()
                        + " moon01=" + state.moonPhase01
                        + " note=angles-from-VisualClockState-same-as-figmaClockEngine"
        );

        drawOuterGlow(canvas, cx, cy, rOuter);
        drawHourRing(canvas, cx, cy, rRing, rDisk * 1.08f, state);
        drawDial(canvas, cx, cy, rDisk, state);
        drawCivilHint(canvas, cx, cy, rRing, state);

        Log.i(
                TAG,
                "VISUAL_CANVAS_RENDER ts=" + System.currentTimeMillis()
                        + " size=" + size
                        + " " + state.describe()
                        + " " + GeoClockBitmapHelper.describeContent(bitmap)
                        + " thread=" + Thread.currentThread().getName()
        );
        return bitmap;
    }

    private static void drawOuterGlow(Canvas canvas, float cx, float cy, float r) {
        Paint glow = new Paint(Paint.ANTI_ALIAS_FLAG);
        glow.setShader(new RadialGradient(
                cx, cy, r * 1.08f,
                new int[] { 0x332B3A55, 0x00030713 },
                new float[] { 0.7f, 1f },
                Shader.TileMode.CLAMP
        ));
        canvas.drawCircle(cx, cy, r * 1.08f, glow);

        Paint ring = new Paint(Paint.ANTI_ALIAS_FLAG);
        ring.setStyle(Paint.Style.STROKE);
        ring.setStrokeWidth(Math.max(2f, r * 0.018f));
        ring.setColor(GOLD_SOFT);
        canvas.drawCircle(cx, cy, r, ring);
    }

    private static void drawHourRing(
            Canvas canvas,
            float cx,
            float cy,
            float rOuter,
            float rInner,
            VisualClockState state
    ) {
        int active = state.activeGeoHourIndex;
        Paint seg = new Paint(Paint.ANTI_ALIAS_FLAG);
        seg.setStyle(Paint.Style.STROKE);
        seg.setStrokeWidth(Math.max(3f, (rOuter - rInner) * 0.85f));
        seg.setStrokeCap(Paint.Cap.BUTT);

        float midR = (rOuter + rInner) * 0.5f;
        RectF oval = new RectF(cx - midR, cy - midR, cx + midR, cy + midR);
        boolean north = state.northHemisphere;

        for (int i = 0; i < 24; i++) {
            float start = north
                    ? -90f - (i + 1) * 15f
                    : -90f + i * 15f;
            int color = hourColor(i);
            seg.setColor(i == active ? lighten(color, 0.35f) : color);
            seg.setAlpha(i == active ? 255 : 170);
            canvas.drawArc(oval, start, 14f, false, seg);
        }
    }

    private static void drawDial(
            Canvas canvas,
            float cx,
            float cy,
            float r,
            VisualClockState state
    ) {
        double dialRotationDeg = state.yinYangRotationDeg;
        canvas.save();
        canvas.rotate((float) dialRotationDeg, cx, cy);

        Paint disk = new Paint(Paint.ANTI_ALIAS_FLAG);
        disk.setShader(new LinearGradient(
                cx - r, cy - r, cx + r, cy + r,
                new int[] { 0xFF1A2438, 0xFF0B1220, GOLD_SOFT },
                new float[] { 0f, 0.72f, 1f },
                Shader.TileMode.CLAMP
        ));
        canvas.drawCircle(cx, cy, r, disk);

        Paint rim = new Paint(Paint.ANTI_ALIAS_FLAG);
        rim.setStyle(Paint.Style.STROKE);
        rim.setStrokeWidth(Math.max(2f, r * 0.03f));
        rim.setColor(GOLD);
        canvas.drawCircle(cx, cy, r * 0.98f, rim);

        drawYinYang(canvas, cx, cy, r * 0.88f);

        canvas.save();
        canvas.rotate((float) -dialRotationDeg, cx, cy - r * 0.55f);
        drawMinutes(canvas, cx, cy - r * 0.55f, r, state.geometricMinutes);
        canvas.restore();

        float moonCy = cy + r * 0.42f;
        canvas.save();
        canvas.rotate((float) -dialRotationDeg, cx, moonCy);
        drawMoon(canvas, cx, moonCy, r * 0.16f, state.moonPhase01, state.northHemisphere);
        canvas.restore();

        canvas.restore();
    }

    private static void drawYinYang(Canvas canvas, float cx, float cy, float r) {
        Paint dark = new Paint(Paint.ANTI_ALIAS_FLAG);
        dark.setColor(DISK_DARK);
        Paint light = new Paint(Paint.ANTI_ALIAS_FLAG);
        light.setColor(DISK_LIGHT);

        Path left = new Path();
        left.addArc(new RectF(cx - r, cy - r, cx + r, cy + r), 90f, 180f);
        left.addArc(new RectF(cx - r * 0.5f, cy - r, cx + r * 0.5f, cy), 90f, -180f);
        left.addArc(new RectF(cx - r * 0.5f, cy, cx + r * 0.5f, cy + r), 90f, 180f);
        left.close();
        canvas.drawPath(left, dark);

        Path right = new Path();
        right.addArc(new RectF(cx - r, cy - r, cx + r, cy + r), -90f, 180f);
        right.addArc(new RectF(cx - r * 0.5f, cy, cx + r * 0.5f, cy + r), -90f, -180f);
        right.addArc(new RectF(cx - r * 0.5f, cy - r, cx + r * 0.5f, cy), -90f, 180f);
        right.close();
        canvas.drawPath(right, light);

        canvas.drawCircle(cx, cy - r * 0.5f, r * 0.14f, light);
        canvas.drawCircle(cx, cy + r * 0.5f, r * 0.14f, dark);
    }

    private static void drawMinutes(Canvas canvas, float cx, float cy, float r, int minutes) {
        String text = String.format(Locale.US, "%02d", Math.max(0, Math.min(59, minutes)));
        Paint stroke = new Paint(Paint.ANTI_ALIAS_FLAG);
        stroke.setColor(TEXT_STROKE);
        stroke.setTextAlign(Paint.Align.CENTER);
        stroke.setTextSize(r * 0.28f);
        stroke.setTypeface(Typeface.create(Typeface.SANS_SERIF, Typeface.BOLD));
        stroke.setStyle(Paint.Style.STROKE);
        stroke.setStrokeWidth(Math.max(2f, r * 0.035f));
        stroke.setStrokeJoin(Paint.Join.ROUND);

        Paint fill = new Paint(stroke);
        fill.setStyle(Paint.Style.FILL);
        fill.setColor(TEXT);
        fill.setStrokeWidth(0f);

        Paint.FontMetrics fm = fill.getFontMetrics();
        float baseline = cy - (fm.ascent + fm.descent) * 0.5f;
        canvas.drawText(text, cx, baseline, stroke);
        canvas.drawText(text, cx, baseline, fill);
    }

    private static void drawMoon(
            Canvas canvas,
            float cx,
            float cy,
            float r,
            double moonPhase01,
            boolean north
    ) {
        Paint border = new Paint(Paint.ANTI_ALIAS_FLAG);
        border.setStyle(Paint.Style.STROKE);
        border.setStrokeWidth(Math.max(1.5f, r * 0.08f));
        border.setColor(0xFF9AA6B8);
        canvas.drawCircle(cx, cy, r, border);

        Paint disk = new Paint(Paint.ANTI_ALIAS_FLAG);
        disk.setColor(MOON);
        canvas.drawCircle(cx, cy, r * 0.92f, disk);

        double phase01 = ((moonPhase01 % 1d) + 1d) % 1d;
        if (phase01 < 0.02 || phase01 > 0.98) {
            return;
        }
        if (Math.abs(phase01 - 0.5) < 0.02) {
            return;
        }

        Paint shadow = new Paint(Paint.ANTI_ALIAS_FLAG);
        shadow.setColor(MOON_SHADOW);
        boolean waxing = phase01 < 0.5;
        if (north) {
            waxing = !waxing;
        }
        float k = (float) Math.abs(Math.cos(phase01 * Math.PI * 2.0));
        canvas.save();
        Path clip = new Path();
        clip.addCircle(cx, cy, r * 0.92f, Path.Direction.CW);
        canvas.clipPath(clip);
        RectF shadowOval = new RectF(
                cx - r * 0.92f * k,
                cy - r * 0.92f,
                cx + r * 0.92f * k,
                cy + r * 0.92f
        );
        if (waxing) {
            canvas.drawRect(cx, cy - r, cx + r, cy + r, shadow);
            canvas.drawOval(shadowOval, disk);
        } else {
            canvas.drawRect(cx - r, cy - r, cx, cy + r, shadow);
            canvas.drawOval(shadowOval, disk);
        }
        canvas.restore();
    }

    private static void drawCivilHint(
            Canvas canvas,
            float cx,
            float cy,
            float r,
            VisualClockState state
    ) {
        double h = VisualClockState.clamp24(state.civilHour);
        float ang = state.northHemisphere
                ? (float) (-90.0 - h * 15.0)
                : (float) (-90.0 + h * 15.0);
        double rad = Math.toRadians(ang);
        float x = cx + (float) Math.cos(rad) * r;
        float y = cy + (float) Math.sin(rad) * r;
        Paint p = new Paint(Paint.ANTI_ALIAS_FLAG);
        p.setColor(0x88FFE08A);
        canvas.drawCircle(x, y, Math.max(4f, r * 0.035f), p);
    }

    private static int hourColor(int index) {
        float t = index / 24f;
        float hue = 30f + t * 260f;
        return Color.HSVToColor(new float[] { hue % 360f, 0.45f, 0.55f });
    }

    private static int lighten(int color, float amount) {
        int a = Color.alpha(color);
        int r = Color.red(color);
        int g = Color.green(color);
        int b = Color.blue(color);
        r = Math.min(255, (int) (r + (255 - r) * amount));
        g = Math.min(255, (int) (g + (255 - g) * amount));
        b = Math.min(255, (int) (b + (255 - b) * amount));
        return Color.argb(a, r, g, b);
    }
}
