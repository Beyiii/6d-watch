// Lógica pura: gradiente dinámico según hora geométrica.

export const BACKGROUND_ANCHORS = [
  { hour: 0, stops: ['#08142b', '#1a3d6c', '#4468a3'] },
  { hour: 3, stops: ['#0f3748', '#31938c', '#82cfc2'] },
  { hour: 6, stops: ['#1d492f', '#4a9a5a', '#98d08c'] },
  { hour: 9, stops: ['#bf7e11', '#FFD864', '#fff0b8'] },
  { hour: 12, stops: ['#d8b170', '#FFF0C2', '#fff9e6'] },
  { hour: 15, stops: ['#8a2b1f', '#C44D2C', '#db7f58'] },
  { hour: 18, stops: ['#5d0b12', '#A4171D', '#cd413c'] },
  { hour: 21, stops: ['#281a3f', '#5f4288', '#9276b8'] },
]

function hexToRgb(hex) {
  const clean = hex.replace('#', '')
  const value = parseInt(clean, 16)

  return {
    r: (value >> 16) & 255,
    g: (value >> 8) & 255,
    b: value & 255,
  }
}

function mixChannel(a, b, t) {
  return Math.round(a + (b - a) * t)
}

function mixHexColor(fromHex, toHex, t) {
  const from = hexToRgb(fromHex)
  const to = hexToRgb(toHex)

  return `rgb(${mixChannel(from.r, to.r, t)}, ${mixChannel(from.g, to.g, t)}, ${mixChannel(from.b, to.b, t)})`
}

function resolveAnchorSegment(hour) {
  for (let i = 0; i < BACKGROUND_ANCHORS.length; i++) {
    const current = BACKGROUND_ANCHORS[i]
    const next = BACKGROUND_ANCHORS[(i + 1) % BACKGROUND_ANCHORS.length]

    const segmentStart = current.hour
    const rawEnd = next.hour
    const segmentEnd = rawEnd <= segmentStart ? rawEnd + 24 : rawEnd

    const normalizedHour = hour < segmentStart ? hour + 24 : hour

    if (normalizedHour >= segmentStart && normalizedHour < segmentEnd) {
      const t = (normalizedHour - segmentStart) / (segmentEnd - segmentStart)
      return { current, next, t }
    }
  }

  return {
    current: BACKGROUND_ANCHORS[0],
    next: BACKGROUND_ANCHORS[1],
    t: 0,
  }
}

// Retorna colores ya interpolados para setear en CSS vars.
export function getDynamicBackgroundColors(geometricHour) {
  const wrappedHour = ((geometricHour % 24) + 24) % 24
  const { current, next, t } = resolveAnchorSegment(wrappedHour)

  return {
    start: mixHexColor(current.stops[0], next.stops[0], t),
    mid: mixHexColor(current.stops[1], next.stops[1], t),
    end: mixHexColor(current.stops[2], next.stops[2], t),
  }
}
