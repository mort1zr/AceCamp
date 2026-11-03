import Button from '../../components/Button.jsx'
import Icon from '../../components/Icon.jsx'
import Logo from '../../components/Logo.jsx'
import MetalPill from '../../components/MetalPill.jsx'
import HeroMock from './HeroMock.jsx'
import HeroTiles from './HeroTiles.jsx'

function CourtLines() {
  return (
    <svg
      viewBox="0 0 1200 640"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      preserveAspectRatio="none"
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 hidden size-full text-electric lg:block"
    >
      <rect x="1" y="1" width="1198" height="638" vectorEffect="non-scaling-stroke" />
      <path d="M1 70h1198M1 570h1198" vectorEffect="non-scaling-stroke" />
      <path
        d="M300 70v500M900 70v500M300 320h600M600 1v638"
        opacity="0.3"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  )
}

export default function Hero() {
  return (
    <section className="relative overflow-hidden px-6 pt-10">
      <div className="relative mx-auto max-w-6xl">
        <div className="flex flex-col items-center gap-4 lg:grid lg:grid-cols-[1fr_auto_1fr] lg:gap-0">
          <Logo size={36} />
          <MetalPill badge="Nuevo">Analiza desde un link de YouTube</MetalPill>
        </div>

        <div data-rally-start className="relative mt-4 flex flex-col justify-center lg:h-[calc(100dvh-19rem)] lg:max-h-[38rem] lg:min-h-[22rem]">
          <CourtLines />
          <HeroTiles />

          <div className="relative z-20 mx-auto max-w-3xl py-6 text-center">
            <h1 className="text-5xl leading-[1.14] sm:text-6xl lg:text-[clamp(3.5rem,8vh,4.5rem)]">
              Convierte cualquier partido en{' '}
              <span className="rounded-2xl bg-accent px-2.5 whitespace-nowrap text-on-accent">
                estadísticas
              </span>{' '}
              a nivel profesional
            </h1>

            <p className="mx-auto mt-5 max-w-2xl text-lg leading-relaxed text-text2 sm:text-xl">
              Solo sube un video o un link de YouTube. AceCam lo analiza por ti.
            </p>

            <div className="mt-7 flex flex-wrap items-center justify-center gap-4">
              <Button to="/registro" size="lg">
                <span className="size-1.5 rounded-full bg-on-accent" />
                Empieza gratis
              </Button>
              <Button href="#funciones" variant="secondary" size="lg">
                <Icon name="play" size={18} />
                Ver demo
              </Button>
            </div>
          </div>
        </div>

        <div className="relative z-20 mx-auto mt-8 max-w-5xl">
          <HeroMock />
          <div className="pointer-events-none absolute -inset-x-1 bottom-0 h-36 bg-linear-to-t from-bg to-transparent" />
        </div>
      </div>
    </section>
  )
}
