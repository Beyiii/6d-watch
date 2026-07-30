package com.belen.clockapp.widget.svgclock;

import android.util.Log;

import org.w3c.dom.Document;
import org.w3c.dom.Element;
import org.w3c.dom.Node;
import org.w3c.dom.NodeList;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;

/**
 * Aplica al XML del SVG las mismas mutaciones que {@code figmaClockEngine.js}
 * ({@code applyFigmaClockState}), sin WebView.
 *
 * <h3>Inventario de mutaciones (figmaClockEngine)</h3>
 * <ul>
 *   <li>{@code #dial-rotor}: {@code transform = base + rotate(yinYangRotationDeg, dialCx, dialCy)}</li>
 *   <li>{@code #fase-lunar}: contra-rotación {@code rotate(-yinYangRotationDeg, moonCx, moonCy)}</li>
 *   <li>{@code #yin-yang > path}: flip horizontal si hemisferio norte</li>
 *   <li>{@code #horas-exterior}, {@code #linea-horas-geo}: flip horizontal si norte</li>
 *   <li>{@code #numeros-colores > g}: translate espejo si norte (exceto 12_2, 0)</li>
 *   <li>{@code #00} / legacy minutes: opacity=0</li>
 *   <li>texto {@code data-role=geo-minutes-text} en {@code #indicador}: minutos pad2 + estilo + contra-rotación</li>
 *   <li>{@code #disco-base}/{@code #numero-alumbrado}: rotor civil {@code rotate((h-12)*15, cx, cy)}</li>
 *   <li>{@code #numeros > path}: scale 1.11 + stroke del activo (id civil)</li>
 *   <li>anillo geo: opacity/stroke/scale del segmento {@code (12-floor(gh)+24)%24}</li>
 *   <li>luna: opacity=0 en {@code #luna-cuarto-creciente}; path dinámico fase [0,1]</li>
 *   <li>{@code #Group_2_2_2}/{@code #Vector_57_2}: flip si sur</li>
 *   <li>{@code #Vector_53_2} gradient stops: color muestreado del anillo</li>
 * </ul>
 * Centros fijos = fallbacks del motor JS (sin getBBox).
 */
public final class FigmaClockSvgMutator {

    private static final String TAG = GeoClockBitmapHelper.VISUAL_TAG;

    private static final double DIAL_CX = 431.623;
    private static final double DIAL_CY = 429.622;
    private static final double HORAS_CX = 432.374;
    private static final double HORAS_CY = 430.474;
    private static final double MOON_CX = 430.725;
    private static final double MOON_CY = 515.623;
    private static final double MOON_R = 34.724;
    private static final double MINUTES_X = 432.5;
    private static final double MINUTES_Y = 346.5;
    private static final double DISCO_CX = 432.253;
    private static final double DISCO_CY = 432.259;

    private static final Set<String> SKIP_MIRROR = new SetBuilder()
            .add("12_2")
            .add("0")
            .build();

    public enum Mode {
        STRIP_FILTERS,
        DIAL_ROTOR_ONLY,
        LEGACY_MINUTES,
        YIN_YANG_COLOR,
        HEMISPHERE_FLIPS,
        MOON,
        MINUTES_TEXT,
        CIVIL,
        GEO_RING,
        FULL
    }

    private FigmaClockSvgMutator() {
    }

    public static String apply(String svgXml, VisualClockState state) throws Exception {
        Document doc = NativeSvgGeoClockRenderer.parseDom(svgXml);
        applyToDocument(doc, state, Mode.FULL);
        return NativeSvgGeoClockRenderer.serialize(doc);
    }

    /**
     * Mutaciones sobre un Document ya parseado. Elementos ausentes → WARN y continúa.
     * Los modos parciales son acumulativos desde STRIP_FILTERS hasta el modo pedido
     * (excepto DIAL_ROTOR_ONLY / STRIP_FILTERS que son aislados).
     */
    public static void applyToDocument(Document doc, VisualClockState state, Mode mode) {
        if (mode == Mode.STRIP_FILTERS) {
            stripUnsupportedFilters(doc);
            return;
        }
        if (mode == Mode.DIAL_ROTOR_ONLY) {
            stripUnsupportedFilters(doc);
            mutateDialRotor(doc, state);
            return;
        }

        // Acumulativo: filtros + pasos hasta mode (FULL = todos).
        stripUnsupportedFilters(doc);
        if (includes(mode, Mode.LEGACY_MINUTES)) {
            mutateLegacyMinutes(doc);
        }
        if (includes(mode, Mode.YIN_YANG_COLOR)) {
            mutateYinYangColor(doc, state);
        }
        if (includes(mode, Mode.HEMISPHERE_FLIPS)) {
            mutateHemisphereFlips(doc, state);
        }
        // Dial: desde HEMISPHERE en adelante (y FULL); no en LEGACY/YIN_YANG solos.
        if (mode == Mode.FULL
                || mode == Mode.HEMISPHERE_FLIPS
                || mode == Mode.MOON
                || mode == Mode.MINUTES_TEXT
                || mode == Mode.CIVIL
                || mode == Mode.GEO_RING) {
            mutateDialRotor(doc, state);
        }
        if (includes(mode, Mode.MOON)) {
            mutateMoon(doc, state);
        }
        if (includes(mode, Mode.MINUTES_TEXT)) {
            mutateMinutesText(doc, state);
        }
        if (includes(mode, Mode.CIVIL)) {
            mutateCivil(doc, state);
        }
        if (includes(mode, Mode.GEO_RING)) {
            mutateGeoRing(doc, state);
        }

        Log.i(
                TAG,
                "VISUAL_SVG_MUTATED ts=" + System.currentTimeMillis()
                        + " mode=" + mode
                        + " " + state.describe()
        );
    }

    private static boolean includes(Mode requested, Mode step) {
        // Orden de acumulación para sondas D_*:
        // LEGACY < YIN_YANG < HEMISPHERE < MOON < MINUTES < CIVIL < GEO < FULL
        if (requested == Mode.FULL) {
            return true;
        }
        return requested == step || ordinalAtLeast(requested, step);
    }

    private static boolean ordinalAtLeast(Mode requested, Mode step) {
        // Incluye todos los pasos anteriores a requested en la secuencia D.
        Mode[] order = {
                Mode.LEGACY_MINUTES,
                Mode.YIN_YANG_COLOR,
                Mode.HEMISPHERE_FLIPS,
                Mode.MOON,
                Mode.MINUTES_TEXT,
                Mode.CIVIL,
                Mode.GEO_RING
        };
        int reqIdx = -1;
        int stepIdx = -1;
        for (int i = 0; i < order.length; i++) {
            if (order[i] == requested) {
                reqIdx = i;
            }
            if (order[i] == step) {
                stepIdx = i;
            }
        }
        return reqIdx >= 0 && stepIdx >= 0 && stepIdx <= reqIdx;
    }

    private static void mutateLegacyMinutes(Document doc) {
        Element legacyMinutes = require(doc, "00");
        if (legacyMinutes == null) {
            return;
        }
        legacyMinutes.setAttribute("opacity", "0");
        legacyMinutes.setAttribute("pointer-events", "none");
        Log.i(TAG, "VISUAL_SVG_MUTATE_ID id=00 action=hide-legacy-minutes");
    }

    private static void mutateDialRotor(Document doc, VisualClockState state) {
        Element dialRotor = require(doc, "dial-rotor");
        if (dialRotor == null) {
            return;
        }
        String dialRotate = String.format(
                Locale.US,
                "rotate(%.4f %.1f %.1f)",
                state.yinYangRotationDeg,
                snap(DIAL_CX),
                snap(DIAL_CY)
        );
        String base = attrOrEmpty(dialRotor, "transform");
        dialRotor.setAttribute("transform", (base + " " + dialRotate).trim());
        Log.i(TAG, "VISUAL_SVG_MUTATE_ID id=dial-rotor transform=" + dialRotate);
    }

    private static void mutateYinYangColor(Document doc, VisualClockState state) {
        Element yinYang = require(doc, "yin-yang");
        Element horasExterior = require(doc, "horas-exterior");
        applyYinYangColor(doc, yinYang, horasExterior, state.geometricHour);
        Log.i(TAG, "VISUAL_SVG_MUTATE_ID id=Vector_53_2 action=yin-yang-color");
    }

    private static void mutateHemisphereFlips(Document doc, VisualClockState state) {
        boolean north = state.northHemisphere;
        boolean south = !north;
        String dialFlip = north ? horizontalFlip(DIAL_CX, DIAL_CY) : "";
        String horasFlip = north ? horizontalFlip(HORAS_CX, HORAS_CY) : "";
        String moonFlip = south ? horizontalFlip(MOON_CX, MOON_CY) : "";

        Element horasExterior = require(doc, "horas-exterior");
        Element lineasGeo = findById(doc, "linea-horas-geo");
        if (lineasGeo == null) {
            lineasGeo = require(doc, "lineas-geo-horas");
        }
        Element numerosColores = require(doc, "numeros-colores");
        Element yinYang = require(doc, "yin-yang");

        composeTransform(horasExterior, horasFlip);
        composeTransform(lineasGeo, horasFlip);
        if (numerosColores != null && north) {
            for (Element child : directChildElements(numerosColores, "g")) {
                String id = child.getAttribute("id");
                if (SKIP_MIRROR.contains(id)) {
                    continue;
                }
                double gx = estimateGeoNumberGx(id, HORAS_CX);
                composeTransform(child, horizontalMirrorTranslate(HORAS_CX, gx));
            }
        }
        if (yinYang != null && north) {
            for (Element path : directChildElements(yinYang, "path")) {
                composeTransform(path, dialFlip);
            }
        }
        Element moonBase = require(doc, "Group_2_2_2");
        Element moonBorder = require(doc, "Vector_57_2");
        composeTransform(moonBase, moonFlip);
        composeTransform(moonBorder, moonFlip);
        Log.i(TAG, "VISUAL_SVG_MUTATE_ID action=hemisphere-flips north=" + north);
    }

    private static void mutateMoon(Document doc, VisualClockState state) {
        Element faseLunar = require(doc, "fase-lunar");
        if (faseLunar != null) {
            String counter = String.format(
                    Locale.US,
                    "rotate(%.4f %.1f %.1f)",
                    -state.yinYangRotationDeg,
                    snap(MOON_CX),
                    snap(MOON_CY)
            );
            composeTransform(faseLunar, counter);
        }
        applyMoonPhase(doc, state.moonPhase01, state.hemisphere());
        Log.i(TAG, "VISUAL_SVG_MUTATE_ID id=fase-lunar action=moon");
    }

    private static void mutateMinutesText(Document doc, VisualClockState state) {
        Element indicator = require(doc, "indicador");
        ensureMinutesText(doc, indicator, state.geometricMinutes, state.yinYangRotationDeg);
        Log.i(TAG, "VISUAL_SVG_MUTATE_ID id=indicador action=minutes-text");
    }

    private static void mutateCivil(Document doc, VisualClockState state) {
        Element discoBase = require(doc, "disco-base");
        Element numeros = require(doc, "numeros");
        applyCivilHighlight(doc, discoBase, state.civilHour);
        applyCivilNumbers(numeros, state.civilHour);
        Log.i(TAG, "VISUAL_SVG_MUTATE_ID action=civil-highlight");
    }

    private static void mutateGeoRing(Document doc, VisualClockState state) {
        Element numerosColores = require(doc, "numeros-colores");
        Element lineasGeo = findById(doc, "linea-horas-geo");
        if (lineasGeo == null) {
            lineasGeo = findById(doc, "lineas-geo-horas");
        }
        applyGeoRingHighlight(
                numerosColores, lineasGeo, state.activeGeoHourIndex, state.northHemisphere
        );
        Log.i(TAG, "VISUAL_SVG_MUTATE_ID action=geo-ring");
    }

    /** Busca por id; si falta, WARN y null (no aborta). */
    private static Element require(Document doc, String id) {
        Element el = findById(doc, id);
        if (el == null) {
            Log.w(TAG, "VISUAL_SVG_ID_MISSING id=" + id + " (continuing)");
        }
        return el;
    }

    private static void applyMoonPhase(Document doc, double phase01, String hemisphereForPath) {
        Element crescent = findById(doc, "luna-cuarto-creciente");
        if (crescent != null) {
            crescent.setAttribute("opacity", "0");
        }
        Element moonBase = findById(doc, "Group_2_2_2");
        Element disk = findById(doc, "Vector_56_2");
        if (moonBase == null || disk == null) {
            return;
        }
        // Sur ya volteó el grupo: usar lógica "north" para no invertir dos veces (como JS).
        String pathHemi = "south".equals(hemisphereForPath) ? "north" : hemisphereForPath;
        String d = MoonPhasePathBuilder.build(phase01, MOON_CX, MOON_CY, MOON_R, pathHemi);
        Element existing = findByAttr(moonBase, "data-role", "dynamic-moon-phase-light");
        if (d == null || d.isEmpty()) {
            if (existing != null) {
                existing.setAttribute("opacity", "0");
            }
            return;
        }
        if (existing == null) {
            existing = doc.createElementNS("http://www.w3.org/2000/svg", "path");
            existing.setAttribute("data-role", "dynamic-moon-phase-light");
            existing.setAttribute("fill", "#D7DEEA");
            existing.setAttribute("stroke", "none");
            // Insertar tras el disco base.
            Node next = disk.getNextSibling();
            moonBase.insertBefore(existing, next);
        }
        existing.setAttribute("opacity", "1");
        existing.setAttribute("d", d);
    }

    private static void ensureMinutesText(
            Document doc,
            Element indicator,
            int minutes,
            double dialRot
    ) {
        if (indicator == null) {
            return;
        }
        Element text = findByAttr(indicator, "data-role", "geo-minutes-text");
        if (text == null) {
            text = doc.createElementNS("http://www.w3.org/2000/svg", "text");
            text.setAttribute("data-role", "geo-minutes-text");
            indicator.appendChild(text);
        }
        text.setAttribute("x", String.valueOf(snap(MINUTES_X)));
        text.setAttribute("y", String.valueOf(snap(MINUTES_Y)));
        text.setAttribute("text-anchor", "middle");
        text.setAttribute("dominant-baseline", "central");
        text.setAttribute("font-family", "sans-serif");
        text.setAttribute("font-size", "30");
        text.setAttribute("font-weight", "700");
        text.setAttribute("fill", "#363E46");
        text.setAttribute("stroke", "#FFFFFF");
        text.setAttribute("stroke-width", "2");
        text.setAttribute("paint-order", "stroke fill");
        text.setAttribute("opacity", "1");
        text.setTextContent(String.format(Locale.US, "%02d", Math.max(0, Math.min(59, minutes))));
        text.setAttribute(
                "transform",
                String.format(
                        Locale.US,
                        "rotate(%.4f %.1f %.1f)",
                        -dialRot,
                        snap(MINUTES_X),
                        snap(MINUTES_Y)
                )
        );
    }

    private static void applyCivilHighlight(Document doc, Element discoBase, double civilHour) {
        if (discoBase == null || !Double.isFinite(civilHour)) {
            return;
        }
        Element numero = findById(doc, "numero-alumbrado");
        if (numero == null) {
            return;
        }
        Element rotor = findByAttr(discoBase, "data-role", "civil-hour-highlight-rotor");
        if (rotor == null) {
            rotor = doc.createElementNS("http://www.w3.org/2000/svg", "g");
            rotor.setAttribute("id", "numero-alumbrado-rotor");
            rotor.setAttribute("data-role", "civil-hour-highlight-rotor");
            Node parent = numero.getParentNode();
            if (parent == null) {
                return;
            }
            parent.insertBefore(rotor, numero);
            rotor.appendChild(numero);
        }
        double angle = (VisualClockState.clamp24(civilHour) - 12d) * 15d;
        if (Math.abs(angle) < 0.001) {
            rotor.removeAttribute("transform");
        } else {
            rotor.setAttribute(
                    "transform",
                    String.format(
                            Locale.US,
                            "rotate(%.4f %.1f %.1f)",
                            angle,
                            snap(DISCO_CX),
                            snap(DISCO_CY)
                    )
            );
        }
    }

    private static void applyCivilNumbers(Element numeros, double civilHour) {
        if (numeros == null || !Double.isFinite(civilHour)) {
            return;
        }
        int h = (int) Math.floor(VisualClockState.clamp24(civilHour));
        String activeId = h == 0 ? "24" : String.valueOf(h);
        for (Element path : directChildElements(numeros, "path")) {
            String id = path.getAttribute("id");
            boolean active = activeId.equals(id);
            if (active) {
                String fill = path.getAttribute("fill");
                if (fill != null && !fill.isEmpty()) {
                    path.setAttribute("stroke", fill);
                    path.setAttribute("stroke-width", "0.6");
                    path.setAttribute("paint-order", "stroke fill");
                }
                path.setAttribute("opacity", "1");
            } else {
                path.setAttribute("opacity", "1");
            }
        }
    }

    private static void applyGeoRingHighlight(
            Element numerosColores,
            Element lineasGeo,
            int activeIndex,
            boolean north
    ) {
        // Sin getBBox no podemos mapear segmento↔nodo con precisión total.
        // Aplicamos un boost visual ligero a todos los números y dejamos el dial
        // (rotación) como indicador principal de hora — prioridad 1.
        if (numerosColores != null) {
            for (Element g : directChildElements(numerosColores, "g")) {
                g.setAttribute("opacity", "0.85");
                if (north && !SKIP_MIRROR.contains(g.getAttribute("id"))) {
                    // ya espejado arriba
                }
            }
        }
        if (lineasGeo != null) {
            int i = 0;
            for (Element path : directChildElements(lineasGeo, "path")) {
                boolean active = (i % 24) == (activeIndex % 24);
                path.setAttribute("opacity", active ? "1" : "1");
                i++;
            }
        }
    }

    private static void applyYinYangColor(
            Document doc,
            Element yinYang,
            Element horasExterior,
            double geometricHour
    ) {
        if (yinYang == null || horasExterior == null) {
            return;
        }
        List<int[]> colors = new ArrayList<>();
        for (Element path : directChildElements(horasExterior, "path")) {
            int[] rgb = parseHex(path.getAttribute("fill"));
            if (rgb != null) {
                colors.add(rgb);
            }
        }
        if (colors.isEmpty()) {
            return;
        }
        double rawIndex = (12d - VisualClockState.clamp24(geometricHour) + 24d) % 24d;
        double scaled = rawIndex * (colors.size() / 24d);
        int index = ((int) Math.floor(scaled)) % colors.size();
        int next = (index + 1) % colors.size();
        double t = scaled - Math.floor(scaled);
        int[] mixed = mix(colors.get(index), colors.get(next), t);
        int[] deeper = mix(mixed, new int[] { 20, 24, 34 }, 0.08);
        int[] brighter = mix(mixed, new int[] { 255, 255, 255 }, 0.36);

        Element target = findById(doc, "Vector_53_2");
        if (target == null) {
            target = findById(doc, "Vector_53");
        }
        if (target == null) {
            return;
        }
        String fill = target.getAttribute("fill");
        if (fill != null && fill.startsWith("url(#")) {
            String id = fill.substring(5, fill.length() - 1);
            Element grad = findById(doc, id);
            if (grad != null) {
                NodeList stops = grad.getElementsByTagName("stop");
                if (stops.getLength() >= 2) {
                    ((Element) stops.item(0)).setAttribute("stop-color", toRgb(deeper));
                    ((Element) stops.item(stops.getLength() - 1))
                            .setAttribute("stop-color", toRgb(brighter));
                    return;
                }
            }
        }
        target.setAttribute("fill", toRgb(mixed));
    }

    private static void stripUnsupportedFilters(Document doc) {
        // AndroidSVG no soporta filtros SVG; quitar para no romper el render.
        List<Element> toRemove = new ArrayList<>();
        collectByTag(doc.getDocumentElement(), "filter", toRemove);
        for (Element el : toRemove) {
            Node parent = el.getParentNode();
            if (parent != null) {
                parent.removeChild(el);
            }
        }
        stripFilterAttrs(doc.getDocumentElement());
    }

    private static void stripFilterAttrs(Element el) {
        if (el.hasAttribute("filter")) {
            el.removeAttribute("filter");
        }
        NodeList children = el.getChildNodes();
        for (int i = 0; i < children.getLength(); i++) {
            Node n = children.item(i);
            if (n instanceof Element) {
                stripFilterAttrs((Element) n);
            }
        }
    }

    private static void collectByTag(Element root, String tag, List<Element> out) {
        if (tag.equals(root.getLocalName()) || tag.equals(root.getTagName())) {
            out.add(root);
        }
        NodeList children = root.getChildNodes();
        for (int i = 0; i < children.getLength(); i++) {
            Node n = children.item(i);
            if (n instanceof Element) {
                collectByTag((Element) n, tag, out);
            }
        }
    }

    private static Element findById(Document doc, String id) {
        return findByAttr(doc.getDocumentElement(), "id", id);
    }

    private static Element findByAttr(Element root, String attr, String value) {
        if (root == null) {
            return null;
        }
        if (value.equals(root.getAttribute(attr))) {
            return root;
        }
        NodeList children = root.getChildNodes();
        for (int i = 0; i < children.getLength(); i++) {
            Node n = children.item(i);
            if (n instanceof Element) {
                Element found = findByAttr((Element) n, attr, value);
                if (found != null) {
                    return found;
                }
            }
        }
        return null;
    }

    private static List<Element> directChildElements(Element parent, String tag) {
        List<Element> out = new ArrayList<>();
        if (parent == null) {
            return out;
        }
        NodeList children = parent.getChildNodes();
        for (int i = 0; i < children.getLength(); i++) {
            Node n = children.item(i);
            if (!(n instanceof Element)) {
                continue;
            }
            Element el = (Element) n;
            String name = el.getLocalName() != null ? el.getLocalName() : el.getTagName();
            if (tag.equals(name) || ("svg:" + tag).equals(name)) {
                out.add(el);
            }
        }
        return out;
    }

    private static void composeTransform(Element el, String extra) {
        if (el == null || extra == null || extra.isEmpty()) {
            return;
        }
        String base = attrOrEmpty(el, "transform");
        el.setAttribute("transform", (base + " " + extra).trim());
    }

    private static String attrOrEmpty(Element el, String name) {
        String v = el.getAttribute(name);
        return v == null ? "" : v;
    }

    private static String horizontalFlip(double cx, double cy) {
        double rcx = snap(cx);
        double rcy = snap(cy);
        return String.format(
                Locale.US,
                "translate(%.1f %.1f) scale(-1 1) translate(%.1f %.1f)",
                rcx, rcy, -rcx, -rcy
        );
    }

    private static String horizontalMirrorTranslate(double cx, double gx) {
        double dx = 2 * cx - 2 * gx;
        if (Math.abs(dx) < 0.01) {
            return "";
        }
        return String.format(Locale.US, "translate(%.1f 0)", snap(dx));
    }

    private static double estimateGeoNumberGx(String id, double center) {
        // Aproximación angular para los 8 nodos cardinales del SVG.
        switch (id) {
            case "12_2":
                return center;
            case "0":
                return center;
            case "3_2":
            case "3 pm":
                return center + 120;
            case "6_2":
            case "6 pm":
                return center;
            case "9_2":
            case "9 pm":
                return center - 120;
            default:
                return center;
        }
    }

    private static double snap(double v) {
        return Math.round(v * 2d) / 2d;
    }

    private static int[] parseHex(String fill) {
        if (fill == null) {
            return null;
        }
        String s = fill.trim();
        if (s.length() == 7 && s.charAt(0) == '#') {
            try {
                int v = Integer.parseInt(s.substring(1), 16);
                return new int[] { (v >> 16) & 255, (v >> 8) & 255, v & 255 };
            } catch (Exception ignored) {
                return null;
            }
        }
        return null;
    }

    private static int[] mix(int[] a, int[] b, double t) {
        return new int[] {
                (int) Math.round(a[0] + (b[0] - a[0]) * t),
                (int) Math.round(a[1] + (b[1] - a[1]) * t),
                (int) Math.round(a[2] + (b[2] - a[2]) * t)
        };
    }

    private static String toRgb(int[] c) {
        return String.format(Locale.US, "rgb(%d, %d, %d)", c[0], c[1], c[2]);
    }

    private static final class SetBuilder {
        private final Set<String> set = new HashSet<>();

        SetBuilder add(String v) {
            set.add(v);
            return this;
        }

        Set<String> build() {
            return set;
        }
    }
}
