import { useEffect, useRef, useState } from 'react'
import Icon from '../components/Icon.jsx'
import { useAterrizaje } from '../../compartido/hooks/useAterrizaje.js'
import LinkDeslizante from '../../compartido/components/LinkDeslizante.jsx'
import FooterGrande from '../components/FooterGrande.jsx'
import Logo from '../../compartido/components/Logo.jsx'
import { useTextos } from '../../compartido/lib/idioma.jsx'
import { inclinar } from '../lib/inclinar.js'

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

const textos = {
  es: {
    planes: [
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
        accion: { label: 'Prueba gratis', to: '/checkout?plan=basico' },
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
        accion: { label: 'Empieza ahora', to: '/checkout?plan=pro' },
      },
      {
        nombre: 'Ultra',
        para: 'Para academias, clubes y universidades',
        precio: { mensual: '[PRECIO]', anual: '[PRECIO]' },
        detalle: 'por mes',
        tono: 'ultra',
        base: 'Todo lo de Pro, más:',
        incluye: ['Muchos más jugadores', 'Muchos más análisis', 'Soporte dedicado'],
        accion: { label: 'Empieza ahora', to: '/checkout?plan=ultra' },
      },
    ],
    comparacion: [
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
    ],
    preguntas: [
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
    ],
    volver: 'AceCam, volver al inicio',
    titulo: 'Elige tu plan,',
    tituloFin: 'nosotros medimos el resto',
    pruebaAntes: 'Prueba',
    pruebaDespues: 'gratis durante un mes con el plan Básico.',
    mensual: 'Mensual',
    anual: 'Anual',
    elegirPlan: 'Elige un plan',
    paraCorto: ['Jugadores', 'Entrenadores', 'Clubes'],
    pagoAnual: 'Periodo de pago',
    mes: 'mes',
    meses: 'meses',
    popular: 'Más popular',
    facturado: ', facturado al año',
    comparar: 'Compara nuestros planes',
    resumen: 'Comparación de los planes Básico y Pro',
    funciones: 'Funciones',
    porMes: '/ mes',
    si: 'Sí',
    no: 'No',
    faq: 'Preguntas frecuentes',
  },
  en: {
    planes: [
      {
        nombre: 'Basic',
        para: 'For players and parents',
        precio: { mensual: '[PRICE]', anual: '[PRICE]' },
        detalle: 'per month',
        prueba: {
          titulo: '1-month free trial',
          limites: ['Up to 2 players', '15 analyses that month', 'YouTube videos only'],
        },
        base: 'With the full plan:',
        incluye: [
          'Up to 2 players',
          '30 analyses per month',
          'Full dashboard per player',
          'Your own videos or YouTube',
          'PDF report',
        ],
        accion: { label: 'Free trial', to: '/checkout?plan=basico' },
      },
      {
        nombre: 'Pro',
        para: 'For coaches and recruiters',
        precio: { mensual: '[PRICE]', anual: '[PRICE]' },
        detalle: 'per month',
        popular: true,
        tono: 'pro',
        base: 'Everything in Basic, plus:',
        incluye: [
          '150 analyses per month',
          'Up to 24 players',
          'Compare up to 4 players',
          'Panel for your whole team',
          'Recruiting inbox',
          'Priority support',
        ],
        accion: { label: 'Start now', to: '/checkout?plan=pro' },
      },
      {
        nombre: 'Ultra',
        para: 'For academies, clubs and universities',
        precio: { mensual: '[PRICE]', anual: '[PRICE]' },
        detalle: 'per month',
        tono: 'ultra',
        base: 'Everything in Pro, plus:',
        incluye: ['Many more players', 'Many more analyses', 'Dedicated support'],
        accion: { label: 'Start now', to: '/checkout?plan=ultra' },
      },
    ],
    comparacion: [
      {
        grupo: 'Usage',
        filas: [
          { label: '1-month free trial', valores: [true, false] },
          { label: 'Players', valores: ['Up to 2', 'Up to 24'] },
          { label: 'Analyses per month', valores: ['30', '150'] },
        ],
      },
      {
        grupo: 'Analysis',
        filas: [
          { label: 'Your own videos', valores: [true, true] },
          { label: 'YouTube videos', valores: [true, true] },
          { label: 'Dashboard per player', valores: [true, true] },
          { label: 'PDF report', valores: [true, true] },
        ],
      },
      {
        grupo: 'Team and recruiting',
        filas: [
          { label: 'Compare up to 4 players', valores: [false, true] },
          { label: 'Panel for your whole team', valores: [false, true] },
          { label: 'Recruiting inbox', valores: [false, true] },
          { label: 'Priority support', valores: [false, true] },
        ],
      },
    ],
    preguntas: [
      {
        pregunta: 'What kind of video works?',
        respuesta:
          'A match video recorded from behind the baseline, with the whole court in frame. A phone on a tripod works, and you can upload files or paste a YouTube link.',
      },
      {
        pregunta: 'How long does the analysis take?',
        respuesta:
          'It depends on the length and resolution of the video. You’ll see the progress in the processing queue and get a notice when the report is ready.',
      },
      {
        pregunta: 'How accurate are the speeds?',
        respuesta:
          'They are estimates calculated from the video, not radar measurements. They’re useful to compare serves with each other and track a player’s progress, not as official data.',
      },
      {
        pregunta: 'Can I analyze both players in the match?',
        respuesta:
          'Yes. Each analysis pulls the stats for both players from the same video, without uploading it twice.',
      },
      {
        pregunta: 'Can I cancel anytime?',
        respuesta:
          'Yes. You can cancel the plan from Settings and it stays active until the end of the period you already paid for, with no penalty.',
      },
    ],
    volver: 'AceCam, back to home',
    titulo: 'Pick your plan,',
    tituloFin: 'we measure the rest',
    pruebaAntes: 'Try',
    pruebaDespues: 'free for a month with the Basic plan.',
    mensual: 'Monthly',
    anual: 'Yearly',
    elegirPlan: 'Choose a plan',
    paraCorto: ['Players', 'Coaches', 'Clubs'],
    pagoAnual: 'Billing period',
    mes: 'month',
    meses: 'months',
    popular: 'Most popular',
    facturado: ', billed yearly',
    comparar: 'Compare our plans',
    resumen: 'Comparison of the Basic and Pro plans',
    funciones: 'Features',
    porMes: '/ month',
    si: 'Yes',
    no: 'No',
    faq: 'Frequently asked questions',
  },
}

const columnaPro = 'bg-accent/8'
const encabezado = 'sticky top-0 z-10 shadow-[0_1px_0_var(--line3)]'
const fondoPro = 'bg-linear-to-b from-accent/8 to-accent/8'

function Valor({ valor, destacado, t }) {
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
        <span className="sr-only">{t.si}</span>
      </span>
    )
  }
  return (
    <span className="inline-block h-0.5 w-4 rounded-full bg-muted align-middle">
      <span className="sr-only">{t.no}</span>
    </span>
  )
}

function Comparar({ anual }) {
  const t = useTextos(textos)
  const comparados = t.planes.slice(0, 2)
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
    <section className="mx-auto mt-24 max-w-5xl sm:mt-44">
      <h2 className="text-center text-4xl sm:text-5xl">{t.comparar}</h2>

      <div ref={marcaRef} aria-hidden="true" className="mt-8 h-px sm:mt-12" />
      <div>
        <table className="w-full table-fixed border-collapse text-left sm:table-auto">
          <caption className="sr-only">{t.resumen}</caption>
          <thead>
            <tr>
              <th
                scope="col"
                className={`w-[38%] pt-4 pr-2 pb-3 align-top sm:w-1/3 sm:pt-6 sm:pr-4 sm:pb-4 ${encabezado} ${fondo}`}
              >
                <span className="font-display text-xl sm:text-3xl">{t.funciones}</span>
              </th>
              {comparados.map((plan) => (
                <th
                  key={plan.nombre}
                  scope="col"
                  className={`w-[31%] px-2 pt-4 pb-3 align-top sm:w-1/3 sm:px-6 sm:pt-6 sm:pb-4 ${encabezado} ${
                    plan.popular
                      ? `rounded-t-2xl ${fijo ? `${fondo} ${fondoPro}` : columnaPro}`
                      : fondo
                  }`}
                >
                  <span className="flex items-center justify-between gap-3">
                    <span className="font-display text-xl sm:text-3xl">{plan.nombre}</span>
                    {plan.popular ? (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-accent px-3 py-1 font-display text-sm font-semibold whitespace-nowrap text-on-accent max-sm:hidden">
                        <Icon name="check" size={15} strokeWidth={2.6} />
                        {t.popular}
                      </span>
                    ) : null}
                  </span>
                  <span className="mt-1 block font-display text-sm font-semibold break-words text-text sm:text-lg">
                    {anual ? plan.precio.anual : plan.precio.mensual}
                    <span className="text-xs font-normal text-muted sm:text-sm"> {t.porMes}</span>
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          {t.comparacion.map(({ grupo, filas }) => (
            <tbody key={grupo}>
              <tr>
                <th
                  scope="colgroup"
                  className="pt-8 pr-2 pb-3 font-display text-sm tracking-[0.12em] text-accent-ink uppercase sm:pt-10 sm:pr-4 sm:text-base sm:tracking-[0.15em]"
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
                  <th
                    scope="row"
                    className="py-3.5 pr-2 text-[13px] leading-snug font-medium text-text2 sm:py-5 sm:pr-4 sm:text-sm"
                  >
                    {fila.label}
                  </th>
                  {fila.valores.map((valor, indice) => (
                    <td
                      key={comparados[indice].nombre}
                      className={`px-2 py-3.5 sm:px-6 sm:py-5 ${comparados[indice].popular ? columnaPro : ''}`}
                    >
                      <Valor valor={valor} destacado={comparados[indice].popular} t={t} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          ))}
          <tfoot>
            <tr className="border-t border-line2">
              <td className="py-5 sm:py-8" />
              {comparados.map((plan) => {
                const tono = tonos[plan.tono ?? 'basico']
                const clases = `flex w-full items-center justify-center gap-2 rounded-full px-2 py-2.5 text-center text-[13px] leading-tight font-semibold transition sm:px-5 sm:py-3 sm:text-base sm:whitespace-nowrap ${tono.boton}`
                return (
                  <td
                    key={plan.nombre}
                    className={`px-1.5 py-5 sm:px-6 sm:py-8 ${plan.popular ? `rounded-b-2xl ${columnaPro}` : ''}`}
                  >
                    <LinkDeslizante
                      to={`${plan.accion.to}${anual ? '&ciclo=anual' : ''}`}
                      className={clases}
                    >
                      {plan.accion.label}
                    </LinkDeslizante>
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

const gradas = [
  { ancho: 'w-[70%]', alto: 'h-6', opacidad: 'opacity-40', personas: 34 },
  { ancho: 'w-[80%]', alto: 'h-7', opacidad: 'opacity-65', personas: 40 },
  { ancho: 'w-[90%]', alto: 'h-8', opacidad: 'opacity-90', personas: 46 },
]

const ropa = [
  'bg-line3',
  'bg-faint',
  'bg-series2/60',
  'bg-muted/50',
  'bg-series1/55',
  'bg-line3',
  'bg-series4/55',
  'bg-faint',
  'bg-series3/60',
]

function Publico({ fila, personas }) {
  return (
    <span className="absolute inset-x-6 bottom-0 flex items-end justify-between">
      {Array.from({ length: personas }, (_, indice) => {
        const hincha = (indice * 13 + fila * 5) % 17 === 0
        const color = hincha ? 'bg-accent/80' : ropa[(indice * 7 + fila * 3) % ropa.length]
        const alto = (indice * 5 + fila) % 3
        return (
          <span
            key={indice}
            className="flex flex-col items-center"
            style={{ marginBottom: `${-alto}px` }}
          >
            <span className="size-2 rounded-full bg-text2/40" />
            <span className={`mt-px h-2.5 w-3.5 rounded-t-full ${color}`} />
          </span>
        )
      })}
    </span>
  )
}

const lineasCancha =
  'M20 780L980 780M322.1 20L677.9 20M20 780L322.1 20M980 780L677.9 20M139.9 780L366.5 20M860.1 780L633.5 20M241.3 440.1L758.7 440.1M343.8 96L656.2 96M500 440.1L500 96M500 780L500 754.7M500 20L500 23.6'

function CanchaPerspectiva() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 1000 800"
      preserveAspectRatio="none"
      fill="none"
      className="pointer-events-none absolute top-6 left-1/2 h-[46rem] w-[min(72rem,100%)] -translate-x-1/2"
      style={{
        maskImage:
          'linear-gradient(to bottom, transparent 2%, black 35%, black 70%, transparent 100%)',
      }}
    >
      <path
        d={lineasCancha}
        stroke="var(--line3)"
        strokeWidth="1.5"
        opacity="0.9"
        vectorEffect="non-scaling-stroke"
      />
      <path
        d="M210 206V225.5 M222 206V225.5 M234 206V225.5 M246 206V225.5 M258 206V225.5 M270 206V225.5 M282 206V225.5 M294 206V225.5 M306 206V225.5 M318 206V225.5 M330 206V225.5 M342 206V225.5 M354 206V225.5 M366 206V225.5 M378 206V225.5 M390 206V225.5 M402 206V225.5 M414 206V225.5 M426 206V225.5 M438 206V225.5 M450 206V225.5 M462 206V225.5 M474 206V225.5 M486 206V225.5 M498 206V225.5 M510 206V225.5 M522 206V225.5 M534 206V225.5 M546 206V225.5 M558 206V225.5 M570 206V225.5 M582 206V225.5 M594 206V225.5 M606 206V225.5 M618 206V225.5 M630 206V225.5 M642 206V225.5 M654 206V225.5 M666 206V225.5 M678 206V225.5 M690 206V225.5 M702 206V225.5 M714 206V225.5 M726 206V225.5 M738 206V225.5 M750 206V225.5 M762 206V225.5 M774 206V225.5 M786 206V225.5 M798 206V225.5 M197.8 212.5H802.2M197.8 219H802.2"
        stroke="var(--line3)"
        strokeWidth="1"
        opacity="0.45"
        vectorEffect="non-scaling-stroke"
      />
      <path
        d="M197.8 205H802.2M197.8 225.5V203M802.2 225.5V203"
        stroke="var(--text2)"
        strokeWidth="2"
        opacity="0.3"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  )
}

function useColorBarra(referencia) {
  useEffect(() => {
    const meta = document.querySelector('meta[name="theme-color"]')
    const elemento = referencia.current
    if (!meta || !elemento) return undefined
    const original = meta.getAttribute('content')
    const observador = new IntersectionObserver(
      ([entrada]) => {
        const estilos = getComputedStyle(document.documentElement)
        const color = estilos.getPropertyValue(entrada.isIntersecting ? '--surface' : '--bg').trim()
        if (color) meta.setAttribute('content', color)
      },
      { rootMargin: '-98% 0px 0px 0px' },
    )
    observador.observe(elemento)
    return () => {
      observador.disconnect()
      meta.setAttribute('content', original)
    }
  }, [referencia])
}

function Preguntas() {
  const t = useTextos(textos)
  const [abierta, setAbierta] = useState(0)
  const seccion = useRef(null)
  useColorBarra(seccion)

  return (
    <>
      <div aria-hidden="true" className="mt-24 flex flex-col items-center gap-1.5 sm:mt-40">
        {gradas.map(({ ancho, alto, opacidad, personas }, fila) => (
          <span
            key={ancho}
            className={`relative block overflow-hidden rounded-t-[40px] border-t border-line2 bg-surface ${ancho} ${alto} ${opacidad}`}
          >
            <Publico fila={fila} personas={personas} />
          </span>
        ))}
      </div>
      <section
        ref={seccion}
        className="relative mt-1.5 overflow-hidden rounded-t-[48px] border-t border-line2 bg-surface pt-16 sm:rounded-t-[64px] sm:pt-28"
      >
        <div
          aria-hidden="true"
          className="puntos pointer-events-none absolute inset-0"
          style={{ maskImage: 'linear-gradient(to bottom, black, transparent 70%)' }}
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-40 left-1/2 h-80 w-[60rem] max-w-full -translate-x-1/2 rounded-full bg-accent/5 blur-3xl"
        />
        <CanchaPerspectiva />
        <div className="relative mx-auto max-w-3xl px-5 sm:px-6">
          <h2 className="text-center text-4xl sm:text-5xl">{t.faq}</h2>
          <ul className="mt-8 divide-y sm:mt-14 divide-line2 border-y border-line2">
            {t.preguntas.map(({ pregunta, respuesta }, indice) => {
              const abiertaAhora = abierta === indice
              return (
                <li key={pregunta}>
                  <h3>
                    <button
                      type="button"
                      aria-expanded={abiertaAhora}
                      aria-controls={`respuesta-${indice}`}
                      onClick={() => setAbierta(abiertaAhora ? null : indice)}
                      className="group flex w-full items-center justify-between gap-4 py-5 text-left font-sans text-base font-medium text-text sm:gap-6 sm:py-6 sm:text-lg"
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
                    <p className="overflow-hidden pr-6 text-base leading-relaxed text-muted sm:pr-12 sm:text-lg">
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
    </>
  )
}

function Lado({ activo, onElegir, children }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={activo}
      onClick={onElegir}
      className={`flex cursor-pointer items-center gap-2 self-stretch rounded-xl px-4 font-display text-sm font-semibold tracking-[0.18em] uppercase transition-colors ${
        activo
          ? 'bg-accent/12 text-text ring-1 ring-accent-line/50'
          : 'text-muted hover:bg-surface hover:text-text'
      }`}
    >
      <span
        aria-hidden="true"
        className={`size-2 rounded-full transition-colors ${activo ? 'bg-accent' : 'bg-line3'}`}
      />
      {children}
    </button>
  )
}

function Periodo({ anual, onElegir }) {
  const t = useTextos(textos)
  const digitos = anual ? ['1', '2'] : ['0', '1']

  return (
    <div
      role="radiogroup"
      aria-label={t.pagoAnual}
      className="mx-auto mt-10 inline-flex items-center gap-1.5 rounded-2xl border border-line2 bg-surface2 p-1.5 shadow-tile"
    >
      <Lado activo={!anual} onElegir={() => onElegir(false)}>
        {t.mensual}
      </Lado>
      <span
        aria-hidden="true"
        className="flex flex-col items-center gap-1 rounded-xl bg-bg px-2.5 pt-2 pb-1.5"
      >
        <span className="flex gap-1 [perspective:300px]">
          {digitos.map((digito, indice) => (
            <span
              key={`${indice}-${digito}`}
              style={{ animationDelay: `${indice * 90}ms` }}
              className="relative grid h-11 w-8 place-content-center overflow-hidden rounded-md bg-surface font-display text-3xl leading-none font-bold text-accent-ink tabular-nums motion-safe:animate-voltear"
            >
              {digito}
              <span className="absolute inset-x-0 top-1/2 h-px bg-bg" />
            </span>
          ))}
        </span>
        <span className="font-display text-[10px] tracking-[0.2em] text-muted uppercase">
          {anual ? t.meses : t.mes}
        </span>
      </span>
      <Lado activo={anual} onElegir={() => onElegir(true)}>
        {t.anual}
      </Lado>
    </div>
  )
}

function Plan({ plan, anual, oculto = false }) {
  const t = useTextos(textos)
  const tono = tonos[plan.tono ?? 'basico']
  const boton = `mt-8 inline-flex w-full items-center justify-center gap-2 rounded-full px-5 py-3 font-semibold transition ${tono.boton}`

  const inclinacion = inclinar(
    (tarjeta, x, y) => {
      tarjeta.style.transform = `perspective(900px) rotateX(${-y * INCLINACION}deg) rotateY(${
        x * INCLINACION
      }deg) translateY(-6px)`
    },
    (tarjeta) => {
      tarjeta.style.transform = ''
    },
  )

  return (
    <article
      {...inclinacion}
      className={`relative flex flex-col rounded-[24px] border bg-surface p-6 shadow-tile sm:p-7 ${oculto ? 'max-md:hidden' : ''} transition-[transform,border-color,box-shadow] duration-300 ease-out will-change-transform hover:ring-1 ${tono.tarjeta}`}
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
          {t.popular}
        </span>
      ) : null}

      <h2 className="text-2xl">{plan.nombre}</h2>
      <p className="mt-1 text-sm text-muted">{plan.para}</p>

      <p className="mt-8 font-display text-4xl font-semibold">
        {anual ? plan.precio.anual : plan.precio.mensual}
      </p>
      <p className="mt-1 text-sm text-muted">
        {plan.detalle}
        {anual ? t.facturado : ''}
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
        <LinkDeslizante to={`${plan.accion.to}${anual ? '&ciclo=anual' : ''}`} className={boton}>
          {plan.accion.label}
          <Icon name="arrow" size={18} strokeWidth={2.2} />
        </LinkDeslizante>
      </div>
    </article>
  )
}

export default function Precios() {
  const aterrizaje = useAterrizaje()
  const t = useTextos(textos)
  const [anual, setAnual] = useState(false)
  const [elegido, setElegido] = useState(1)

  return (
    <div className="precios-pagina relative overflow-clip bg-bg pt-[calc(env(safe-area-inset-top)+4.75rem)] sm:pt-6">
      <div
        aria-hidden="true"
        className="puntos pointer-events-none absolute inset-0"
        style={{ maskImage: 'radial-gradient(ellipse 70% 60% at 50% 30%, black, transparent 80%)' }}
      />

      <div className="relative mx-auto max-w-6xl px-5 sm:px-6">
        <LinkDeslizante
          to="/"
          sentido="atras"
          aria-label={t.volver}
          {...aterrizaje}
          className="group inline-flex items-center gap-3 rounded-md"
        >
          <span className="inline-flex size-9 items-center justify-center rounded-full border-2 border-line3 text-text2 ring-text transition-[translate,border-color,color,box-shadow] duration-300 group-hover:-translate-x-1 group-hover:border-text group-hover:text-text group-hover:ring-1">
            <Icon name="arrowBack" size={17} strokeWidth={2.4} />
          </span>
          <Logo size={56} wordmarkClassName="text-4xl" className="max-sm:[&_svg]:size-11" rebota />
        </LinkDeslizante>

        <header className="mt-10 text-center sm:mt-16">
          <h1 className="mx-auto max-w-2xl text-4xl sm:text-6xl">
            {t.titulo}
            <br />
            {t.tituloFin}
          </h1>
          <p className="mx-auto mt-4 max-w-md text-base text-text2 sm:text-lg">
            {t.pruebaAntes} <span className="text-accent-ink">AceCam</span> {t.pruebaDespues}
          </p>
          <Periodo anual={anual} onElegir={setAnual} />
        </header>

        <div
          role="tablist"
          aria-label={t.elegirPlan}
          className="mx-auto mt-8 grid max-w-sm grid-cols-3 gap-1 rounded-2xl border border-line2 bg-surface2 p-1.5 shadow-tile md:hidden"
        >
          {t.planes.map((plan, indice) => (
            <button
              key={plan.nombre}
              type="button"
              role="tab"
              aria-selected={indice === elegido}
              onClick={() => setElegido(indice)}
              className="relative flex cursor-pointer flex-col items-center gap-0.5 rounded-xl px-1 py-2.5 text-muted transition-colors aria-selected:bg-accent/12 aria-selected:text-text aria-selected:ring-1 aria-selected:ring-accent-line/50"
            >
              {plan.popular ? (
                <span className="absolute top-1.5 right-1.5 size-1.5 rounded-full bg-accent" />
              ) : null}
              <span className="font-display text-lg leading-none font-semibold">{plan.nombre}</span>
              <span className="text-[11px] leading-tight">{t.paraCorto[indice]}</span>
            </button>
          ))}
        </div>

        <div className="mx-auto mt-8 grid max-w-5xl gap-4 sm:mt-14 sm:gap-5 md:grid-cols-3">
          {t.planes.map((plan, indice) => (
            <Plan key={indice} plan={plan} anual={anual} oculto={indice !== elegido} />
          ))}
        </div>

        <Comparar anual={anual} />
      </div>

      <Preguntas />
    </div>
  )
}
