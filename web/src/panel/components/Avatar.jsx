import { AVATARES } from '../lib/avatares.jsx'

const trazo = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
}

function iniciales(nombre = '') {
  return (
    nombre
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((palabra) => palabra[0])
      .join('')
      .toUpperCase() || '—'
  )
}

export default function Avatar({ nombre, indice = 0, className = '', texto = 'text-sm' }) {
  const avatar = AVATARES[indice] ?? AVATARES[0]
  return (
    <span
      className={`grid place-items-center rounded-full font-bold ${texto} ${className}`}
      style={{ background: avatar.fondo, color: avatar.tinta }}
    >
      {avatar.dibujo ? (
        <svg viewBox="0 0 24 24" aria-hidden="true" className="size-[58%]" {...trazo}>
          {avatar.dibujo}
        </svg>
      ) : (
        iniciales(nombre)
      )}
    </span>
  )
}
