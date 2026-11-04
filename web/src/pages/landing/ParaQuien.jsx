import Card from '../../components/Card.jsx'
import Icon from '../../components/Icon.jsx'
import Reveal from '../../components/Reveal.jsx'
import Section from '../../components/Section.jsx'
import { useTextos } from '../../lib/idioma.jsx'

const comparacion = [
  { a: 82, b: 64 },
  { a: 58, b: 71 },
  { a: 70, b: 52 },
]

const plantel = [
  { iniciales: 'RR', ancho: 'w-20', avance: '+12%' },
  { iniciales: 'MV', ancho: 'w-14', avance: '+8%' },
  { iniciales: 'LP', ancho: 'w-24', avance: '+15%' },
]

function Comparador() {
  const t = useTextos(textos)

  return (
    <div className="w-full space-y-3">
      <div className="flex justify-between font-display text-xs tracking-wide">
        <span className="text-accent-ink">{t.jugadorA}</span>
        <span className="text-electric-ink">{t.jugadorB}</span>
      </div>
      {comparacion.map((fila, indice) => (
        <div key={indice}>
          <p className="mb-1 text-center text-[11px] text-muted">{t.filas[indice]}</p>
          <div className="flex items-center gap-1">
            <span className="flex flex-1 justify-end">
              <span className="h-2 rounded-full bg-accent" style={{ width: `${fila.a}%` }} />
            </span>
            <span className="flex flex-1">
              <span className="h-2 rounded-full bg-electric" style={{ width: `${fila.b}%` }} />
            </span>
          </div>
        </div>
      ))}
    </div>
  )
}

function Plantel() {
  return (
    <ul className="w-full space-y-2.5">
      {plantel.map((jugador) => (
        <li
          key={jugador.iniciales}
          className="flex items-center gap-3 rounded-xl border border-line bg-surface px-3 py-2"
        >
          <span className="inline-flex size-7 items-center justify-center rounded-full bg-chip font-display text-[11px] text-electric-ink">
            {jugador.iniciales}
          </span>
          <span className={`h-2 rounded-full bg-line3 ${jugador.ancho}`} />
          <span className="ml-auto font-display text-xs text-good">{jugador.avance}</span>
        </li>
      ))}
    </ul>
  )
}

function Reporte() {
  return (
    <div className="relative mx-auto w-56 rotate-2 rounded-xl border border-line2 bg-surface p-4 shadow-tile">
      <div className="flex items-center justify-between">
        <span className="h-2.5 w-24 rounded-full bg-text/70" />
        <span className="rounded bg-accent px-2 py-0.5 font-display text-xs text-on-accent">
          PDF
        </span>
      </div>
      <div className="mt-4 grid grid-cols-3 gap-2">
        {['bg-series1/60', 'bg-series2/60', 'bg-series3/60'].map((color) => (
          <span key={color} className={`h-9 rounded-md ${color}`} />
        ))}
      </div>
      <div className="mt-4 space-y-2">
        <span className="block h-2 w-full rounded-full bg-line3" />
        <span className="block h-2 w-4/5 rounded-full bg-line3" />
        <span className="block h-2 w-3/5 rounded-full bg-line3" />
      </div>
    </div>
  )
}

const vistas = [Comparador, Plantel, Reporte]

const textos = {
  es: {
    titulo: '¿Para quién es',
    jugadorA: 'Jugador A',
    jugadorB: 'Jugador B',
    filas: ['Saque', 'Primer saque', 'Recorrido'],
    perfiles: [
      {
        etiqueta: 'Para medir',
        clave: 'Compara hasta 4 jugadores',
        title: 'Entrenadores y reclutadores',
        text: 'Mide a cada jugador con números, no con impresiones, y compara candidatos lado a lado.',
      },
      {
        etiqueta: 'Para gestionar',
        clave: 'Todo tu equipo en un panel',
        title: 'Academias, clubes y universidades',
        text: 'Lleva el seguimiento de todos tus jugadores y partidos en un solo lugar.',
      },
      {
        etiqueta: 'Para destacar',
        clave: 'Reporte listo en PDF',
        title: 'Jugadores y padres',
        text: 'Sube el partido y recibe un reporte listo para compartir con entrenadores o universidades.',
      },
    ],
  },
  en: {
    titulo: 'Who is',
    tituloFin: 'for?',
    jugadorA: 'Player A',
    jugadorB: 'Player B',
    filas: ['Serve', 'First serve', 'Distance'],
    perfiles: [
      {
        etiqueta: 'To measure',
        clave: 'Compare up to 4 players',
        title: 'Coaches and recruiters',
        text: 'Measure every player with numbers, not impressions, and compare candidates side by side.',
      },
      {
        etiqueta: 'To manage',
        clave: 'Your whole team in one panel',
        title: 'Academies, clubs and universities',
        text: 'Track all your players and matches in one place.',
      },
      {
        etiqueta: 'To stand out',
        clave: 'PDF report, ready to go',
        title: 'Players and parents',
        text: 'Upload the match and get a report ready to share with coaches or universities.',
      },
    ],
  },
}

export default function ParaQuien() {
  const t = useTextos(textos)

  return (
    <Section
      title={
        <>
          {t.titulo} <span className="text-accent-ink">AceCam</span>
          {t.tituloFin ? ` ${t.tituloFin}` : '?'}
        </>
      }
      align="center"
    >
      <div className="mt-12 grid gap-4 md:grid-cols-3">
        {t.perfiles.map(({ etiqueta, clave, title, text }, index) => {
          const Vista = vistas[index]
          return (
            <Reveal key={index} delay={index * 90}>
              <Card className="group flex h-full flex-col overflow-hidden ring-line3 transition hover:border-line3 hover:ring-1">
                <div
                  aria-hidden="true"
                  className="flex h-48 items-center border-b border-line bg-surface2 px-8"
                  style={{
                    backgroundImage: 'radial-gradient(var(--line2) 1px, transparent 1px)',
                    backgroundSize: '18px 18px',
                  }}
                >
                  <div className="w-full transition-transform duration-500 ease-out group-hover:-translate-y-2 group-hover:scale-105">
                    <Vista />
                  </div>
                </div>
                <div className="flex flex-1 flex-col p-7">
                  <p className="font-display text-xs tracking-[0.2em] text-electric-ink uppercase">
                    {etiqueta}
                  </p>
                  <h3 className="mt-2 text-2xl">{title}</h3>
                  <p className="mt-2 mb-6 text-text2">{text}</p>
                  <p className="mt-auto flex items-center gap-2 border-t border-line pt-4 text-sm font-medium text-text">
                    <span className="grid size-5 place-content-center rounded-full bg-accent text-on-accent">
                      <Icon name="check" size={13} strokeWidth={2.6} />
                    </span>
                    {clave}
                  </p>
                </div>
              </Card>
            </Reveal>
          )
        })}
      </div>
    </Section>
  )
}
