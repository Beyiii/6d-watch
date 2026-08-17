import { CardLabel } from './GlassCard.jsx'

const LEGEND_ITEMS = [
  {
    id: 'terminator',
    label: 'Terminador (0°)',
    description: 'Límite entre día y noche. El Sol está exactamente en el horizonte.',
    swatch: 'terminator',
  },
  {
    id: 'civil',
    label: 'Crepúsculo civil (0° a -6°)',
    description: 'Todavía existe suficiente luz natural para realizar actividades cotidianas sin iluminación artificial.',
    swatch: 'civil',
  },
  {
    id: 'nautical',
    label: 'Crepúsculo náutico (-6° a -12°)',
    description: 'El horizonte aún es visible, condición tradicionalmente utilizada para la navegación y actividades náuticas.',
    swatch: 'nautical',
  },
  {
    id: 'astronomical',
    label: 'Crepúsculo astronómico (-12° a -18°)',
    description: 'El cielo se vuelve progresivamente oscuro y comienzan a ser posibles observaciones astronómicas de mayor calidad.',
    swatch: 'astronomical',
  },
  {
    id: 'night',
    label: 'Noche astronómica (< -18°)',
    description: 'La iluminación solar deja de afectar significativamente el cielo, proporcionando las mejores condiciones para la observación astronómica.',
    swatch: 'night',
  },
]

function ColorSwatch({ type }) {
  return (
    <div className={`map-solar-legend__swatch map-solar-legend__swatch--${type}`} aria-hidden="true" />
  )
}

function TerminatorSwatch() {
  return (
    <div className="map-solar-legend__swatch map-solar-legend__swatch--terminator" aria-hidden="true">
      <span className="map-solar-legend__terminator-glow" />
      <span className="map-solar-legend__terminator-core" />
    </div>
  )
}

export default function SolarMapLegend() {
  return (
    <aside className="map-solar-legend" aria-label="Leyenda de zonas crepusculares">
      <CardLabel className="mb-2.5 text-sun/80">Zonas crepusculares</CardLabel>
      <ul className="map-solar-legend__list">
        {LEGEND_ITEMS.map((item, index) => (
          <li key={item.id} className="map-solar-legend__item">
            {item.swatch === 'terminator'
              ? <TerminatorSwatch />
              : <ColorSwatch type={item.swatch} />}
            <div className="map-solar-legend__text">
              <p className="map-solar-legend__label text-sun/80">{item.label}</p>
              <p className="text-xs leading-snug text-muted-foreground">{item.description}</p>
              {index < LEGEND_ITEMS.length - 1 ? (
                <div className="map-solar-legend__divider" aria-hidden="true" />
              ) : null}
            </div>
          </li>
        ))}
      </ul>
    </aside>
  )
}
