import { useState } from 'react'
import { Link } from 'react-router'
import Icon from '../components/Icon.jsx'
import LinkDeslizante from '../components/LinkDeslizante.jsx'
import Logo from '../components/Logo.jsx'

const planes = [
  {
    nombre: 'Básico',
    para: 'Para entrenadores que empiezan a medir',
    precio: { mensual: '[PRECIO]', anual: '[PRECIO]' },
    detalle: 'por mes',
    base: 'Incluye:',
    incluye: [
      'Análisis incluidos al mes',
      'Dashboard por jugador',
      'Videos propios o de YouTube',
      'Reporte en PDF',
    ],
    accion: { label: 'Empieza ahora', to: '/registro' },
  },
  {
    nombre: 'Pro',
    para: 'Para academias con varios jugadores',
    precio: { mensual: '[PRECIO]', anual: '[PRECIO]' },
    detalle: 'por mes',
    popular: true,
    base: 'Todo lo del Básico, más:',
    incluye: [
      'Más análisis al mes',
      'Comparador de jugadores',
      'Historial de partidos',
      'Bandeja de reclutamiento',
    ],
    accion: { label: 'Empieza ahora', to: '/registro' },
  },
  {
    nombre: 'Institucional',
    para: 'Para clubes, federaciones y universidades',
    precio: { mensual: 'A medida', anual: 'A medida' },
    detalle: 'Conversemos',
    destacado: true,
    base: 'Todo lo de Pro, más:',
    incluye: ['Volumen por convenio', 'Varios equipos y roles', 'Soporte dedicado'],
    accion: { label: 'Contáctanos', href: 'mailto:consultas@acecam.com' },
  },
]

function Periodo({ anual, onCambiar }) {
  return (
    <div className="mx-auto mt-10 inline-flex items-center gap-3 rounded-full border border-line2 bg-surface px-4 py-2 text-sm">
      <span className={anual ? 'text-muted' : 'text-text'}>Mensual</span>
      <button
        type="button"
        role="switch"
        aria-checked={anual}
        aria-label="Pago anual"
        onClick={onCambiar}
        className="relative h-6 w-11 rounded-full border border-line3 bg-surface2 transition-colors"
      >
        <span
          className={`absolute top-0.5 left-0.5 size-[18px] rounded-full bg-accent transition-transform duration-300 ${
            anual ? 'translate-x-5' : ''
          }`}
        />
      </button>
      <span className={anual ? 'text-text' : 'text-muted'}>Anual</span>
      <span className="rounded-full bg-accent px-2.5 py-0.5 font-display text-xs font-semibold text-on-accent">
        2 meses gratis
      </span>
    </div>
  )
}

function Plan({ plan, anual }) {
  const oscuro = plan.destacado
  const boton = `mt-8 inline-flex w-full items-center justify-center gap-2 rounded-full px-5 py-3 font-semibold transition-opacity hover:opacity-90 ${
    oscuro ? 'bg-bg text-text' : plan.popular ? 'bg-accent text-on-accent' : 'bg-text text-bg'
  }`

  return (
    <article
      className={`relative flex flex-col rounded-[24px] border p-7 ${
        oscuro ? 'border-transparent bg-text text-bg' : 'border-line2 bg-surface shadow-tile'
      }`}
    >
      {plan.popular ? (
        <span className="absolute -top-3 right-6 inline-flex items-center gap-1.5 rounded-full bg-accent px-3 py-1 font-display text-xs font-semibold text-on-accent">
          <Icon name="check" size={14} strokeWidth={2.4} />
          Más popular
        </span>
      ) : null}

      <h2 className="text-2xl">{plan.nombre}</h2>
      <p className={`mt-1 text-sm ${oscuro ? 'opacity-60' : 'text-muted'}`}>{plan.para}</p>

      <p className="mt-8 font-display text-4xl font-semibold">
        {anual ? plan.precio.anual : plan.precio.mensual}
      </p>
      <p className={`mt-1 text-sm ${oscuro ? 'opacity-60' : 'text-muted'}`}>
        {plan.detalle}
        {anual && !oscuro ? ', facturado al año' : ''}
      </p>

      <p className="mt-8 text-sm font-semibold">{plan.base}</p>
      <ul className="mt-3 space-y-2.5 text-sm">
        {plan.incluye.map((item) => (
          <li key={item} className="flex items-center gap-2.5">
            <span className={oscuro ? 'text-bg' : 'text-electric-ink'}>
              <Icon name="check" size={16} strokeWidth={2.2} />
            </span>
            <span className={oscuro ? 'opacity-80' : 'text-text2'}>{item}</span>
          </li>
        ))}
      </ul>

      <div className="mt-auto">
        {plan.accion.to ? (
          <Link to={plan.accion.to} className={boton}>
            {plan.accion.label}
            <Icon name="arrow" size={18} strokeWidth={2.2} />
          </Link>
        ) : (
          <a href={plan.accion.href} className={boton}>
            {plan.accion.label}
            <Icon name="arrow" size={18} strokeWidth={2.2} />
          </a>
        )}
      </div>
    </article>
  )
}

export default function Precios() {
  const [anual, setAnual] = useState(false)

  return (
    <div className="relative overflow-hidden px-6 pt-6 pb-24">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage: 'radial-gradient(var(--line2) 1px, transparent 1px)',
          backgroundSize: '22px 22px',
          maskImage: 'radial-gradient(ellipse 70% 60% at 50% 30%, black, transparent 80%)',
        }}
      />

      <div className="relative mx-auto max-w-6xl">
        <LinkDeslizante
          to="/"
          sentido="atras"
          aria-label="AceCam, volver al inicio"
          className="group inline-flex items-center gap-3 rounded-md"
        >
          <span className="inline-flex size-12 items-center justify-center rounded-full border-2 border-line3 text-text2 ring-text transition-[translate,border-color,color,box-shadow] duration-300 group-hover:-translate-x-1 group-hover:border-text group-hover:text-text group-hover:ring-1">
            <Icon name="arrowBack" size={22} strokeWidth={2.4} />
          </span>
          <Logo size={56} wordmarkClassName="text-4xl" />
        </LinkDeslizante>

        <header className="mt-16 text-center">
          <h1 className="mx-auto max-w-2xl text-4xl sm:text-6xl">Planes para medir cada partido</h1>
          <p className="mx-auto mt-4 max-w-md text-lg text-text2">
            Empieza con un mes gratis. Sin cámaras especiales ni hardware específico.
          </p>
          <Periodo anual={anual} onCambiar={() => setAnual((valor) => !valor)} />
        </header>

        <div className="mx-auto mt-14 grid max-w-5xl gap-5 md:grid-cols-3">
          {planes.map((plan) => (
            <Plan key={plan.nombre} plan={plan} anual={anual} />
          ))}
        </div>
      </div>
    </div>
  )
}
