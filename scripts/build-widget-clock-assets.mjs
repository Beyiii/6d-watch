#!/usr/bin/env node
// Genera los assets que usa el WebView headless del widget de Android:
// 1. Empaqueta src/widgetClock/widgetClockRuntime.js (que reutiliza la lógica real de
//    useAnimatedFigmaClock.js) como un script IIFE independiente del build principal.
// 2. Copia el SVG definitivo del reloj (public/reloj-v2.svg) sin modificarlo, para que
//    el widget renderice exactamente el mismo archivo que usa la app.
//
// Uso: npm run build:widget-clock

import { execSync } from 'node:child_process'
import { copyFileSync, mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, '..')

const outDir = resolve(root, 'android/app/src/main/assets/widget_clock')
mkdirSync(outDir, { recursive: true })

console.log('[widget-clock] Empaquetando runtime JS...')
execSync('npx vite build --config vite.widget-clock.config.js', {
  cwd: root,
  stdio: 'inherit',
})

console.log('[widget-clock] Copiando reloj-v2.svg (fuente única, sin modificar)...')
copyFileSync(resolve(root, 'public/reloj-v2.svg'), resolve(outDir, 'reloj-v2.svg'))

console.log('[widget-clock] Listo ->', outDir)
