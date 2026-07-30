package com.belen.clockapp.widget.svgclock;

/** Desglose de tiempos (en milisegundos) de cada etapa del render headless, para la validación técnica. */
public final class RenderTiming {

    public final long htmlBuildMs;
    public final long webViewSetupMs;
    public final long pageLoadMs;
    public final long jsApplyMs;
    public final long captureMs;
    public final long totalMs;

    private RenderTiming(long htmlBuildMs, long webViewSetupMs, long pageLoadMs, long jsApplyMs, long captureMs, long totalMs) {
        this.htmlBuildMs = htmlBuildMs;
        this.webViewSetupMs = webViewSetupMs;
        this.pageLoadMs = pageLoadMs;
        this.jsApplyMs = jsApplyMs;
        this.captureMs = captureMs;
        this.totalMs = totalMs;
    }

    @Override
    public String toString() {
        return "RenderTiming{"
                + "htmlBuildMs=" + htmlBuildMs
                + ", webViewSetupMs=" + webViewSetupMs
                + ", pageLoadMs=" + pageLoadMs
                + ", jsApplyMs=" + jsApplyMs
                + ", captureMs=" + captureMs
                + ", totalMs=" + totalMs
                + '}';
    }

    static final class Builder {
        private long tStart;
        private long tHtmlBuilt;
        private long tWebViewReady;
        private long tPageLoaded;
        private long tJsApplied;
        private long tCaptured;

        void markStart() {
            tStart = System.nanoTime();
        }

        void markHtmlBuilt() {
            tHtmlBuilt = System.nanoTime();
        }

        void markWebViewReady() {
            tWebViewReady = System.nanoTime();
        }

        void markPageLoaded() {
            tPageLoaded = System.nanoTime();
        }

        void markJsApplied() {
            tJsApplied = System.nanoTime();
        }

        void markCaptured() {
            tCaptured = System.nanoTime();
        }

        RenderTiming build() {
            return new RenderTiming(
                    toMs(tStart, tHtmlBuilt),
                    toMs(tHtmlBuilt, tWebViewReady),
                    toMs(tWebViewReady, tPageLoaded),
                    toMs(tPageLoaded, tJsApplied),
                    toMs(tJsApplied, tCaptured),
                    toMs(tStart, tCaptured)
            );
        }

        private static long toMs(long fromNanos, long toNanos) {
            if (fromNanos == 0 || toNanos == 0) return -1;
            return Math.round((toNanos - fromNanos) / 1_000_000d);
        }
    }
}
