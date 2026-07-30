package com.belen.clockapp.widget.svgclock;

import android.content.Context;
import android.content.res.AssetManager;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;

/**
 * Construye el documento HTML que se carga en el WebView headless: incrusta el SVG real
 * ({@code assets/widget_clock/reloj-v2.svg}, copia sin modificar de {@code public/reloj-v2.svg})
 * y el runtime JS empaquetado ({@code assets/widget_clock/widget-clock-runtime.js}, que reutiliza
 * la misma lógica de {@code src/core/figmaClockEngine.js} que usa la app web).
 * <p>
 * El documento permanece transparente porque el color oscuro definitivo se compone en el
 * Canvas nativo y en el layout RemoteViews usando el mismo recurso de color.
 */
final class SvgClockHtmlBuilder {

    private static final String ASSET_DIR = "widget_clock";
    private static final String SVG_ASSET = ASSET_DIR + "/reloj-v2.svg";
    private static final String RUNTIME_JS_ASSET = ASSET_DIR + "/widget-clock-runtime.js";

    private SvgClockHtmlBuilder() {
    }

    /**
     * @param cssWidth  ancho del contenido en px CSS (equivalentes a dp: en Android WebView,
     *                  sin viewport meta y con {@code setUseWideViewPort(false)}, 1px CSS = 1dp).
     *                  El WebView escala automáticamente ese contenido a la resolución física real
     *                  (según {@code density}) al componer el frame, por eso NO debe pasarse aquí
     *                  el tamaño en px físicos: hacerlo produce un "zoom" que solo muestra la
     *                  esquina superior izquierda del reloj.
     * @param cssHeight alto del contenido en px CSS (dp).
     */
    static String build(Context context, int cssWidth, int cssHeight) throws IOException {
        String svgContent = readAsset(context, SVG_ASSET);
        String runtimeJs = readAsset(context, RUNTIME_JS_ASSET);

        StringBuilder html = new StringBuilder(svgContent.length() + runtimeJs.length() + 1024);
        html.append("<!DOCTYPE html><html><head><meta charset=\"utf-8\" />")
                .append("<style>")
                .append("html,body{margin:0;padding:0;width:").append(cssWidth).append("px;height:").append(cssHeight)
                .append("px;background:transparent;overflow:hidden;}")
                .append("#widget-clock-root{position:absolute;top:0;left:0;width:").append(cssWidth).append("px;height:").append(cssHeight).append("px;")
                .append("background:transparent;}")
                .append("#widget-clock-root svg{position:absolute;top:0;left:0;width:").append(cssWidth).append("px !important;height:")
                .append(cssHeight).append("px !important;display:block;}")
                .append("</style></head><body>")
                .append("<div id=\"widget-clock-root\">")
                .append(svgContent)
                .append("</div>")
                .append("<script>window.onerror=function(m,s,l,c,e){console.error('window.onerror: '+m+' @'+l+':'+c+(e&&e.stack?(' '+e.stack):''));};</script>")
                .append("<script>").append(runtimeJs).append("</script>")
                .append("</body></html>");

        return html.toString();
    }

    private static String readAsset(Context context, String path) throws IOException {
        AssetManager assets = context.getAssets();
        StringBuilder out = new StringBuilder();
        try (InputStream input = assets.open(path);
             BufferedReader reader = new BufferedReader(new InputStreamReader(input, StandardCharsets.UTF_8))) {
            String line;
            while ((line = reader.readLine()) != null) {
                out.append(line).append('\n');
            }
        }
        return out.toString();
    }
}
