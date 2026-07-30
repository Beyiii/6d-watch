package com.belen.clockapp.widget.svgclock;

import android.content.Context;
import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.RectF;
import android.util.Log;

import androidx.core.content.ContextCompat;

import com.belen.clockapp.R;
import com.caverock.androidsvg.SVG;
import com.caverock.androidsvg.SVGParseException;

import org.w3c.dom.Document;

import java.io.BufferedReader;
import java.io.ByteArrayInputStream;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.io.StringWriter;
import java.nio.charset.StandardCharsets;
import java.util.Locale;
import java.util.concurrent.atomic.AtomicBoolean;

import javax.xml.parsers.DocumentBuilderFactory;
import javax.xml.transform.OutputKeys;
import javax.xml.transform.TransformerFactory;
import javax.xml.transform.dom.DOMSource;
import javax.xml.transform.stream.StreamResult;

/**
 * Rasteriza {@code assets/widget_clock/reloj-v2.svg} con AndroidSVG (sin WebView).
 * Incluye sondas A–D para aislar incompatibilidades.
 */
public final class NativeSvgGeoClockRenderer {

    private static final String TAG = GeoClockBitmapHelper.VISUAL_TAG;
    private static final String SVG_ASSET = "widget_clock/reloj-v2.svg";
    private static final AtomicBoolean PROBES_RAN = new AtomicBoolean(false);

    /** Durante diagnóstico: Canvas NO se usa como fallback (ver Worker). */
    public static final boolean CANVAS_FALLBACK_ENABLED = false;

    private NativeSvgGeoClockRenderer() {
    }

    public static Bitmap render(Context context, VisualClockState state, int sizePx)
            throws Exception {
        return render(context, state, sizePx, AppWidgetManagerCompat.INVALID_ID);
    }

    public static Bitmap render(
            Context context,
            VisualClockState state,
            int sizePx,
            int appWidgetId
    ) throws Exception {
        int size = Math.max(120, sizePx);
        logStage(
                "VISUAL_NATIVE_SVG_START",
                appWidgetId,
                "sizePx=" + size + " " + state.describe()
                        + " thread=" + Thread.currentThread().getName()
        );

        String raw;
        try {
            raw = readAsset(context, SVG_ASSET);
            logStage(
                    "VISUAL_SVG_ASSET_LOADED",
                    appWidgetId,
                    "bytes=" + raw.length()
                            + " viewBoxHint=" + extractViewBox(raw)
            );
        } catch (Throwable t) {
            fail(appWidgetId, "asset-load", t);
            throw t;
        }

        if (PROBES_RAN.compareAndSet(false, true)) {
            runIsolatedProbes(context, raw, state, size, appWidgetId);
        }

        String mutated;
        try {
            Document doc = parseDom(raw);
            logStage(
                    "VISUAL_SVG_DOM_PARSED",
                    appWidgetId,
                    "root=" + (doc.getDocumentElement() != null
                            ? doc.getDocumentElement().getTagName()
                            : "null")
            );

            FigmaClockSvgMutator.applyToDocument(doc, state, FigmaClockSvgMutator.Mode.FULL);
            logStage(
                    "VISUAL_SVG_MUTATION_COMPLETE",
                    appWidgetId,
                    "mode=FULL " + state.describe()
            );

            mutated = serialize(doc);
            logStage(
                    "VISUAL_SVG_SERIALIZED",
                    appWidgetId,
                    "bytes=" + mutated.length()
            );
        } catch (Throwable t) {
            fail(appWidgetId, "dom-mutate", t);
            throw t;
        }

        SVG svg;
        try {
            svg = SVG.getFromString(mutated);
            svg.setDocumentWidth(size);
            svg.setDocumentHeight(size);
            logStage(
                    "VISUAL_ANDROIDSVG_PARSED",
                    appWidgetId,
                    "docW=" + svg.getDocumentWidth()
                            + " docH=" + svg.getDocumentHeight()
                            + " viewBox=" + String.valueOf(svg.getDocumentViewBox())
            );
        } catch (Throwable t) {
            fail(appWidgetId, "androidsvg-parse", t);
            throw t;
        }

        Bitmap bitmap;
        try {
            bitmap = drawSvg(context, svg, size);
            logStage(
                    "VISUAL_NATIVE_SVG_DRAW_COMPLETE",
                    appWidgetId,
                    "size=" + size
                            + " " + GeoClockBitmapHelper.describeContent(bitmap)
                            + " nonTransparentPct="
                            + String.format(Locale.US, "%.2f", nonTransparentPct(bitmap))
            );
        } catch (Throwable t) {
            fail(appWidgetId, "draw", t);
            throw t;
        }

        boolean valid = GeoClockBitmapHelper.hasClockLikeContent(bitmap);
        logStage(
                "VISUAL_NATIVE_SVG_BITMAP_VALID",
                appWidgetId,
                "valid=" + valid
                        + " " + GeoClockBitmapHelper.describeContent(bitmap)
                        + " nonTransparentPct="
                        + String.format(Locale.US, "%.2f", nonTransparentPct(bitmap))
        );
        if (!valid) {
            IllegalStateException err = new IllegalStateException(
                    "native SVG bitmap not clock-like"
            );
            fail(appWidgetId, "bitmap-invalid", err);
            throw err;
        }
        return bitmap;
    }

    /**
     * Sondas A–D (una vez por proceso). No abortan el render principal.
     */
    private static void runIsolatedProbes(
            Context context,
            String raw,
            VisualClockState state,
            int size,
            int appWidgetId
    ) {
        Log.i(TAG, "VISUAL_SVG_PROBE_BEGIN appWidgetId=" + appWidgetId);

        // A: original sin mutación
        probe(context, "A_raw", raw, size, appWidgetId);

        // B: solo quitar filtros
        try {
            Document docB = parseDom(raw);
            FigmaClockSvgMutator.applyToDocument(docB, state, FigmaClockSvgMutator.Mode.STRIP_FILTERS);
            probe(context, "B_strip_filters", serialize(docB), size, appWidgetId);
        } catch (Throwable t) {
            Log.e(TAG, "VISUAL_SVG_PROBE_FAIL probe=B_strip_filters", t);
        }

        // C: una mutación (#dial-rotor)
        try {
            Document docC = parseDom(raw);
            FigmaClockSvgMutator.applyToDocument(docC, state, FigmaClockSvgMutator.Mode.DIAL_ROTOR_ONLY);
            probe(context, "C_dial_rotor", serialize(docC), size, appWidgetId);
        } catch (Throwable t) {
            Log.e(TAG, "VISUAL_SVG_PROBE_FAIL probe=C_dial_rotor", t);
        }

        // D: mutaciones acumulativas
        FigmaClockSvgMutator.Mode[] steps = {
                FigmaClockSvgMutator.Mode.LEGACY_MINUTES,
                FigmaClockSvgMutator.Mode.YIN_YANG_COLOR,
                FigmaClockSvgMutator.Mode.HEMISPHERE_FLIPS,
                FigmaClockSvgMutator.Mode.MOON,
                FigmaClockSvgMutator.Mode.MINUTES_TEXT,
                FigmaClockSvgMutator.Mode.CIVIL,
                FigmaClockSvgMutator.Mode.GEO_RING,
                FigmaClockSvgMutator.Mode.FULL
        };
        for (FigmaClockSvgMutator.Mode mode : steps) {
            try {
                Document doc = parseDom(raw);
                FigmaClockSvgMutator.applyToDocument(doc, state, mode);
                probe(context, "D_" + mode.name(), serialize(doc), size, appWidgetId);
            } catch (Throwable t) {
                Log.e(TAG, "VISUAL_SVG_PROBE_FAIL probe=D_" + mode.name(), t);
            }
        }
        Log.i(TAG, "VISUAL_SVG_PROBE_END appWidgetId=" + appWidgetId);
    }

    private static void probe(
            Context context,
            String name,
            String svgXml,
            int size,
            int appWidgetId
    ) {
        try {
            SVG svg = SVG.getFromString(svgXml);
            svg.setDocumentWidth(size);
            svg.setDocumentHeight(size);
            Bitmap bm = drawSvg(context, svg, size);
            boolean ok = GeoClockBitmapHelper.hasClockLikeContent(bm);
            Log.i(
                    TAG,
                    "VISUAL_SVG_PROBE ts=" + System.currentTimeMillis()
                            + " probe=" + name
                            + " appWidgetId=" + appWidgetId
                            + " xmlBytes=" + svgXml.length()
                            + " ok=" + ok
                            + " " + GeoClockBitmapHelper.describeContent(bm)
                            + " nonTransparentPct="
                            + String.format(Locale.US, "%.2f", nonTransparentPct(bm))
            );
            bm.recycle();
        } catch (Throwable t) {
            Log.e(
                    TAG,
                    "VISUAL_SVG_PROBE ts=" + System.currentTimeMillis()
                            + " probe=" + name
                            + " appWidgetId=" + appWidgetId
                            + " FAILED xmlBytes=" + svgXml.length(),
                    t
            );
        }
    }

    static Document parseDom(String svgXml) throws Exception {
        DocumentBuilderFactory factory = DocumentBuilderFactory.newInstance();
        factory.setNamespaceAware(true);
        // Android DocumentBuilderFactoryImpl NO soporta varios features Apache;
        // setearlos lanza ParserConfigurationException y abortaba todo el render.
        trySetFeature(factory, "http://xml.org/sax/features/external-general-entities", false);
        trySetFeature(factory, "http://xml.org/sax/features/external-parameter-entities", false);
        trySetFeature(
                factory,
                "http://apache.org/xml/features/nonvalidating/load-external-dtd",
                false
        );
        return factory.newDocumentBuilder()
                .parse(new ByteArrayInputStream(svgXml.getBytes(StandardCharsets.UTF_8)));
    }

    private static void trySetFeature(
            DocumentBuilderFactory factory,
            String name,
            boolean value
    ) {
        try {
            factory.setFeature(name, value);
        } catch (Throwable t) {
            Log.w(TAG, "VISUAL_SVG_DOM_FEATURE_SKIP feature=" + name + " msg=" + t.getMessage());
        }
    }

    static String serialize(Document doc) throws Exception {
        StringWriter writer = new StringWriter();
        TransformerFactory tf = TransformerFactory.newInstance();
        javax.xml.transform.Transformer transformer = tf.newTransformer();
        transformer.setOutputProperty(OutputKeys.OMIT_XML_DECLARATION, "yes");
        transformer.setOutputProperty(OutputKeys.ENCODING, "UTF-8");
        transformer.setOutputProperty(OutputKeys.METHOD, "xml");
        transformer.transform(new DOMSource(doc), new StreamResult(writer));
        String out = writer.toString();
        // Algunos serializers omiten el namespace SVG; AndroidSVG lo tolera mejor con root svg.
        return out;
    }

    private static Bitmap drawSvg(Context context, SVG svg, int size) throws SVGParseException {
        Bitmap bitmap = Bitmap.createBitmap(size, size, Bitmap.Config.ARGB_8888);
        bitmap.setDensity(context.getResources().getDisplayMetrics().densityDpi);
        Canvas canvas = new Canvas(bitmap);
        canvas.drawColor(ContextCompat.getColor(context, R.color.widget_geo_clock_background));
        svg.renderToCanvas(canvas, new RectF(0, 0, size, size));
        return bitmap;
    }

    private static double nonTransparentPct(Bitmap bitmap) {
        if (bitmap == null || bitmap.isRecycled()) {
            return 0d;
        }
        int w = bitmap.getWidth();
        int h = bitmap.getHeight();
        int[] row = new int[w];
        int opaque = 0;
        int total = w * h;
        for (int y = 0; y < h; y++) {
            bitmap.getPixels(row, 0, w, 0, y, w, 1);
            for (int x = 0; x < w; x++) {
                if (Color.alpha(row[x]) > 8) {
                    opaque++;
                }
            }
        }
        return total == 0 ? 0d : (100d * opaque / total);
    }

    private static String extractViewBox(String svg) {
        int i = svg.indexOf("viewBox=");
        if (i < 0) {
            return "none";
        }
        int q1 = svg.indexOf('"', i);
        int q2 = svg.indexOf('"', q1 + 1);
        if (q1 < 0 || q2 < 0) {
            return "none";
        }
        return svg.substring(q1 + 1, q2);
    }

    private static void logStage(String event, int appWidgetId, String details) {
        Log.i(
                TAG,
                event + " ts=" + System.currentTimeMillis()
                        + " appWidgetId=" + appWidgetId
                        + " " + details
        );
    }

    private static void fail(int appWidgetId, String stage, Throwable t) {
        Log.e(
                TAG,
                "VISUAL_NATIVE_SVG_RENDER_FAILED ts=" + System.currentTimeMillis()
                        + " appWidgetId=" + appWidgetId
                        + " stage=" + stage
                        + " msg=" + t.getMessage(),
                t
        );
    }

    private static String readAsset(Context context, String path) throws Exception {
        StringBuilder out = new StringBuilder();
        try (InputStream in = context.getAssets().open(path);
             BufferedReader reader = new BufferedReader(
                     new InputStreamReader(in, StandardCharsets.UTF_8))) {
            String line;
            while ((line = reader.readLine()) != null) {
                out.append(line).append('\n');
            }
        }
        return out.toString();
    }

    /** Evita dependencia circular con AppWidgetManager en firmas. */
    static final class AppWidgetManagerCompat {
        static final int INVALID_ID = 0;
    }
}
