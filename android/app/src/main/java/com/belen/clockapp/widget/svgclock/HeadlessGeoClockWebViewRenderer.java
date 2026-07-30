package com.belen.clockapp.widget.svgclock;

import android.annotation.SuppressLint;
import android.content.Context;
import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.Picture;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import android.util.Log;
import android.view.View;
import android.webkit.ConsoleMessage;
import android.webkit.JavascriptInterface;
import android.webkit.WebChromeClient;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import androidx.core.content.ContextCompat;

import com.belen.clockapp.R;

import org.json.JSONException;
import org.json.JSONObject;

import java.io.IOException;
import java.util.concurrent.atomic.AtomicBoolean;

/**
 * Renderiza el reloj geométrico real usando un WebView headless (nunca adjunto a una
 * ventana visible) que carga el SVG original de la app
 * ({@code public/reloj-v2.svg}) y aplica sobre él la misma lógica de
 * {@code src/core/figmaClockEngine.js} (rotación, flip por hemisferio, destaques, fase
 * lunar), y luego captura el resultado como {@link Bitmap} para poder usarlo en un widget.
 * <p>
 * Debe invocarse siempre desde el hilo principal (o llamará internamente vía {@link Handler}),
 * ya que {@link WebView} requiere un hilo con {@link Looper}.
 */
public final class HeadlessGeoClockWebViewRenderer {

    private static final String TAG = "GeoClockWidget";
    private static final String JS_BRIDGE_NAME = "AndroidClockBridge";
    // Margen tras la mutación del DOM para asegurar que Chromium compuso el frame antes de capturarlo.
    private static final long COMPOSE_SETTLE_DELAY_MS = 120L;
    private static final long COMPOSE_RETRY_DELAY_MS = 160L;
    private static final int MAX_CAPTURE_ATTEMPTS = 3;
    private static final AtomicBoolean SLOW_DRAW_ENABLED = new AtomicBoolean(false);

    private HeadlessGeoClockWebViewRenderer() {
    }

    /**
     * Obligatorio antes de crear el WebView: sin esto, {@code WebView.draw(Canvas)} en
     * Lollipop+ suele capturar un bitmap vacío aunque el DOM/JS estén listos.
     */
    private static void ensureSlowWholeDocumentDraw() {
        if (SLOW_DRAW_ENABLED.compareAndSet(false, true)) {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
                WebView.enableSlowWholeDocumentDraw();
                Log.i(GeoClockBitmapHelper.VISUAL_TAG, "VISUAL_SLOW_DRAW_ENABLED ok");
            }
        }
    }

    public static void render(Context context, RenderParams params, int widthPx, int heightPx, RenderCallback callback) {
        Handler main = new Handler(Looper.getMainLooper());
        Log.i(
                GeoClockBitmapHelper.VISUAL_TAG,
                "VISUAL_WEBVIEW_SCHEDULE ts=" + System.currentTimeMillis()
                        + " thread=" + Thread.currentThread().getName()
                        + " main=" + (Looper.myLooper() == Looper.getMainLooper())
                        + " size=" + widthPx + "x" + heightPx
        );
        if (Looper.myLooper() == Looper.getMainLooper()) {
            renderOnMainThread(context.getApplicationContext(), params, widthPx, heightPx, callback, main);
        } else {
            main.post(() -> renderOnMainThread(context.getApplicationContext(), params, widthPx, heightPx, callback, main));
        }
    }

    @SuppressLint("SetJavaScriptEnabled")
    private static void renderOnMainThread(
            Context appContext,
            RenderParams params,
            int widthPx,
            int heightPx,
            RenderCallback callback,
            Handler main
    ) {
        RenderTiming.Builder timing = new RenderTiming.Builder();
        timing.markStart();
        Log.i(
                GeoClockBitmapHelper.VISUAL_TAG,
                "VISUAL_WEBVIEW_START ts=" + System.currentTimeMillis()
                        + " thread=" + Thread.currentThread().getName()
                        + " size=" + widthPx + "x" + heightPx
        );

        if (widthPx <= 0 || heightPx <= 0) {
            callback.onError(new IllegalArgumentException(
                    "Invalid WebView size " + widthPx + "x" + heightPx
            ));
            return;
        }

        String html;
        try {
            float density = appContext.getResources().getDisplayMetrics().density;
            int cssWidth = Math.max(1, Math.round(widthPx / density));
            int cssHeight = Math.max(1, Math.round(heightPx / density));
            html = SvgClockHtmlBuilder.build(appContext, cssWidth, cssHeight);
            Log.i(
                    GeoClockBitmapHelper.VISUAL_TAG,
                    "VISUAL_HTML_BUILT ts=" + System.currentTimeMillis()
                            + " css=" + cssWidth + "x" + cssHeight
                            + " density=" + density
                            + " htmlBytes=" + html.length()
            );
        } catch (IOException e) {
            Log.e(TAG, "VISUAL_HTML_ERROR", e);
            callback.onError(e);
            return;
        }
        timing.markHtmlBuilt();

        ensureSlowWholeDocumentDraw();
        WebView webView = new WebView(appContext);
        // Software layer: webView.draw(canvas) en headless a menudo captura vacío en GPU.
        // Los filtros SVG pueden verse distintos; si el draw falla, hay reintento Picture.
        webView.setLayerType(View.LAYER_TYPE_SOFTWARE, null);
        webView.setBackgroundColor(Color.TRANSPARENT);
        webView.getSettings().setJavaScriptEnabled(true);
        webView.getSettings().setTextZoom(100);
        webView.getSettings().setOffscreenPreRaster(true);
        webView.getSettings().setLoadWithOverviewMode(false);
        webView.getSettings().setUseWideViewPort(false);
        String paramsJsonLiteral;
        try {
            paramsJsonLiteral = params.toJsonObject().toString();
        } catch (JSONException e) {
            webView.destroy();
            callback.onError(e);
            return;
        }

        final String[] stage = { "created" };
        final Runnable[] watchdogs = new Runnable[3];
        Runnable cancelWatchdogs = () -> {
            for (Runnable w : watchdogs) {
                if (w != null) {
                    main.removeCallbacks(w);
                }
            }
        };
        watchdogs[0] = () -> Log.w(
                GeoClockBitmapHelper.VISUAL_TAG,
                "VISUAL_WATCHDOG_5s stage=" + stage[0]
                        + " attached=" + webView.isAttachedToWindow()
                        + " size=" + webView.getWidth() + "x" + webView.getHeight()
        );
        watchdogs[1] = () -> Log.w(
                GeoClockBitmapHelper.VISUAL_TAG,
                "VISUAL_WATCHDOG_10s stage=" + stage[0]
                        + " attached=" + webView.isAttachedToWindow()
                        + " size=" + webView.getWidth() + "x" + webView.getHeight()
        );
        watchdogs[2] = () -> Log.w(
                GeoClockBitmapHelper.VISUAL_TAG,
                "VISUAL_WATCHDOG_20s stage=" + stage[0]
                        + " attached=" + webView.isAttachedToWindow()
                        + " size=" + webView.getWidth() + "x" + webView.getHeight()
        );
        main.postDelayed(watchdogs[0], 5_000L);
        main.postDelayed(watchdogs[1], 10_000L);
        main.postDelayed(watchdogs[2], 20_000L);

        webView.addJavascriptInterface(new JsBridge(main, () -> {
            timing.markJsApplied();
            stage[0] = "js-ready";
            Log.i(
                    GeoClockBitmapHelper.VISUAL_TAG,
                    "VISUAL_SVG_READY ts=" + System.currentTimeMillis()
                            + " geoHour=" + params.geometricHour
                            + " minutes=" + params.minutes
                            + " size=" + widthPx + "x" + heightPx
                            + " measured=" + webView.getWidth() + "x" + webView.getHeight()
                            + " attached=" + webView.isAttachedToWindow()
                            + " thread=" + Thread.currentThread().getName()
            );
            captureAndFinish(webView, widthPx, heightPx, timing, callback, main, stage, cancelWatchdogs, 0);
        }, (errorMessage) -> {
            stage[0] = "js-error";
            cancelWatchdogs.run();
            webView.destroy();
            callback.onError(new RuntimeException("El runtime JS reportó un error: " + errorMessage));
        }), JS_BRIDGE_NAME);

        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onConsoleMessage(ConsoleMessage consoleMessage) {
                if (consoleMessage == null) {
                    return true;
                }
                String msg = consoleMessage.message();
                if (msg != null && (msg.contains("GeoClockParity") || msg.contains("error") || msg.contains("Error"))) {
                    Log.i("GeoClockParity", "webview " + msg);
                } else if (consoleMessage.messageLevel() == ConsoleMessage.MessageLevel.ERROR) {
                    Log.e(TAG, "webview-js-error " + msg
                            + " @" + consoleMessage.sourceId() + ":" + consoleMessage.lineNumber());
                } else {
                    Log.d(TAG, "webview-console " + msg);
                }
                return true;
            }
        });

        webView.setWebViewClient(new WebViewClient() {
            @Override
            public void onPageFinished(WebView view, String url) {
                stage[0] = "page-finished";
                timing.markPageLoaded();
                Log.i(
                        GeoClockBitmapHelper.VISUAL_TAG,
                        "VISUAL_PAGE_FINISHED ts=" + System.currentTimeMillis()
                                + " url=" + url
                                + " measured=" + view.getWidth() + "x" + view.getHeight()
                                + " attached=" + view.isAttachedToWindow()
                );
                String call = "window.__renderWidgetClock(" + paramsJsonLiteral + ");";
                view.evaluateJavascript(call, null);
            }

            @Override
            public void onReceivedError(
                    WebView view,
                    int errorCode,
                    String description,
                    String failingUrl
            ) {
                stage[0] = "page-error";
                Log.e(
                        TAG,
                        "VISUAL_PAGE_ERROR code=" + errorCode
                                + " desc=" + description
                                + " url=" + failingUrl
                );
            }
        });

        int widthSpec = View.MeasureSpec.makeMeasureSpec(widthPx, View.MeasureSpec.EXACTLY);
        int heightSpec = View.MeasureSpec.makeMeasureSpec(heightPx, View.MeasureSpec.EXACTLY);
        webView.measure(widthSpec, heightSpec);
        webView.layout(0, 0, widthPx, heightPx);
        timing.markWebViewReady();
        stage[0] = "loading";
        Log.i(
                GeoClockBitmapHelper.VISUAL_TAG,
                "VISUAL_WEBVIEW_LAYOUT ts=" + System.currentTimeMillis()
                        + " measured=" + webView.getWidth() + "x" + webView.getHeight()
                        + " attached=" + webView.isAttachedToWindow()
        );

        webView.loadDataWithBaseURL(
                "file:///android_asset/widget_clock/",
                html,
                "text/html",
                "utf-8",
                null
        );
    }

    private static void captureAndFinish(
            WebView webView,
            int widthPx,
            int heightPx,
            RenderTiming.Builder timing,
            RenderCallback callback,
            Handler main,
            String[] stage,
            Runnable cancelWatchdogs,
            int attempt
    ) {
        long delay = attempt == 0 ? COMPOSE_SETTLE_DELAY_MS : COMPOSE_RETRY_DELAY_MS;
        main.postDelayed(() -> {
            try {
                stage[0] = "capture-attempt-" + attempt;
                webView.setLayerType(View.LAYER_TYPE_SOFTWARE, null);
                webView.invalidate();
                webView.measure(
                        View.MeasureSpec.makeMeasureSpec(widthPx, View.MeasureSpec.EXACTLY),
                        View.MeasureSpec.makeMeasureSpec(heightPx, View.MeasureSpec.EXACTLY)
                );
                webView.layout(0, 0, widthPx, heightPx);

                CaptureResult captured = captureBitmap(webView, widthPx, heightPx);
                Bitmap bitmap = captured.bitmap;
                boolean clockLike = GeoClockBitmapHelper.hasClockLikeContent(bitmap);
                Log.i(
                        GeoClockBitmapHelper.VISUAL_TAG,
                        "VISUAL_CAPTURE ts=" + System.currentTimeMillis()
                                + " attempt=" + attempt
                                + " method=" + captured.method
                                + " " + GeoClockBitmapHelper.describeContent(bitmap)
                                + " clockLike=" + clockLike
                                + " attached=" + webView.isAttachedToWindow()
                                + " measured=" + webView.getWidth() + "x" + webView.getHeight()
                                + " thread=" + Thread.currentThread().getName()
                );

                if (!clockLike && attempt + 1 < MAX_CAPTURE_ATTEMPTS) {
                    bitmap.recycle();
                    captureAndFinish(
                            webView, widthPx, heightPx, timing, callback, main, stage,
                            cancelWatchdogs, attempt + 1
                    );
                    return;
                }

                timing.markCaptured();
                stage[0] = clockLike ? "captured-ok" : "captured-blank";
                cancelWatchdogs.run();
                callback.onSuccess(bitmap, timing.build());
                webView.destroy();
            } catch (Throwable t) {
                Log.e(TAG, "webview CAPTURE_ERROR attempt=" + attempt, t);
                cancelWatchdogs.run();
                try {
                    webView.destroy();
                } catch (Throwable ignored) {
                    // ignore
                }
                callback.onError(t);
            }
        }, delay);
    }

    private static CaptureResult captureBitmap(WebView webView, int widthPx, int heightPx) {
        int bg = ContextCompat.getColor(webView.getContext(), R.color.widget_geo_clock_background);

        Bitmap bitmap = Bitmap.createBitmap(widthPx, heightPx, Bitmap.Config.ARGB_8888);
        bitmap.setDensity(webView.getContext().getResources().getDisplayMetrics().densityDpi);
        Canvas canvas = new Canvas(bitmap);
        canvas.drawColor(bg);
        webView.draw(canvas);
        if (GeoClockBitmapHelper.hasClockLikeContent(bitmap)) {
            return new CaptureResult(bitmap, "draw");
        }

        // Fallback: Picture API (algunos WebView Samsung dejan draw() vacío headless).
        try {
            @SuppressWarnings("deprecation")
            Picture picture = webView.capturePicture();
            if (picture != null && picture.getWidth() > 0 && picture.getHeight() > 0) {
                canvas.drawColor(bg);
                canvas.save();
                float scaleX = (float) widthPx / (float) picture.getWidth();
                float scaleY = (float) heightPx / (float) picture.getHeight();
                canvas.scale(scaleX, scaleY);
                picture.draw(canvas);
                canvas.restore();
                if (GeoClockBitmapHelper.hasClockLikeContent(bitmap)) {
                    return new CaptureResult(bitmap, "picture");
                }
            }
        } catch (Throwable t) {
            Log.w(TAG, "capturePicture fallback failed", t);
        }

        return new CaptureResult(bitmap, "draw-blank");
    }

    private static final class CaptureResult {
        final Bitmap bitmap;
        final String method;

        CaptureResult(Bitmap bitmap, String method) {
            this.bitmap = bitmap;
            this.method = method;
        }
    }

    private static final class JsBridge {
        private final Handler main;
        private final Runnable onReady;
        private final ErrorCallback onError;

        JsBridge(Handler main, Runnable onReady, ErrorCallback onError) {
            this.main = main;
            this.onReady = onReady;
            this.onError = onError;
        }

        @JavascriptInterface
        public void onClockReady(String successFlag, String errorMessage) {
            // Los métodos @JavascriptInterface se invocan en un hilo de trabajo del WebView,
            // no en el hilo principal: hay que volver a saltar antes de tocar la vista.
            main.post(() -> {
                if ("1".equals(successFlag)) {
                    onReady.run();
                } else {
                    Log.w(TAG, "onClockReady error: " + errorMessage);
                    onError.onError(errorMessage);
                }
            });
        }
    }

    private interface ErrorCallback {
        void onError(String message);
    }

    public interface RenderCallback {
        void onSuccess(Bitmap bitmap, RenderTiming timing);

        void onError(Throwable error);
    }

    /** Parámetros dinámicos que Java calcula (reutilizando WidgetLocationResolver/GeometricTimeCalculator) y pasa al runtime JS. */
    public static final class RenderParams {
        public final double geometricHour;
        public final double minutes;
        public final Double civilHour;
        public final double moonPhase;
        public final boolean isNorthHemisphere;

        public RenderParams(double geometricHour, double minutes, Double civilHour, double moonPhase, boolean isNorthHemisphere) {
            this.geometricHour = geometricHour;
            this.minutes = minutes;
            this.civilHour = civilHour;
            this.moonPhase = moonPhase;
            this.isNorthHemisphere = isNorthHemisphere;
        }

        JSONObject toJsonObject() throws JSONException {
            JSONObject json = new JSONObject();
            json.put("geometricHour", geometricHour);
            json.put("minutes", minutes);
            json.put("civilHour", civilHour == null ? JSONObject.NULL : civilHour);
            json.put("moonPhase", moonPhase);
            json.put("hemisphere", isNorthHemisphere ? "north" : "south");
            return json;
        }
    }
}
