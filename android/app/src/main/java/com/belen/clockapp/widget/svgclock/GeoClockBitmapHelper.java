package com.belen.clockapp.widget.svgclock;

import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.graphics.Paint;
import android.graphics.Rect;
import android.os.Build;
import android.util.Log;

import java.util.Locale;
import java.util.concurrent.atomic.AtomicLong;

/**
 * Utilidades de bitmap y generación para el widget visual.
 */
public final class GeoClockBitmapHelper {

    public static final String TAG = "GeoClockWidget";
    public static final String VISUAL_TAG = "GeoClockVisual";
    private static final int BG_COLOR = 0xFF030713;
    private static final AtomicLong GENERATION = new AtomicLong(0);

    private GeoClockBitmapHelper() {
    }

    public static void logVisual(String event, String details) {
        Log.i(VISUAL_TAG, event + " ts=" + System.currentTimeMillis() + " " + details);
    }

    /** Fingerprint estable para comparar bitmaps entre renders (CRC32 de píxeles). */
    public static String bitmapFingerprint(Bitmap bitmap) {
        if (bitmap == null || bitmap.isRecycled()) {
            return "null";
        }
        int width = bitmap.getWidth();
        int height = bitmap.getHeight();
        int sample = Math.min(width * height, 65536);
        int step = Math.max(1, (width * height) / sample);
        java.util.zip.CRC32 crc = new java.util.zip.CRC32();
        int[] row = new int[width];
        long sum = 0L;
        int counted = 0;
        for (int y = 0; y < height; y++) {
            bitmap.getPixels(row, 0, width, 0, y, width, 1);
            for (int x = 0; x < width; x += step) {
                int p = row[x];
                crc.update(p);
                crc.update(p >>> 8);
                crc.update(p >>> 16);
                crc.update(p >>> 24);
                sum += (p & 0xffffffffL);
                counted++;
            }
        }
        return "crc=" + Long.toHexString(crc.getValue())
                + ",sum=" + Long.toHexString(sum)
                + ",n=" + counted
                + ",w=" + width
                + ",h=" + height;
    }

    public static long nextGeneration() {
        return GENERATION.incrementAndGet();
    }

    public static long currentGeneration() {
        return GENERATION.get();
    }

    public static boolean isCurrentGeneration(long generation) {
        return generation == GENERATION.get();
    }

    /**
     * Reduce (o amplía con cuidado) un bitmap con filtro bilineal + antialias.
     * Preferible a {@link Bitmap#createScaledBitmap} a secas cuando se baja desde
     * un render supermuestreado hacia el tamaño de entrega del widget.
     */
    public static Bitmap scaleHighQuality(Bitmap source, int targetWidth, int targetHeight) {
        if (source == null || source.isRecycled()) {
            return null;
        }
        if (targetWidth <= 0 || targetHeight <= 0) {
            return null;
        }
        if (source.getWidth() == targetWidth && source.getHeight() == targetHeight) {
            return source;
        }

        Bitmap working = source;
        boolean createdWorking = false;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O
                && source.getConfig() == Bitmap.Config.HARDWARE) {
            working = source.copy(Bitmap.Config.ARGB_8888, false);
            createdWorking = true;
            if (working == null) {
                return null;
            }
        }

        // Reducciones >2×: pasos intermedios a ~½ para conservar detalle fino.
        Bitmap current = working;
        boolean recycleCurrent = createdWorking;
        while (current.getWidth() > targetWidth * 2 || current.getHeight() > targetHeight * 2) {
            int midW = Math.max(targetWidth, (current.getWidth() + 1) / 2);
            int midH = Math.max(targetHeight, (current.getHeight() + 1) / 2);
            Bitmap mid = drawScaled(current, midW, midH);
            if (mid == null) {
                break;
            }
            if (recycleCurrent && current != source && !current.isRecycled()) {
                current.recycle();
            }
            current = mid;
            recycleCurrent = true;
        }

        Bitmap scaled = drawScaled(current, targetWidth, targetHeight);
        if (recycleCurrent && current != source && current != scaled && !current.isRecycled()) {
            current.recycle();
        }
        return scaled;
    }

    private static Bitmap drawScaled(Bitmap source, int width, int height) {
        Bitmap out = Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888);
        Canvas canvas = new Canvas(out);
        Paint paint = new Paint(Paint.ANTI_ALIAS_FLAG | Paint.FILTER_BITMAP_FLAG);
        paint.setDither(true);
        canvas.drawBitmap(source, null, new Rect(0, 0, width, height), paint);
        if (source.getDensity() > 0) {
            out.setDensity(source.getDensity());
        }
        return out;
    }

    /** Copia ARGB_8888 software, preferiblemente inmutable, independiente del WebView/caché. */
    public static Bitmap createIsolatedDeliveryCopy(Bitmap source) {
        if (source == null || source.isRecycled()) {
            return null;
        }
        Bitmap working = source;
        boolean createdWorking = false;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O
                && source.getConfig() == Bitmap.Config.HARDWARE) {
            working = source.copy(Bitmap.Config.ARGB_8888, true);
            createdWorking = true;
        }
        if (working == null) {
            return null;
        }
        Bitmap isolated = working.copy(Bitmap.Config.ARGB_8888, false);
        if (isolated == null) {
            isolated = working.copy(Bitmap.Config.ARGB_8888, true);
        }
        if (createdWorking && working != source && working != isolated && !working.isRecycled()) {
            working.recycle();
        }
        return isolated;
    }

    public static boolean hasClockLikeContent(Bitmap bitmap) {
        ContentStats stats = analyzeContent(bitmap);
        return stats != null
                && stats.nonBg >= 200
                && stats.pct >= 2.0d
                && stats.areaPct >= 10.0d;
    }

    public static String describeContent(Bitmap bitmap) {
        ContentStats stats = analyzeContent(bitmap);
        if (stats == null) {
            return "null";
        }
        return "nonBg=" + stats.nonBg
                + " pct=" + String.format(Locale.US, "%.2f", stats.pct)
                + " areaPct=" + String.format(Locale.US, "%.2f", stats.areaPct)
                + " box=" + stats.boxW + "x" + stats.boxH
                + " size=" + stats.width + "x" + stats.height;
    }

    private static ContentStats analyzeContent(Bitmap bitmap) {
        if (bitmap == null || bitmap.isRecycled()) {
            return null;
        }
        int width = bitmap.getWidth();
        int height = bitmap.getHeight();
        if (width <= 0 || height <= 0) {
            return null;
        }
        int[] pixels = new int[width * height];
        bitmap.getPixels(pixels, 0, width, 0, 0, width, height);
        int nonBg = 0;
        int minX = width;
        int minY = height;
        int maxX = -1;
        int maxY = -1;
        for (int y = 0; y < height; y++) {
            int row = y * width;
            for (int x = 0; x < width; x++) {
                int pixel = pixels[row + x];
                if ((pixel | 0xFF000000) != BG_COLOR) {
                    nonBg++;
                    if (x < minX) minX = x;
                    if (y < minY) minY = y;
                    if (x > maxX) maxX = x;
                    if (y > maxY) maxY = y;
                }
            }
        }
        int total = width * height;
        double pct = total == 0 ? 0d : (100d * nonBg / total);
        int boxW = maxX >= minX ? (maxX - minX + 1) : 0;
        int boxH = maxY >= minY ? (maxY - minY + 1) : 0;
        double areaPct = total == 0 ? 0d : (100d * boxW * boxH / total);
        ContentStats stats = new ContentStats();
        stats.width = width;
        stats.height = height;
        stats.nonBg = nonBg;
        stats.pct = pct;
        stats.areaPct = areaPct;
        stats.boxW = boxW;
        stats.boxH = boxH;
        return stats;
    }

    private static final class ContentStats {
        private int width;
        private int height;
        private int nonBg;
        private double pct;
        private double areaPct;
        private int boxW;
        private int boxH;
    }

    public static void logImportant(String message) {
        Log.i(TAG, message);
    }

    public static void logError(String message, Throwable error) {
        if (error == null) {
            Log.e(TAG, message);
        } else {
            Log.e(TAG, message, error);
        }
    }
}
