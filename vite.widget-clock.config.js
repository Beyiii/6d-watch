import { resolve } from 'node:path'
import { defineConfig } from 'vite'

// Build separado y aislado del build principal de la app: empaqueta únicamente el
// runtime del reloj (src/widgetClock/widgetClockRuntime.js) como un script IIFE
// autocontenido que se carga dentro del WebView headless del widget de Android.
export default defineConfig({
  build: {
    outDir: resolve(__dirname, 'android/app/src/main/assets/widget_clock'),
    emptyOutDir: false,
    minify: 'esbuild',
    target: 'es2018',
    lib: {
      entry: resolve(__dirname, 'src/widgetClock/widgetClockRuntime.js'),
      formats: ['iife'],
      name: 'WidgetClockRuntime',
      fileName: () => 'widget-clock-runtime.js',
    },
  },
})
