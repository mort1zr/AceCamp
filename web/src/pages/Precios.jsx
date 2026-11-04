import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router'
import Icon from '../components/Icon.jsx'
import LinkDeslizante from '../components/LinkDeslizante.jsx'
import FooterGrande from '../components/FooterGrande.jsx'
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
      limites: ['Hasta 2 jugadores', '15 análisis en el mes', 'Solo videos de YouTube'],
    },
    base: 'Con el plan completo:',
    incluye: [
      'Hasta 2 jugadores',
      '30 análisis al mes',
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
    incluye: [
      '150 análisis al mes',
      'Hasta 24 jugadores',
      'Comparador de hasta 4 jugadores',
      'Panel de todo tu equipo',
      'Bandeja de reclutamiento',
      'Soporte prioritario',
    ],
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

const comparados = planes.slice(0, 2)

const comparacion = [
  {
    grupo: 'Uso',
    filas: [
      { label: 'Prueba gratis de 1 mes', valores: [true, false] },
      { label: 'Jugadores', valores: ['Hasta 2', 'Hasta 24'] },
      { label: 'Análisis al mes', valores: ['30', '150'] },
    ],
  },
  {
    grupo: 'Análisis',
    filas: [
      { label: 'Videos propios', valores: [true, true] },
      { label: 'Videos de YouTube', valores: [true, true] },
      { label: 'Dashboard por jugador', valores: [true, true] },
      { label: 'Reporte en PDF', valores: [true, true] },
    ],
  },
  {
    grupo: 'Equipo y reclutamiento',
    filas: [
      { label: 'Comparador de hasta 4 jugadores', valores: [false, true] },
      { label: 'Panel de todo tu equipo', valores: [false, true] },
      { label: 'Bandeja de reclutamiento', valores: [false, true] },
      { label: 'Soporte prioritario', valores: [false, true] },
    ],
  },
]

const columnaPro = 'bg-accent/8'
const encabezado = 'sticky top-0 z-10 shadow-[0_1px_0_var(--line3)]'
const fondoPro = 'bg-linear-to-b from-accent/8 to-accent/8'

function Valor({ valor, destacado }) {
  if (typeof valor === 'string') {
    return (
      <span
        className={`font-display text-base font-semibold ${destacado ? 'text-accent-ink' : 'text-text'}`}
      >
        {valor}
      </span>
    )
  }
  if (valor) {
    return (
      <span
        className={`inline-grid size-6 place-content-center rounded-full ${
          destacado ? 'bg-accent text-on-accent' : 'bg-chip text-text2'
        }`}
      >
        <Icon name="check" size={14} strokeWidth={2.8} />
        <span className="sr-only">Sí</span>
      </span>
    )
  }
  return (
    <span className="inline-block h-px w-3 bg-line3 align-middle">
      <span className="sr-only">No</span>
    </span>
  )
}

function Comparar({ anual }) {
  const marcaRef = useRef(null)
  const [fijo, setFijo] = useState(false)

  useEffect(() => {
    const observador = new IntersectionObserver(([entrada]) =>
      setFijo(!entrada.isIntersecting && entrada.boundingClientRect.top < 0),
    )
    observador.observe(marcaRef.current)
    return () => observador.disconnect()
  }, [])

  const fondo = fijo ? 'bg-bg' : ''

  return (
    <section className="mx-auto mt-44 max-w-5xl">
      <h2 className="text-center text-4xl sm:text-5xl">Compara nuestros planes</h2>

      <div ref={marcaRef} aria-hidden="true" className="mt-12 h-px" />
      <div className="max-sm:overflow-x-auto">
        <table className="w-full min-w-[34rem] border-collapse text-left">
          <caption className="sr-only">Comparación de los planes Básico y Pro</caption>
          <thead>
            <tr>
              <th scope="col" className={`w-1/3 pt-6 pr-4 pb-4 align-top ${encabezado} ${fondo}`}>
                <span className="font-display text-3xl">Funciones</span>
              </th>
              {comparados.map((plan) => (
                <th
                  key={plan.nombre}
                  scope="col"
                  className={`w-1/3 px-6 pt-6 pb-4 align-top ${encabezado} ${
                    plan.popular
                      ? `rounded-t-2xl ${fijo ? `${fondo} ${fondoPro}` : columnaPro}`
                      : fondo
                  }`}
                >
                  <span className="flex items-center justify-between gap-3">
                    <span className="font-display text-3xl">{plan.nombre}</span>
                    {plan.popular ? (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-accent px-3 py-1 font-display text-sm font-semibold whitespace-nowrap text-on-accent">
                        <Icon name="check" size={15} strokeWidth={2.6} />
                        Más popular
                      </span>
                    ) : null}
                  </span>
                  <span className="mt-1 block font-display text-lg font-semibold text-text">
                    {anual ? plan.precio.anual : plan.precio.mensual}
                    <span className="text-sm font-normal text-muted"> / mes</span>
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          {comparacion.map(({ grupo, filas }) => (
            <tbody key={grupo}>
              <tr>
                <th
                  scope="colgroup"
                  className="pt-10 pr-4 pb-3 font-display text-base tracking-[0.15em] text-accent-ink uppercase"
                >
                  {grupo}
                </th>
                <td />
                <td className={columnaPro} />
              </tr>
              {filas.map((fila) => (
                <tr
                  key={fila.label}
                  className="border-t border-line2 transition-colors hover:bg-surface/60"
                >
                  <th scope="row" className="py-5 pr-4 text-sm font-medium text-text2">
                    {fila.label}
                  </th>
                  {fila.valores.map((valor, indice) => (
                    <td
                      key={comparados[indice].nombre}
                      className={`px-6 py-5 ${comparados[indice].popular ? columnaPro : ''}`}
                    >
                      <Valor valor={valor} destacado={comparados[indice].popular} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          ))}
          <tfoot>
            <tr className="border-t border-line2">
              <td className="py-8" />
              {comparados.map((plan) => {
                const tono = tonos[plan.tono ?? 'basico']
                const clases = `flex w-full items-center justify-center gap-2 rounded-full px-5 py-3 text-base font-semibold whitespace-nowrap transition ${tono.boton}`
                return (
                  <td
                    key={plan.nombre}
                    className={`px-6 py-8 ${plan.popular ? `rounded-b-2xl ${columnaPro}` : ''}`}
                  >
                    {plan.accion.to ? (
                      <Link to={plan.accion.to} className={clases}>
                        {plan.accion.label}
                      </Link>
                    ) : (
                      <a href={plan.accion.href} className={clases}>
                        {plan.accion.label}
                      </a>
                    )}
                  </td>
                )
              })}
            </tr>
          </tfoot>
        </table>
      </div>
    </section>
  )
}

const preguntas = [
  {
    pregunta: '¿Qué tipo de video sirve?',
    respuesta:
      'Un video del partido grabado desde el fondo de la pista, con la cancha completa en cuadro. Sirve un celular en un trípode, y acepta archivos subidos o un link de YouTube.',
  },
  {
    pregunta: '¿Cuánto tarda el análisis?',
    respuesta:
      'Depende de la duración y la resolución del video. Verás el avance en la cola de procesamiento y recibirás un aviso cuando el reporte esté listo.',
  },
  {
    pregunta: '¿Qué tan precisas son las velocidades?',
    respuesta:
      'Son estimaciones calculadas a partir del video, no mediciones de radar. Sirven para comparar saques entre sí y seguir la evolución de un jugador, no como dato oficial.',
  },
  {
    pregunta: '¿Puedo analizar a los dos jugadores del partido?',
    respuesta:
      'Sí. Cada análisis saca las estadísticas de ambos jugadores del mismo video, sin tener que subirlo dos veces.',
  },
  {
    pregunta: '¿Puedo cancelar cuando quiera?',
    respuesta:
      'Sí. El plan se cancela desde Configuración y sigue activo hasta el final del periodo ya pagado, sin penalidad.',
  },
]

function Preguntas() {
  const [abierta, setAbierta] = useState(0)

  return (
    <section className="relative mt-40 overflow-hidden rounded-t-[48px] border-t border-line2 bg-surface pt-28 sm:rounded-t-[64px]">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage: 'radial-gradient(var(--line2) 1px, transparent 1px)',
          backgroundSize: '22px 22px',
          maskImage: 'linear-gradient(to bottom, black, transparent 70%)',
        }}
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-40 left-1/2 h-80 w-[60rem] max-w-full -translate-x-1/2 rounded-full bg-accent/5 blur-3xl"
      />
      <div className="relative mx-auto max-w-3xl px-6">
        <h2 className="text-center text-4xl sm:text-5xl">Preguntas frecuentes</h2>
        <ul className="mt-14 divide-y divide-line2 border-y border-line2">
          {preguntas.map(({ pregunta, respuesta }, indice) => {
            const abiertaAhora = abierta === indice
            return (
              <li key={pregunta}>
                <h3>
                  <button
                    type="button"
                    aria-expanded={abiertaAhora}
                    aria-controls={`respuesta-${indice}`}
                    onClick={() => setAbierta(abiertaAhora ? null : indice)}
                    className="group flex w-full items-center justify-between gap-6 py-6 text-left font-sans text-lg font-medium text-text"
                  >
                    {pregunta}
                    <span
                      className={`shrink-0 text-accent-ink transition-transform duration-300 ${
                        abiertaAhora ? '' : 'rotate-45'
                      }`}
                    >
                      <Icon name="close" size={22} strokeWidth={2.4} />
                    </span>
                  </button>
                </h3>
                <div
                  id={`respuesta-${indice}`}
                  className={`grid transition-[grid-template-rows] duration-300 ease-out ${
                    abiertaAhora ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
                  }`}
                >
                  <p className="overflow-hidden pr-12 text-lg leading-relaxed text-muted">
                    <span className="block pb-6">{respuesta}</span>
                  </p>
                </div>
              </li>
            )
          })}
        </ul>
      </div>
      <FooterGrande />
    </section>
  )
}

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
    <div className="relative overflow-clip pt-6">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage: 'radial-gradient(var(--line2) 1px, transparent 1px)',
          backgroundSize: '22px 22px',
          maskImage: 'radial-gradient(ellipse 70% 60% at 50% 30%, black, transparent 80%)',
        }}
      />

      <div className="relative mx-auto max-w-6xl px-6">
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
            Tú eliges cómo
            <br />
            medir tu juego
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

        <Comparar anual={anual} />
      </div>

      <Preguntas />
    </div>
  )
}
