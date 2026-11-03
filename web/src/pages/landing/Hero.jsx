import Button from '../../components/Button.jsx'
import Icon from '../../components/Icon.jsx'
import HeroMock from './HeroMock.jsx'
import HeroTiles from './HeroTiles.jsx'

function CourtLines() {
  return (
    <svg
      viewBox="0 0 1200 640"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      aria-hidden="true"
      className="pointer-events-none absolute top-6 left-1/2 w-[1200px] max-w-none -translate-x-1/2 text-line"
    >
      <rect x="40" y="40" width="1120" height="560" />
      <path d="M40 110h1120M40 530h1120M320 110v420M880 110v420M320 320h560" />
      <path d="M600 20v600" strokeDasharray="6 8" />
    </svg>
  )
}

export default function Hero() {
  return (
    <section className="relative overflow-hidden px-6 pt-14 sm:pt-24">
      <CourtLines />

      <div className="relative mx-auto max-w-6xl">
        <HeroTiles />

        <div className="relative z-20 mx-auto max-w-3xl text-center">
          <p className="inline-flex items-center gap-2 rounded-full border border-line2 bg-surface py-1 pr-4 pl-1 text-sm text-text2">
            <span className="rounded-full bg-accent px-3 py-0.5 font-semibold text-on-accent">
              Nuevo
            </span>
            Analiza desde un link de YouTube
          </p>

          <h1 className="mt-6 text-5xl sm:text-6xl lg:text-7xl">
            Convierte cualquier partido en{' '}
            <span className="rounded-2xl bg-accent px-2.5 whitespace-nowrap text-on-accent">
              estadísticas
            </span>{' '}
            de nivel profesional
          </h1>

          <p className="mx-auto mt-6 max-w-xl text-lg text-text2 sm:text-xl">
            Sube un video o pega un link de YouTube. AceCam mide saques, golpes y movimiento por ti.
          </p>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Button to="/registro" size="lg">
              <span className="size-1.5 rounded-full bg-on-accent" />
              Prueba gratis tu primer análisis
            </Button>
            <Button href="#funciones" variant="secondary" size="lg">
              <Icon name="play" size={18} />
              Ver demo
            </Button>
          </div>
        </div>

        <div className="relative z-20 mt-14 sm:mt-20">
          <HeroMock />
        </div>
      </div>

      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-30 h-48 bg-linear-to-t from-bg to-transparent" />
    </section>
  )
}
