import { useRef, useState } from 'react'
import { Link } from 'react-router'
import Icon from '../components/Icon.jsx'
import LinkDeslizante from '../components/LinkDeslizante.jsx'
import Logo from '../components/Logo.jsx'

const INCLINACION = 8

const tonos = {
  basico: {
    tarjeta: 'border-line2 ring-line3 hover:border-line3',
    brillo: '',
    boton: 'border border-line3 text-text hover:border-text2',
    check: 'text-text2',
  },
  pro: {
    tarjeta: 'border-accent-line/60 ring-accent-line hover:border-accent-line',
    brillo: 'from-accent/12',
    boton: 'bg-accent text-on-accent hover:opacity-90',
    check: 'text-accent-ink',
  },
  ultra: {
    tarjeta: 'border-electric/50 ring-electric hover:border-electric',
    brillo: 'from-electric/12',
    boton: 'bg-electric text-on-accent hover:opacity-90',
    check: 'text-electric-ink',
  },
}

const planes = [
  {
    nombre: 'Básico',
    para: 'Para jugadores y padres',
    precio: { mensual: '[PRECIO]', anual: '[PRECIO]' },
    detalle: 'por mes',
    prueba: {
      titulo: '1 mes de prueba gratis',
      limites: ['Hasta 2 jugadores', '2 análisis por día', 'Solo videos de YouTube'],
    },
    base: 'Con el plan completo:',
    incluye: [
      'Hasta 4 jugadores',
      'Dashboard completo por jugador',
      'Videos propios o de YouTube',
      'Reporte en PDF',
    ],
    accion: { label: 'Prueba gratis', to: '/registro' },
  },
  {
    nombre: 'Pro',
    para: 'Para entrenadores y reclutadores',
    precio: { mensual: '[PRECIO]', anual: '[PRECIO]' },
    detalle: 'por mes',
    popular: true,
    tono: 'pro',
    base: 'Todo lo del Básico, más:',
    incluye: ['Más análisis al mes', 'Más jugadores', 'Bandeja de reclutamiento'],
    accion: { label: 'Empieza ahora', to: '/registro' },
  },
  {
    nombre: 'Ultra',
    para: 'Para academias, clubes y universidades',
    precio: { mensual: '[PRECIO]', anual: '[PRECIO]' },
    detalle: 'por mes',
    tono: 'ultra',
    base: 'Todo lo de Pro, más:',
    incluye: ['Muchos más jugadores', 'Muchos más análisis', 'Soporte dedicado'],
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
    </div>
  )
}

function Plan({ plan, anual }) {
  const tono = tonos[plan.tono ?? 'basico']
  const boton = `mt-8 inline-flex w-full items-center justify-center gap-2 rounded-full px-5 py-3 font-semibold transition ${tono.boton}`
  const tarjetaRef = useRef(null)

  const inclinar = (evento) => {
    const tarjeta = tarjetaRef.current
    if (
      evento.pointerType !== 'mouse' ||
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    )
      return
    const rect = tarjeta.getBoundingClientRect()
    const x = (evento.clientX - rect.left) / rect.width - 0.5
    const y = (evento.clientY - rect.top) / rect.height - 0.5
    tarjeta.style.transform = `perspective(900px) rotateX(${-y * INCLINACION}deg) rotateY(${
      x * INCLINACION
    }deg) translateY(-6px)`
  }

  const soltar = () => {
    tarjetaRef.current.style.transform = ''
  }

  return (
    <article
      ref={tarjetaRef}
      onPointerMove={inclinar}
      onPointerLeave={soltar}
      className={`relative flex flex-col rounded-[24px] border bg-surface p-7 shadow-tile transition-[transform,border-color,box-shadow] duration-300 ease-out will-change-transform hover:ring-1 ${tono.tarjeta}`}
    >
      {tono.brillo ? (
        <span
          aria-hidden="true"
          className={`pointer-events-none absolute inset-0 -z-10 rounded-[24px] bg-linear-to-b ${tono.brillo} to-transparent to-45%`}
        />
      ) : null}
      {plan.popular ? (
        <span className="absolute -top-4 right-6 inline-flex items-center gap-2 rounded-full bg-accent px-4 py-1.5 font-display text-sm font-semibold text-on-accent">
          <Icon name="check" size={17} strokeWidth={2.4} />
          Más popular
        </span>
      ) : null}

      <h2 className="text-2xl">{plan.nombre}</h2>
      <p className="mt-1 text-sm text-muted">{plan.para}</p>

      <p className="mt-8 font-display text-4xl font-semibold">
        {anual ? plan.precio.anual : plan.precio.mensual}
      </p>
      <p className="mt-1 text-sm text-muted">
        {plan.detalle}
        {anual ? ', facturado al año' : ''}
      </p>

      {plan.prueba ? (
        <div className="mt-6 rounded-2xl border border-accent-line bg-accent/10 p-4">
          <p className="font-display text-sm font-semibold text-accent-ink">{plan.prueba.titulo}</p>
          <ul className="mt-2 space-y-1.5 text-sm text-text2">
            {plan.prueba.limites.map((limite) => (
              <li key={limite} className="flex items-center gap-2">
                <span className="size-1 shrink-0 rounded-full bg-accent-ink" />
                {limite}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <p className="mt-8 text-sm font-semibold">{plan.base}</p>
      <ul className="mt-3 space-y-2.5 text-sm">
        {plan.incluye.map((item) => (
          <li key={item} className="flex items-center gap-2.5">
            <span className={tono.check}>
              <Icon name="check" size={16} strokeWidth={2.2} />
            </span>
            <span className="text-text2">{item}</span>
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
          <span className="inline-flex size-9 items-center justify-center rounded-full border-2 border-line3 text-text2 ring-text transition-[translate,border-color,color,box-shadow] duration-300 group-hover:-translate-x-1 group-hover:border-text group-hover:text-text group-hover:ring-1">
            <Icon name="arrowBack" size={17} strokeWidth={2.4} />
          </span>
          <Logo size={56} wordmarkClassName="text-4xl" />
        </LinkDeslizante>

        <header className="mt-16 text-center">
          <h1 className="mx-auto max-w-2xl text-4xl sm:text-6xl">
            Elige cómo quieres medir tu juego
          </h1>
          <p className="mx-auto mt-4 max-w-md text-lg text-text2">
            Prueba <span className="text-accent-ink">AceCam</span> gratis durante un mes con el plan
            Básico.
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
