package com.belen.clockapp.widget.svgclock;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.os.Bundle;
import android.util.Log;
import android.widget.RemoteViews;

import androidx.annotation.NonNull;
import androidx.work.Data;
import androidx.work.ExistingWorkPolicy;
import androidx.work.OneTimeWorkRequest;
import androidx.work.WorkInfo;
import androidx.work.WorkManager;
import androidx.work.Worker;
import androidx.work.WorkerParameters;

import com.belen.clockapp.R;
import com.belen.clockapp.astronomy.GeometricTimeCalculator;
import com.belen.clockapp.astronomy.WidgetLocation;
import com.belen.clockapp.astronomy.WidgetLocationResolver;
import com.belen.clockapp.widget.GeometricClockWidgetProvider;

import org.shredzone.commons.suncalc.MoonIllumination;

import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.time.DateTimeException;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Comparator;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.concurrent.TimeUnit;

/**
 * Renderiza y actualiza el widget visual. Serializa trabajos, entrega bitmaps aislados
 * ARGB_8888 y mantiene una última imagen válida por {@code appWidgetId} para reentrega
 * inmediata en {@code onUpdate} (p. ej. tras PACKAGE_CHANGED de WorkManager).
 */
public final class GeometricClockWidgetUpdateWorker extends Worker {

    private static final String TAG = GeoClockBitmapHelper.TAG;
    private static final String UNIQUE_WORK_NAME = "geometric-clock-widget-render";
    private static final String INPUT_SOURCE = "source";
    private static final String INPUT_GENERATION = "generation";
    private static final String INPUT_APP_WIDGET_ID = "appWidgetId";
    private static final String INPUT_FORCE_REFRESH = "forceRefresh";
    private static final int INVALID_WIDGET_ID = AppWidgetManager.INVALID_APPWIDGET_ID;
    /** Namespace de requestCode para el botón de recarga (evita choque con widget de datos). */
    private static final int REFRESH_REQUEST_CODE_BASE = 0x6C010000;
    private static final int LAUNCH_REQUEST_CODE_BASE = 0x6C020000;
    private static final long UPDATE_BUCKET_MS = 5L * 60L * 1000L;
    private static final int DEFAULT_SIZE_DP = 220;
    private static final int MIN_SIZE_DP = 110;
    /**
     * Tope de entrega a RemoteViews. Canvas nativo no necesita supermuestreo WebView;
     * 640² es nítido en xxhdpi Samsung y estable en Binder.
     */
    private static final int MAX_DELIVERY_PX = 640;
    /** Mismo tamaño de raster (sin WebView). */
    private static final int MAX_RENDER_PX = 640;
    /** Sin supermuestreo: el Canvas ya dibuja a resolución de entrega. */
    private static final float SUPER_SAMPLE = 1.0f;
    private static final int MAX_CACHE_FILES = 24;
    private static final Object UPDATE_LOCK = new Object();
    private static final String LAST_DELIVERY_PREFIX = "last-delivery-";
    private static final String SHARED_PREFIX = "shared-";

    public GeometricClockWidgetUpdateWorker(
            @NonNull Context context,
            @NonNull WorkerParameters workerParams
    ) {
        super(context, workerParams);
    }

    public static void enqueue(Context context) {
        enqueue(context, "unknown");
    }

    public static void enqueue(Context context, String source) {
        enqueueInternal(context, source, INVALID_WIDGET_ID, false);
    }

    /** Encola con prioridad (p. ej. primer pintado sin caché o resize). */
    public static void enqueueUrgent(Context context, String source) {
        enqueueInternal(context, source, INVALID_WIDGET_ID, true);
    }

    /**
     * Encola un render. Si {@code forceRefresh} es true, no reutiliza la caché del
     * bloque de 5 minutos. {@code ExistingWorkPolicy.REPLACE} evita WebViews paralelos
     * cuando el usuario pulsa varias veces.
     */
    public static void enqueueForWidget(
            Context context,
            int appWidgetId,
            String source,
            boolean forceRefresh
    ) {
        enqueueInternal(context, source, appWidgetId, forceRefresh);
    }

    private static void enqueueInternal(
            Context context,
            String source,
            int appWidgetId,
            boolean forceRefresh
    ) {
        // Soft update no debe incrementar generation ni REPLACE: abortaría un forceRefresh
        // o el primer render en curso y el minutero quedaría con la imagen antigua.
        if (!forceRefresh && hasActiveWork(context)) {
            GeoClockBitmapHelper.logVisual(
                    "VISUAL_WORK_KEEP",
                    "source=" + source
                            + " appWidgetId=" + appWidgetId
                            + " reason=active-work-skip-soft-without-generation-bump"
            );
            return;
        }

        long generation = GeoClockBitmapHelper.nextGeneration();
        Data.Builder data = new Data.Builder()
                .putString(INPUT_SOURCE, source == null ? "unknown" : source)
                .putLong(INPUT_GENERATION, generation)
                .putBoolean(INPUT_FORCE_REFRESH, forceRefresh);
        if (appWidgetId != INVALID_WIDGET_ID) {
            data.putInt(INPUT_APP_WIDGET_ID, appWidgetId);
        }
        OneTimeWorkRequest request = new OneTimeWorkRequest.Builder(GeometricClockWidgetUpdateWorker.class)
                .setInputData(data.build())
                .build();
        // forceRefresh: REPLACE. soft (sin trabajo activo): REPLACE equivale a encolar nuevo.
        ExistingWorkPolicy policy = ExistingWorkPolicy.REPLACE;
        WorkManager.getInstance(context.getApplicationContext()).enqueueUniqueWork(
                UNIQUE_WORK_NAME,
                policy,
                request
        );
        GeoClockBitmapHelper.logVisual(
                "VISUAL_WORK_ENQUEUED",
                "source=" + source
                        + " forceRefresh=" + forceRefresh
                        + " policy=" + policy
                        + " generation=" + generation
                        + " appWidgetId=" + appWidgetId
        );
    }

    public static void cancel(Context context) {
        WorkManager.getInstance(context.getApplicationContext()).cancelUniqueWork(UNIQUE_WORK_NAME);
    }

    public static boolean hasActiveWork(Context context) {
        try {
            List<WorkInfo> infos = WorkManager.getInstance(context.getApplicationContext())
                    .getWorkInfosForUniqueWork(UNIQUE_WORK_NAME)
                    .get(2, TimeUnit.SECONDS);
            if (infos == null) {
                return false;
            }
            for (WorkInfo info : infos) {
                WorkInfo.State state = info.getState();
                if (state == WorkInfo.State.ENQUEUED
                        || state == WorkInfo.State.RUNNING
                        || state == WorkInfo.State.BLOCKED) {
                    return true;
                }
            }
        } catch (Exception error) {
            Log.w(TAG, "hasActiveWork check failed", error);
            return true;
        }
        return false;
    }

    /**
     * Reentrega inmediata del último reloj válido por widget (sin WebView).
     *
     * @return true si al menos un widget recibió RemoteViews desde caché
     */
    public static boolean redeliverLastCached(
            Context context,
            AppWidgetManager manager,
            int[] appWidgetIds
    ) {
        if (appWidgetIds == null || appWidgetIds.length == 0) {
            return false;
        }
        boolean any = false;
        for (int widgetId : appWidgetIds) {
            Bitmap cached = loadLastDelivery(context, widgetId);
            if (cached == null) {
                continue;
            }
            try {
                Bitmap delivery = GeoClockBitmapHelper.createIsolatedDeliveryCopy(cached);
                if (cached != delivery && !cached.isRecycled()) {
                    cached.recycle();
                }
                if (delivery == null || !GeoClockBitmapHelper.hasClockLikeContent(delivery)) {
                    if (delivery != null && !delivery.isRecycled()) {
                        delivery.recycle();
                    }
                    GeoClockBitmapHelper.logImportant(
                            "ON_UPDATE_REDELIVER skipped invalid cache id=" + widgetId
                    );
                    continue;
                }
                manager.updateAppWidget(
                        widgetId,
                        createRemoteViews(context, widgetId, delivery, resolveLocationLabel(context))
                );
                GeoClockBitmapHelper.logVisual(
                        "VISUAL_REDELIVER_CACHED",
                        "appWidgetId=" + widgetId
                                + " fingerprint=" + GeoClockBitmapHelper.bitmapFingerprint(delivery)
                );
                any = true;
            } catch (Throwable error) {
                GeoClockBitmapHelper.logError(
                        "ON_UPDATE_REDELIVER_CACHED failed id=" + widgetId,
                        error
                );
            }
        }
        return any;
    }

    public static void deleteWidgetCache(Context context, int[] appWidgetIds) {
        if (appWidgetIds == null) {
            return;
        }
        for (int widgetId : appWidgetIds) {
            File file = lastDeliveryFile(context, widgetId);
            if (file.isFile() && !file.delete()) {
                Log.w(TAG, "No se pudo borrar caché del widget " + widgetId);
            }
        }
    }

    public static boolean hasLastDelivery(Context context, int appWidgetId) {
        File file = lastDeliveryFile(context, appWidgetId);
        return file.isFile() && file.length() > 0L;
    }

    private static final String PAINT_STATE_PREFS = "geometric-clock-widget-paint";
    private static final String PAINT_STATE_PREFIX = "paint-";
    public static final String PAINT_NONE = "none";
    public static final String PAINT_LOADING = "loading";
    public static final String PAINT_READY = "ready";
    public static final String PAINT_FAILED = "failed";

    public static String getPaintState(Context context, int appWidgetId) {
        return context.getSharedPreferences(PAINT_STATE_PREFS, Context.MODE_PRIVATE)
                .getString(PAINT_STATE_PREFIX + appWidgetId, PAINT_NONE);
    }

    public static void setPaintState(Context context, int appWidgetId, String state) {
        context.getSharedPreferences(PAINT_STATE_PREFS, Context.MODE_PRIVATE)
                .edit()
                .putString(PAINT_STATE_PREFIX + appWidgetId, state)
                .apply();
    }

    public static void clearPaintState(Context context, int[] appWidgetIds) {
        if (appWidgetIds == null) {
            return;
        }
        SharedPreferences.Editor editor =
                context.getSharedPreferences(PAINT_STATE_PREFS, Context.MODE_PRIVATE).edit();
        for (int id : appWidgetIds) {
            editor.remove(PAINT_STATE_PREFIX + id);
        }
        editor.apply();
    }

    /** Estado de carga: solo debe aplicarse una vez por primer render. */
    public static void showLoadingState(
            Context context,
            AppWidgetManager manager,
            int appWidgetId
    ) {
        try {
            RemoteViews views = new RemoteViews(
                    context.getPackageName(),
                    R.layout.d6_watch_geo_clock_widget
            );
            views.setViewVisibility(R.id.widget_geo_clock_image, android.view.View.INVISIBLE);
            views.setTextViewText(
                    R.id.widget_geo_clock_loading,
                    context.getString(R.string.widget_geo_clock_loading)
            );
            views.setViewVisibility(R.id.widget_geo_clock_loading, android.view.View.VISIBLE);
            views.setViewVisibility(R.id.widget_geo_clock_refresh, android.view.View.VISIBLE);
            applyLocationLabel(views, resolveLocationLabel(context));
            views.setOnClickPendingIntent(
                    R.id.widget_geo_clock_refresh,
                    buildManualRefreshPendingIntent(context, appWidgetId)
            );
            manager.updateAppWidget(appWidgetId, views);
            setPaintState(context, appWidgetId, PAINT_LOADING);
        } catch (Throwable error) {
            GeoClockBitmapHelper.logError("showLoadingState failed id=" + appWidgetId, error);
        }
    }

    /** Estado estable tras fallo sin last-delivery. No reaplicar en bucle. */
    public static void showErrorState(
            Context context,
            AppWidgetManager manager,
            int appWidgetId
    ) {
        showErrorState(
                context,
                manager,
                appWidgetId,
                context.getString(R.string.widget_geo_clock_error)
        );
    }

    public static void showErrorState(
            Context context,
            AppWidgetManager manager,
            int appWidgetId,
            String message
    ) {
        try {
            RemoteViews views = new RemoteViews(
                    context.getPackageName(),
                    R.layout.d6_watch_geo_clock_widget
            );
            views.setViewVisibility(R.id.widget_geo_clock_image, android.view.View.INVISIBLE);
            views.setTextViewText(
                    R.id.widget_geo_clock_loading,
                    message == null || message.isEmpty()
                            ? context.getString(R.string.widget_geo_clock_error)
                            : message
            );
            views.setViewVisibility(R.id.widget_geo_clock_loading, android.view.View.VISIBLE);
            views.setViewVisibility(R.id.widget_geo_clock_refresh, android.view.View.VISIBLE);
            applyLocationLabel(views, resolveLocationLabel(context));
            views.setOnClickPendingIntent(
                    R.id.widget_geo_clock_refresh,
                    buildManualRefreshPendingIntent(context, appWidgetId)
            );
            manager.updateAppWidget(appWidgetId, views);
            setPaintState(context, appWidgetId, PAINT_FAILED);
            GeoClockBitmapHelper.logVisual(
                    "VISUAL_ERROR_SHOWN",
                    "appWidgetId=" + appWidgetId + " message=" + message
            );
        } catch (Throwable error) {
            GeoClockBitmapHelper.logError("showErrorState failed id=" + appWidgetId, error);
        }
    }

    /**
     * Enlaza el PendingIntent del botón de recarga y refresca el nombre de ubicación
     * sin reemplazar el bitmap ({@link AppWidgetManager#partiallyUpdateAppWidget}).
     */
    public static void bindRefreshActions(
            Context context,
            AppWidgetManager manager,
            int[] appWidgetIds
    ) {
        if (appWidgetIds == null) {
            return;
        }
        String locationLabel = resolveLocationLabel(context);
        for (int widgetId : appWidgetIds) {
            try {
                RemoteViews views = new RemoteViews(
                        context.getPackageName(),
                        R.layout.d6_watch_geo_clock_widget
                );
                views.setViewVisibility(R.id.widget_geo_clock_refresh, android.view.View.VISIBLE);
                views.setOnClickPendingIntent(
                        R.id.widget_geo_clock_refresh,
                        buildManualRefreshPendingIntent(context, widgetId)
                );
                applyLocationLabel(views, locationLabel);
                manager.partiallyUpdateAppWidget(widgetId, views);
            } catch (Throwable error) {
                GeoClockBitmapHelper.logError(
                        "bindRefreshActions failed id=" + widgetId,
                        error
                );
            }
        }
    }

    @NonNull
    @Override
    public Result doWork() {
        Context context = getApplicationContext();
        String source = getInputData().getString(INPUT_SOURCE);
        if (source == null) {
            source = "unknown";
        }
        long generation = getInputData().getLong(INPUT_GENERATION, -1L);
        boolean forceRefresh = getInputData().getBoolean(INPUT_FORCE_REFRESH, false);
        int targetWidgetId = getInputData().getInt(INPUT_APP_WIDGET_ID, INVALID_WIDGET_ID);

        AppWidgetManager manager = AppWidgetManager.getInstance(context);
        ComponentName provider = new ComponentName(context, GeometricClockWidgetProvider.class);
        int[] allWidgetIds = manager.getAppWidgetIds(provider);
        int[] widgetIds = filterWidgetIds(allWidgetIds, targetWidgetId);

        if (widgetIds == null || widgetIds.length == 0) {
            GeoClockBitmapHelper.logVisual(
                    "VISUAL_WORK_END",
                    "result=success reason=no-widgets generation=" + generation
            );
            return Result.success();
        }
        if (!GeoClockBitmapHelper.isCurrentGeneration(generation)) {
            GeoClockBitmapHelper.logVisual(
                    "VISUAL_WORK_END",
                    "result=success reason=obsolete-generation generation=" + generation
                            + " current=" + GeoClockBitmapHelper.currentGeneration()
            );
            return Result.success();
        }

        GeoClockBitmapHelper.logVisual(
                "VISUAL_DO_WORK_BEGIN",
                "source=" + source
                        + " forceRefresh=" + forceRefresh
                        + " generation=" + generation
                        + " targetId=" + targetWidgetId
                        + " thread=" + Thread.currentThread().getName()
        );

        try {
            synchronized (UPDATE_LOCK) {
                if (isStopped() || !GeoClockBitmapHelper.isCurrentGeneration(generation)) {
                    return Result.success();
                }

                pruneCache(context, allWidgetIds == null ? widgetIds : allWidgetIds);
                WidgetLocation location = WidgetLocationResolver.resolve(context);
                String locationLabel = formatLocationLabel(location);
                VisualClockState clockState = VisualClockState.fromCalculator(location);

                // forceRefresh: bucket único para no reutilizar shared cache del bloque 5 min.
                long bucket = forceRefresh
                        ? -System.currentTimeMillis()
                        : Math.floorDiv(System.currentTimeMillis(), UPDATE_BUCKET_MS);
                Log.i(
                        TAG,
                        "doWork source=" + source
                                + " forceRefresh=" + forceRefresh
                                + " targetId=" + targetWidgetId
                                + " ids=" + widgetIds.length
                                + " bucket=" + bucket
                );
                Map<RenderKey, List<Integer>> groups = groupWidgets(
                        context, manager, widgetIds, location, bucket
                );

                boolean anyDelivered = false;
                boolean anyFailure = false;
                Double geometricHour = clockState.geometricHour;
                GeoClockBitmapHelper.logVisual(
                        "VISUAL_RENDER_START",
                        "source=" + source
                                + " forceRefresh=" + forceRefresh
                                + " generation=" + generation
                                + " targetId=" + targetWidgetId
                                + " ids=" + widgetIds.length
                                + " location=" + locationLabel
                                + " " + clockState.describe()
                                + " bucket=" + bucket
                                + " groups=" + groups.size()
                );
                GeoClockBitmapHelper.logVisual(
                        "VISUAL_HOUR_DIAG",
                        "engine=worker-pre-render source=GeometricTimeCalculator.calculateNow "
                                + clockState.describe()
                );

                for (Map.Entry<RenderKey, List<Integer>> entry : groups.entrySet()) {
                    if (isStopped() || !GeoClockBitmapHelper.isCurrentGeneration(generation)) {
                        GeoClockBitmapHelper.logVisual(
                                "VISUAL_RENDER_ABORT",
                                "reason=generation-or-stopped generation=" + generation
                                        + " current=" + GeoClockBitmapHelper.currentGeneration()
                                        + " stopped=" + isStopped()
                        );
                        // Generación nueva es dueña del render; no reintentar esta.
                        return anyDelivered ? Result.success() : Result.success();
                    }

                    RenderKey key = entry.getKey();
                    // forceRefresh nunca reutiliza PNG compartido del bloque de 5 min.
                    Bitmap sharedCached = forceRefresh
                            ? null
                            : loadSharedCachedBitmap(context, key);
                    GeoClockBitmapHelper.logVisual(
                            "VISUAL_CACHE_LOOKUP",
                            "key=" + key
                                    + " forceRefresh=" + forceRefresh
                                    + " hit=" + (sharedCached != null)
                                    + " geoHour=" + geometricHour
                    );
                    RenderResult render;
                    if (sharedCached != null) {
                        render = new RenderResult();
                        render.bitmap = sharedCached;
                    } else {
                        render = renderOnce(context, clockState, key.renderPx);
                        GeoClockBitmapHelper.logVisual(
                                "VISUAL_SVG_READY",
                                "renderPx=" + key.renderPx
                                        + " ok=" + (render.bitmap != null)
                                        + " error="
                                        + (render.error == null ? "null" : render.error.getMessage())
                                        + " geoHour=" + geometricHour
                        );
                        if (render.bitmap != null
                                && GeoClockBitmapHelper.hasClockLikeContent(render.bitmap)) {
                            Bitmap forCache = downsampleToDelivery(context, render.bitmap, key);
                            if (forCache != null
                                    && GeoClockBitmapHelper.hasClockLikeContent(forCache)) {
                                if (forCache != render.bitmap
                                        && render.bitmap != null
                                        && !render.bitmap.isRecycled()) {
                                    render.bitmap.recycle();
                                }
                                render.bitmap = forCache;
                                if (!forceRefresh) {
                                    saveSharedCachedBitmap(context, key, forCache);
                                }
                                GeoClockBitmapHelper.logVisual(
                                        "VISUAL_BITMAP_HASH",
                                        "stage=post-downsample key=" + key
                                                + " fingerprint="
                                                + GeoClockBitmapHelper.bitmapFingerprint(forCache)
                                                + " geoHour=" + geometricHour
                                );
                            } else {
                                GeoClockBitmapHelper.logImportant(
                                        "downsample rejected; sizePx=" + key.deliveryPx
                                );
                                if (render.bitmap != null && !render.bitmap.isRecycled()) {
                                    render.bitmap.recycle();
                                }
                                render.bitmap = null;
                            }
                        } else if (render.bitmap != null) {
                            GeoClockBitmapHelper.logVisual(
                                    "VISUAL_BITMAP_REJECTED",
                                    "renderPx=" + key.renderPx
                                            + " " + GeoClockBitmapHelper.describeContent(render.bitmap)
                                            + " fingerprint="
                                            + GeoClockBitmapHelper.bitmapFingerprint(render.bitmap)
                            );
                            GeoClockBitmapHelper.logImportant(
                                    "render rejected empty/not clock-like renderPx=" + key.renderPx
                            );
                            if (!render.bitmap.isRecycled()) {
                                render.bitmap.recycle();
                            }
                            render.bitmap = null;
                        }
                    }

                    if (render.bitmap == null) {
                        anyFailure = true;
                        GeoClockBitmapHelper.logError(
                                "render failed/timeout; keeping last valid images"
                                        + " deliveryPx=" + key.deliveryPx
                                        + " renderPx=" + key.renderPx
                                        + " error="
                                        + (render.error == null ? "null" : render.error.getMessage()),
                                render.error
                        );
                        for (int widgetId : entry.getValue()) {
                            if (hasLastDelivery(context, widgetId)) {
                                Bitmap last = loadLastDelivery(context, widgetId);
                                if (last != null) {
                                    if (deliverUpdate(
                                            context,
                                            manager,
                                            widgetId,
                                            last,
                                            source + "+last-delivery",
                                            locationLabel
                                    )) {
                                        anyDelivered = true;
                                    }
                                }
                            } else {
                                showErrorState(
                                        context,
                                        manager,
                                        widgetId,
                                        context.getString(R.string.widget_geo_clock_native_svg_error)
                                );
                            }
                        }
                        continue;
                    }

                    if (isStopped() || !GeoClockBitmapHelper.isCurrentGeneration(generation)) {
                        if (render.bitmap != null
                                && sharedCached == null
                                && !render.bitmap.isRecycled()) {
                            // El render nuevo no se entregó; no borrar last-delivery.
                        }
                        GeoClockBitmapHelper.logVisual(
                                "VISUAL_RENDER_ABORT",
                                "reason=after-render-before-deliver generation=" + generation
                                        + " current=" + GeoClockBitmapHelper.currentGeneration()
                        );
                        return Result.success();
                    }

                    Bitmap prepared = prepareBitmapForRemoteViews(context, render.bitmap, key);
                    Bitmap deliveryBitmap = GeoClockBitmapHelper.createIsolatedDeliveryCopy(prepared);
                    if (deliveryBitmap == null
                            || !GeoClockBitmapHelper.hasClockLikeContent(deliveryBitmap)) {
                        anyFailure = true;
                        GeoClockBitmapHelper.logImportant(
                                "delivery rejected; keeping last valid images deliveryPx="
                                        + key.deliveryPx
                        );
                        continue;
                    }

                    for (int widgetId : entry.getValue()) {
                        if (isStopped() || !GeoClockBitmapHelper.isCurrentGeneration(generation)) {
                            break;
                        }
                        if (deliverUpdate(
                                context,
                                manager,
                                widgetId,
                                deliveryBitmap,
                                source,
                                locationLabel
                        )) {
                            anyDelivered = true;
                        }
                    }
                }

                if (anyFailure && !anyDelivered) {
                    // Bitmap en blanco / fallo de captura: no reintentar en bucle cada 30s
                    // (dejaba “Cargando…” minutos). El usuario puede pulsar reload.
                    GeoClockBitmapHelper.logVisual(
                            "VISUAL_WORK_END",
                            "result=failure reason=no-delivery source=" + source
                                    + " generation=" + generation
                    );
                    return Result.failure();
                }
                GeoClockBitmapHelper.logVisual(
                        "VISUAL_WORK_END",
                        "result=success delivered=" + anyDelivered
                                + " source=" + source
                                + " generation=" + generation
                );
                return Result.success();
            }
        } catch (Throwable error) {
            GeoClockBitmapHelper.logError("worker FAILURE source=" + source, error);
            GeoClockBitmapHelper.logVisual(
                    "VISUAL_WORK_END",
                    "result=failure exception=" + error.getClass().getSimpleName()
                            + " msg=" + error.getMessage()
            );
            // Fallo determinista (p. ej. OOM): no Result.retry() — evita bucles.
            return Result.failure();
        }
    }

    private boolean deliverUpdate(
            Context context,
            AppWidgetManager manager,
            int widgetId,
            Bitmap deliveryBitmap,
            String source,
            String locationLabel
    ) {
        try {
            String fingerprint = GeoClockBitmapHelper.bitmapFingerprint(deliveryBitmap);
            manager.updateAppWidget(
                    widgetId,
                    createRemoteViews(context, widgetId, deliveryBitmap, locationLabel)
            );
            saveLastDelivery(context, widgetId, deliveryBitmap);
            setPaintState(context, widgetId, PAINT_READY);
            GeoClockBitmapHelper.logVisual(
                    "VISUAL_UPDATE_APPLIED",
                    "appWidgetId=" + widgetId
                            + " source=" + source
                            + " location=" + locationLabel
                            + " fingerprint=" + fingerprint
                            + " lastDelivery=" + lastDeliveryFile(context, widgetId).getName()
            );
            GeoClockBitmapHelper.logVisual(
                    "VISUAL_CACHE_SAVED",
                    "appWidgetId=" + widgetId
                            + " file=" + lastDeliveryFile(context, widgetId).getAbsolutePath()
                            + " bytes=" + lastDeliveryFile(context, widgetId).length()
                            + " fingerprint=" + fingerprint
            );
            return true;
        } catch (Throwable error) {
            GeoClockBitmapHelper.logError(
                    "UPDATE_FAILED id=" + widgetId + " source=" + source,
                    error
            );
            return false;
        }
    }

    private static int[] filterWidgetIds(int[] allWidgetIds, int targetWidgetId) {
        if (allWidgetIds == null || allWidgetIds.length == 0) {
            return allWidgetIds;
        }
        if (targetWidgetId == INVALID_WIDGET_ID) {
            return allWidgetIds;
        }
        for (int id : allWidgetIds) {
            if (id == targetWidgetId) {
                return new int[] { targetWidgetId };
            }
        }
        return new int[0];
    }

    private static Map<RenderKey, List<Integer>> groupWidgets(
            Context context,
            AppWidgetManager manager,
            int[] widgetIds,
            WidgetLocation location,
            long bucket
    ) {
        Map<RenderKey, List<Integer>> groups = new LinkedHashMap<>();
        for (int widgetId : widgetIds) {
            RenderKey key = resolveRenderKey(context, manager, widgetId, location, bucket);
            groups.computeIfAbsent(key, ignored -> new ArrayList<>()).add(widgetId);
        }
        return groups;
    }

    /**
     * Calcula tamaño físico del widget (dp × density), tope de entrega Binder-seguro
     * y tamaño de render con supermuestreo. No toca lógica horaria.
     */
    private static RenderKey resolveRenderKey(
            Context context,
            AppWidgetManager manager,
            int widgetId,
            WidgetLocation location,
            long bucket
    ) {
        int sizeDp = DEFAULT_SIZE_DP;
        Bundle options = manager.getAppWidgetOptions(widgetId);
        int minWidthDp = 0;
        int minHeightDp = 0;
        int maxWidthDp = 0;
        int maxHeightDp = 0;
        if (options != null) {
            minWidthDp = options.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_WIDTH, 0);
            minHeightDp = options.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_HEIGHT, 0);
            maxWidthDp = options.getInt(AppWidgetManager.OPTION_APPWIDGET_MAX_WIDTH, 0);
            maxHeightDp = options.getInt(AppWidgetManager.OPTION_APPWIDGET_MAX_HEIGHT, 0);
            // Preferir el lado mayor reportado (suele reflejar la celda actual al redimensionar).
            int widthDp = Math.max(minWidthDp, maxWidthDp);
            int heightDp = Math.max(minHeightDp, maxHeightDp);
            if (widthDp > 0 && heightDp > 0) {
                sizeDp = Math.min(widthDp, heightDp);
            }
        }

        sizeDp = Math.max(MIN_SIZE_DP, sizeDp);
        float density = context.getResources().getDisplayMetrics().density;
        int densityDpi = context.getResources().getDisplayMetrics().densityDpi;
        int physicalPx = Math.max(1, Math.round(sizeDp * density));
        int deliveryPx = Math.min(MAX_DELIVERY_PX, physicalPx);
        int renderPx = Math.min(
                MAX_RENDER_PX,
                Math.max(deliveryPx, Math.round(deliveryPx * SUPER_SAMPLE))
        );

        // Comparativa de opciones (sin renderizar las 4): ayuda a validar en Logcat.
        int opt320 = 320;
        int opt480 = 480;
        long bytesDelivery = (long) deliveryPx * deliveryPx * 4L;
        long bytesRender = (long) renderPx * renderPx * 4L;
        Log.i(
                "GeoClockQuality",
                "sizeResolve"
                        + " widgetId=" + widgetId
                        + " sizeDp=" + sizeDp
                        + " density=" + density
                        + " densityDpi=" + densityDpi
                        + " optionsMin=" + minWidthDp + "x" + minHeightDp
                        + " optionsMax=" + maxWidthDp + "x" + maxHeightDp
                        + " physicalPx=" + physicalPx
                        + " cmp320=" + opt320
                        + " cmp480=" + opt480
                        + " deliveryPx=" + deliveryPx
                        + " renderPx=" + renderPx
                        + " super=" + SUPER_SAMPLE
                        + " approxDeliveryBytes=" + bytesDelivery
                        + " approxRenderBytes=" + bytesRender
                        + " upscaleAvoided=" + (physicalPx <= MAX_DELIVERY_PX
                        ? "physical<=cap"
                        : "capped_from_" + physicalPx)
        );

        return new RenderKey(location, deliveryPx, renderPx, densityDpi, bucket);
    }

    private static HeadlessGeoClockWebViewRenderer.RenderParams buildRenderParams(
            WidgetLocation location,
            GeometricTimeCalculator.WidgetState state,
            ZonedDateTime now
    ) {
        Double calculatedHour = state.getGeometricHour();
        double geometricHour = calculatedHour != null ? calculatedHour : 0d;
        int minutes = (int) Math.floor(
                (geometricHour - Math.floor(geometricHour)) * 60d
        );
        boolean isNorth = location.getLatitude() >= 0d;
        // Misma fórmula que figmaClockEngine.computeAngleDeg (sur: -15*(h-6), norte: -15*(18-h)).
        double pointerAngleDeg = isNorth
                ? -15d * (18d - geometricHour)
                : -15d * (geometricHour - 6d);
        double yinYangRotationDeg = pointerAngleDeg + 90d;

        MoonIllumination illumination = MoonIllumination.compute()
                .on(now)
                .at(location.getLatitude(), location.getLongitude())
                .execute();

        // TEMP: logs de paridad app ↔ widget (filtrar Logcat por GeoClockParity).
        Log.i(
                "GeoClockParity",
                "widgetInputs"
                        + " timestamp=" + now
                        + " location=" + location.getName()
                        + " lat=" + location.getLatitude()
                        + " lon=" + location.getLongitude()
                        + " timezone=" + location.getTimezone()
                        + " sunrise=" + state.getSunrise()
                        + " sunset=" + state.getSunset()
                        + " nextSunrise=" + state.getNextSunrise()
                        + " previousSunset=" + state.getPreviousSunset()
                        + " dayNight=" + (state.isDay() ? "day" : "night")
                        + " geometricHour=" + geometricHour
                        + " minutesToSvg=" + minutes
                        + " civilHour=" + now.getHour()
                        + " hemisphere=" + (isNorth ? "north" : "south")
                        + " moonPhase=" + illumination.getPhase()
                        + " pointerAngleDeg=" + pointerAngleDeg
                        + " yinYangRotationDeg=" + yinYangRotationDeg
        );
        GeoClockBitmapHelper.logVisual(
                "VISUAL_GEO_TIME",
                "location=" + location.getName()
                        + " geoHour=" + geometricHour
                        + " minutes=" + minutes
                        + " civilHour=" + now.getHour()
                        + " pointerAngleDeg=" + pointerAngleDeg
                        + " hemisphere=" + (isNorth ? "north" : "south")
        );

        return new HeadlessGeoClockWebViewRenderer.RenderParams(
                geometricHour,
                minutes,
                (double) now.getHour(),
                illumination.getPhase(),
                isNorth
        );
    }

    private static ZoneId resolveZoneId(String timezone) {
        try {
            return timezone == null || timezone.isEmpty()
                    ? ZoneId.systemDefault()
                    : ZoneId.of(timezone);
        } catch (DateTimeException ignored) {
            return ZoneId.systemDefault();
        }
    }

    private static RemoteViews createRemoteViews(
            Context context,
            int appWidgetId,
            Bitmap bitmap,
            String locationLabel
    ) {
        // setDensity funciona también en bitmaps inmutables; evita que el launcher
        // trate píxeles físicos como mdpi y reescale (doble escalado / blur).
        bitmap.setDensity(context.getResources().getDisplayMetrics().densityDpi);
        RemoteViews views = new RemoteViews(
                context.getPackageName(),
                R.layout.d6_watch_geo_clock_widget
        );
        views.setImageViewBitmap(R.id.widget_geo_clock_image, bitmap);
        views.setViewVisibility(R.id.widget_geo_clock_image, android.view.View.VISIBLE);
        views.setViewVisibility(R.id.widget_geo_clock_loading, android.view.View.GONE);
        views.setViewVisibility(R.id.widget_geo_clock_refresh, android.view.View.VISIBLE);
        applyLocationLabel(views, locationLabel);
        views.setOnClickPendingIntent(
                R.id.widget_geo_clock_refresh,
                buildManualRefreshPendingIntent(context, appWidgetId)
        );

        Intent launchIntent =
                context.getPackageManager().getLaunchIntentForPackage(context.getPackageName());
        if (launchIntent != null) {
            launchIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
            PendingIntent pendingIntent = PendingIntent.getActivity(
                    context,
                    LAUNCH_REQUEST_CODE_BASE | (appWidgetId & 0xFFFF),
                    launchIntent,
                    PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
            );
            // Solo el área del reloj abre la app; el botón de recarga tiene su propio intent.
            views.setOnClickPendingIntent(R.id.widget_geo_clock_image, pendingIntent);
        }
        return views;
    }

    private static void applyLocationLabel(RemoteViews views, String locationLabel) {
        String label = locationLabel == null || locationLabel.isEmpty()
                ? "Ubicación seleccionada"
                : locationLabel;
        views.setTextViewText(R.id.widget_geo_clock_location, label);
        views.setViewVisibility(R.id.widget_geo_clock_location, android.view.View.VISIBLE);
    }

    /** Nombre guardado; si falta, coordenadas redondeadas o fallback. */
    static String formatLocationLabel(WidgetLocation location) {
        if (location == null) {
            return "Ubicación seleccionada";
        }
        String name = location.getName();
        if (name != null) {
            String trimmed = name.trim();
            if (!trimmed.isEmpty()
                    && !"Ubicación guardada".equals(trimmed)
                    && !"Ubicación del dispositivo".equals(trimmed)) {
                return trimmed;
            }
            // Nombres genéricos del resolver: preferir coordenadas legibles.
            if ("Ubicación guardada".equals(trimmed)
                    || "Ubicación del dispositivo".equals(trimmed)) {
                return String.format(
                        Locale.US,
                        "%.2f°, %.2f°",
                        location.getLatitude(),
                        location.getLongitude()
                );
            }
        }
        return String.format(
                Locale.US,
                "%.2f°, %.2f°",
                location.getLatitude(),
                location.getLongitude()
        );
    }

    private static String resolveLocationLabel(Context context) {
        return formatLocationLabel(WidgetLocationResolver.resolve(context));
    }

    private static PendingIntent buildManualRefreshPendingIntent(Context context, int appWidgetId) {
        Intent refreshIntent = new Intent(context, GeometricClockWidgetProvider.class);
        refreshIntent.setAction(GeometricClockWidgetProvider.ACTION_MANUAL_REFRESH);
        refreshIntent.putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, appWidgetId);
        // Distingue PendingIntents entre instancias (y del widget de datos).
        refreshIntent.setData(
                android.net.Uri.parse("geoclock-refresh://" + context.getPackageName() + "/" + appWidgetId)
        );
        return PendingIntent.getBroadcast(
                context,
                REFRESH_REQUEST_CODE_BASE | (appWidgetId & 0xFFFF),
                refreshIntent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );
    }

    private RenderResult renderOnce(
            Context context,
            VisualClockState state,
            int sizePx
    ) {
        RenderResult result = new RenderResult();
        try {
            Bitmap bitmap = NativeSvgGeoClockRenderer.render(
                    context,
                    state,
                    sizePx,
                    targetWidgetIdForLogs()
            );
            if (bitmap != null && GeoClockBitmapHelper.hasClockLikeContent(bitmap)) {
                result.bitmap = bitmap;
                GeoClockBitmapHelper.logVisual(
                        "VISUAL_SVG_READY",
                        "engine=native-svg renderPx=" + sizePx
                                + " ok=true error=null"
                                + " " + GeoClockBitmapHelper.describeContent(bitmap)
                );
                return result;
            }
            if (bitmap != null && !bitmap.isRecycled()) {
                bitmap.recycle();
            }
            result.error = new IllegalStateException("native SVG bitmap not clock-like");
            GeoClockBitmapHelper.logVisual(
                    "VISUAL_NATIVE_SVG_RENDER_FAILED",
                    "reason=not-clock-like renderPx=" + sizePx
                            + " canvasFallbackEnabled="
                            + NativeSvgGeoClockRenderer.CANVAS_FALLBACK_ENABLED
            );
        } catch (Throwable nativeError) {
            result.error = nativeError;
            GeoClockBitmapHelper.logVisual(
                    "VISUAL_NATIVE_SVG_RENDER_FAILED",
                    "reason=exception msg=" + nativeError.getMessage()
                            + " canvasFallbackEnabled="
                            + NativeSvgGeoClockRenderer.CANVAS_FALLBACK_ENABLED
            );
            Log.e(TAG, "native SVG render failed (canvas fallback disabled)", nativeError);
        }

        // Diagnóstico: no ocultar el fallo con Canvas.
        if (!NativeSvgGeoClockRenderer.CANVAS_FALLBACK_ENABLED) {
            return result;
        }

        try {
            Bitmap fallback = CanvasGeoClockRenderer.render(state, sizePx);
            if (fallback != null && GeoClockBitmapHelper.hasClockLikeContent(fallback)) {
                result.bitmap = fallback;
                result.error = null;
                GeoClockBitmapHelper.logVisual(
                        "VISUAL_SVG_READY",
                        "engine=canvas-fallback renderPx=" + sizePx
                                + " ok=true error=null"
                                + " " + GeoClockBitmapHelper.describeContent(fallback)
                );
            } else {
                if (fallback != null && !fallback.isRecycled()) {
                    fallback.recycle();
                }
                if (result.error == null) {
                    result.error = new IllegalStateException("canvas fallback not clock-like");
                }
            }
        } catch (Throwable error) {
            if (result.error == null) {
                result.error = error;
            }
            Log.e(TAG, "canvas fallback failed", error);
        }
        return result;
    }

    private int targetWidgetIdForLogs() {
        return getInputData().getInt(INPUT_APP_WIDGET_ID, INVALID_WIDGET_ID);
    }

    private static File cacheDirectory(Context context) {
        File directory = new File(context.getCacheDir(), "geometric-clock-widget");
        if (!directory.exists() && !directory.mkdirs()) {
            Log.w(TAG, "No se pudo crear el directorio de caché " + directory);
        }
        return directory;
    }

    private static File lastDeliveryFile(Context context, int widgetId) {
        return new File(cacheDirectory(context), LAST_DELIVERY_PREFIX + widgetId + ".png");
    }

    private static void saveLastDelivery(Context context, int widgetId, Bitmap bitmap) {
        File file = lastDeliveryFile(context, widgetId);
        try (FileOutputStream output = new FileOutputStream(file)) {
            if (!bitmap.compress(Bitmap.CompressFormat.PNG, 100, output)) {
                Log.w(TAG, "saveLastDelivery compress failed id=" + widgetId);
            }
        } catch (IOException error) {
            Log.w(TAG, "saveLastDelivery failed id=" + widgetId, error);
        }
    }

    private static Bitmap loadLastDelivery(Context context, int widgetId) {
        File file = lastDeliveryFile(context, widgetId);
        if (!file.isFile()) {
            return null;
        }
        Bitmap bitmap = BitmapFactory.decodeFile(file.getAbsolutePath());
        if (bitmap == null) {
            return null;
        }
        if (!GeoClockBitmapHelper.hasClockLikeContent(bitmap)) {
            bitmap.recycle();
            if (!file.delete()) {
                Log.w(TAG, "No se pudo eliminar last-delivery inválida " + file);
            }
            GeoClockBitmapHelper.logImportant("invalid last-delivery removed id=" + widgetId);
            return null;
        }
        return bitmap;
    }

    private static Bitmap loadSharedCachedBitmap(Context context, RenderKey key) {
        File file = new File(cacheDirectory(context), key.fileName());
        if (!file.isFile()) {
            return null;
        }
        Bitmap bitmap = BitmapFactory.decodeFile(file.getAbsolutePath());
        if (bitmap == null
                || bitmap.getWidth() != key.deliveryPx
                || bitmap.getHeight() != key.deliveryPx) {
            if (bitmap != null) {
                bitmap.recycle();
            }
            if (!file.delete()) {
                Log.w(TAG, "No se pudo eliminar caché compartida inválida " + file);
            }
            return null;
        }
        if (!GeoClockBitmapHelper.hasClockLikeContent(bitmap)) {
            bitmap.recycle();
            if (!file.delete()) {
                Log.w(TAG, "No se pudo eliminar caché compartida vacía " + file);
            }
            GeoClockBitmapHelper.logImportant("invalid shared cache removed key=" + key);
            return null;
        }
        return bitmap;
    }

    private static void saveSharedCachedBitmap(Context context, RenderKey key, Bitmap bitmap) {
        File file = new File(cacheDirectory(context), key.fileName());
        try (FileOutputStream output = new FileOutputStream(file)) {
            if (!bitmap.compress(Bitmap.CompressFormat.PNG, 100, output)) {
                Log.w(TAG, "No se pudo comprimir el Bitmap de " + key);
            }
        } catch (IOException error) {
            Log.w(TAG, "No se pudo guardar el Bitmap compartido", error);
        }
    }

    /** Baja el capture supermuestreado al tamaño de entrega (o lo deja si ya coincide). */
    private static Bitmap downsampleToDelivery(Context context, Bitmap rendered, RenderKey key) {
        if (rendered == null || rendered.isRecycled()) {
            return null;
        }
        int densityDpi = context.getResources().getDisplayMetrics().densityDpi;
        if (rendered.isMutable()) {
            rendered.setDensity(densityDpi);
        }
        if (rendered.getWidth() == key.deliveryPx && rendered.getHeight() == key.deliveryPx) {
            return rendered;
        }
        Bitmap scaled = GeoClockBitmapHelper.scaleHighQuality(
                rendered,
                key.deliveryPx,
                key.deliveryPx
        );
        if (scaled != null && scaled.isMutable()) {
            scaled.setDensity(densityDpi);
        }
        Log.i(
                "GeoClockQuality",
                "downsample"
                        + " from=" + rendered.getWidth() + "x" + rendered.getHeight()
                        + " to=" + key.deliveryPx + "x" + key.deliveryPx
                        + " densityDpi=" + densityDpi
                        + " filter=hq"
        );
        return scaled;
    }

    private static Bitmap prepareBitmapForRemoteViews(
            Context context,
            Bitmap bitmap,
            RenderKey key
    ) {
        if (bitmap == null || bitmap.isRecycled()) {
            return bitmap;
        }

        int width = bitmap.getWidth();
        int height = bitmap.getHeight();
        if (width <= 0 || height <= 0) {
            return bitmap;
        }

        // La caché ya debería estar en deliveryPx; esto es red de seguridad Binder.
        int maxSide = Math.max(width, height);
        if (maxSide > MAX_DELIVERY_PX
                || width != key.deliveryPx
                || height != key.deliveryPx) {
            int target = Math.min(MAX_DELIVERY_PX, key.deliveryPx);
            bitmap = GeoClockBitmapHelper.scaleHighQuality(bitmap, target, target);
        }

        if (bitmap != null && bitmap.isMutable()) {
            bitmap.setDensity(context.getResources().getDisplayMetrics().densityDpi);
        }
        return bitmap;
    }

    private static void pruneCache(Context context, int[] activeWidgetIds) {
        File[] files = cacheDirectory(context).listFiles();
        if (files == null || files.length == 0) {
            return;
        }

        Set<String> protectedNames = new HashSet<>();
        if (activeWidgetIds != null) {
            for (int id : activeWidgetIds) {
                protectedNames.add(LAST_DELIVERY_PREFIX + id + ".png");
            }
        }

        long cutoff = System.currentTimeMillis() - (UPDATE_BUCKET_MS * 3L);
        List<File> shared = new ArrayList<>();
        for (File file : files) {
            String name = file.getName();
            if (name.startsWith(LAST_DELIVERY_PREFIX)) {
                // last-delivery de widgets ya borrados
                if (!protectedNames.contains(name) && !file.delete()) {
                    Log.w(TAG, "No se pudo eliminar last-delivery huérfana " + file);
                }
                continue;
            }
            if (name.startsWith(SHARED_PREFIX)) {
                if (file.lastModified() < cutoff) {
                    if (!file.delete()) {
                        Log.w(TAG, "No se pudo eliminar caché antigua " + file);
                    }
                } else {
                    shared.add(file);
                }
            } else if (file.lastModified() < cutoff) {
                // Limpia dumps/archivos antiguos de diagnósticos previos.
                if (!file.delete()) {
                    Log.w(TAG, "No se pudo eliminar archivo de caché antiguo " + file);
                }
            }
        }

        if (shared.size() > MAX_CACHE_FILES) {
            File[] sorted = shared.toArray(new File[0]);
            Arrays.sort(sorted, Comparator.comparingLong(File::lastModified));
            int toDelete = sorted.length - MAX_CACHE_FILES;
            for (int i = 0; i < toDelete; i++) {
                if (!sorted[i].delete()) {
                    Log.w(TAG, "No se pudo podar caché " + sorted[i]);
                }
            }
        }
    }

    private static final class RenderKey {
        private final long latitudeBits;
        private final long longitudeBits;
        private final String timezone;
        private final String locationName;
        /** Tamaño final enviado a RemoteViews / ImageView. */
        private final int deliveryPx;
        /** Tamaño de captura WebView (puede ser > deliveryPx por supermuestreo). */
        private final int renderPx;
        private final int densityDpi;
        private final long bucket;

        RenderKey(
                WidgetLocation location,
                int deliveryPx,
                int renderPx,
                int densityDpi,
                long bucket
        ) {
            latitudeBits = Double.doubleToLongBits(location.getLatitude());
            longitudeBits = Double.doubleToLongBits(location.getLongitude());
            timezone = location.getTimezone();
            locationName = location.getName() == null ? "" : location.getName();
            this.deliveryPx = deliveryPx;
            this.renderPx = renderPx;
            this.densityDpi = densityDpi;
            this.bucket = bucket;
        }

        @Override
        public boolean equals(Object other) {
            if (this == other) {
                return true;
            }
            if (!(other instanceof RenderKey)) {
                return false;
            }
            RenderKey key = (RenderKey) other;
            return latitudeBits == key.latitudeBits
                    && longitudeBits == key.longitudeBits
                    && deliveryPx == key.deliveryPx
                    && renderPx == key.renderPx
                    && densityDpi == key.densityDpi
                    && bucket == key.bucket
                    && Objects.equals(timezone, key.timezone)
                    && Objects.equals(locationName, key.locationName);
        }

        @Override
        public int hashCode() {
            return Objects.hash(
                    latitudeBits,
                    longitudeBits,
                    timezone,
                    locationName,
                    deliveryPx,
                    renderPx,
                    densityDpi,
                    bucket
            );
        }

        @Override
        public String toString() {
            return String.format(
                    Locale.US,
                    "RenderKey{deliveryPx=%d, renderPx=%d, densityDpi=%d, bucket=%d, loc=%s}",
                    deliveryPx,
                    renderPx,
                    densityDpi,
                    bucket,
                    locationName
            );
        }

        String fileName() {
            return SHARED_PREFIX + Integer.toHexString(hashCode())
                    + "-d" + deliveryPx
                    + "-r" + renderPx
                    + "-dpi" + densityDpi
                    + "-" + bucket + ".png";
        }
    }

    private static final class RenderResult {
        private Bitmap bitmap;
        private RenderTiming timing;
        private Throwable error;
    }
}
