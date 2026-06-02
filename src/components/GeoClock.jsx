import { useEffect, useRef, useState } from 'react'

function toFixed2(n) {
  return n.toString().padStart(2, '0')
}

function computeAngleDeg(hour, direction) {
  const h = ((hour % 24) + 24) % 24

  if (direction === 1) {
    return -15 * (h - 6)
  }

  return -15 * (18 - h)
}

export default function GeoClock({
  snapshot,
  hemisphere = 'south',
  bgMid = null,
  dialSize = 420,
  wrapId = null,
  onOpen = null,
}) {
  const wrapperRef = useRef(null)
  const [svgHtml, setSvgHtml] = useState('')

  const geometricHour = snapshot?.raw?.geometricHour
  const gh = typeof geometricHour === 'number' && Number.isFinite(geometricHour) ? ((geometricHour % 24) + 24) % 24 : 0
  const geoHms = snapshot?.raw?.geoHms ?? { h: 0, m: 0, s: 0 }
  const geoMinutesText = toFixed2(Math.floor(geoHms.m ?? 0))

  const direction = hemisphere === 'north' ? -1 : 1
  const pointerAngleDeg = computeAngleDeg(gh, direction)
  const yinyangRotationDeg = pointerAngleDeg + 90

  useEffect(() => {
    fetch(new URL('./reloj-bueno.svg', import.meta.url).href)
      .then((res) => res.text())
      .then(setSvgHtml)
      .catch((err) => console.error('Error loading SVG:', err))
  }, [])

  useEffect(() => {
    if (!wrapperRef.current || !svgHtml) return

    const svg = wrapperRef.current.querySelector('svg')
    if (!svg) return

    const yinYangGroup = svg.querySelector('#yin-yang')
    const indicadorGroup = svg.querySelector('#indicador')

    if (yinYangGroup) {
      const cx = 430.5
      const cy = 430.5
      yinYangGroup.setAttribute('transform', `rotate(${yinyangRotationDeg} ${cx} ${cy})`)
    }

    if (indicadorGroup) {
      const cx = 430.5
      const cy = 430.5
      indicadorGroup.setAttribute('transform', `rotate(${yinyangRotationDeg} ${cx} ${cy})`)
    }
  }, [yinyangRotationDeg, svgHtml])

  return (
    <div
      ref={wrapperRef}
      id={wrapId || undefined}
      className={['geo-dial-wrap', onOpen ? 'is-clickable' : ''].filter(Boolean).join(' ')}
      style={{ '--geo-dial-size': `${dialSize}px` }}
      role={onOpen ? 'button' : undefined}
      tabIndex={onOpen ? 0 : undefined}
      onClick={onOpen ? onOpen : undefined}
      onKeyDown={
        onOpen
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                onOpen()
              }
            }
          : undefined
      }
    >
      <div
        dangerouslySetInnerHTML={{ __html: svgHtml }}
        className="geo-dial-svg-container"
      />
    </div>
  )
}
