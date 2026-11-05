import Button from '../../compartido/components/Button.jsx'
import Icon from '../components/Icon.jsx'
import Logo from '../../compartido/components/Logo.jsx'
import MetalPill from '../components/MetalPill.jsx'
import { useTextos } from '../../compartido/lib/idioma.jsx'
import HeroMock from './HeroMock.jsx'
import HeroTiles from './HeroTiles.jsx'

function CourtLinesMovil() {
  return (
    <svg
      viewBox="0 0 640 1200"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.2"
      preserveAspectRatio="none"
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 size-full text-electric opacity-55 lg:hidden"
    >
      <rect x="1" y="1" width="638" height="1198" vectorEffect="non-scaling-stroke" />
      <path d="M70 1v1198M570 1v1198" vectorEffect="non-scaling-stroke" />
      <path
        d="M70 300h500M70 900h500M320 300v600M1 600h638"
        opacity="0.35"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  )
}

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

const textos = {
  es: {
    nuevo: 'Nuevo',
    pastilla: 'Analiza desde un link de YouTube',
    antes: 'Convierte cualquier partido en',
    resaltado: 'estadísticas',
    despues: 'a nivel profesional',
    lead: 'Solo sube un video o un link de YouTube. AceCam lo analiza por ti.',
    empezar: 'Empieza gratis',
    demo: 'Ver demo',
  },
  en: {
    nuevo: 'New',
    pastilla: 'Analyze from a YouTube link',
    antes: 'Turn any match into pro-level',
    resaltado: 'stats',
    despues: '',
    lead: 'Just upload a video or a YouTube link. AceCam analyzes it for you.',
    empezar: 'Start free',
    demo: 'Watch demo',
  },
}

export default function Hero() {
  const t = useTextos(textos)
  return (
    <section className="relative overflow-hidden px-5 pt-[calc(env(safe-area-inset-top)+4.25rem)] sm:px-6 sm:pt-10">
      <div className="relative mx-auto max-w-6xl">
        <div className="flex flex-col items-center gap-4 lg:grid lg:grid-cols-[1fr_auto_1fr] lg:gap-0">
          <Logo size={52} wordmarkClassName="text-4xl" className="gap-3" rebota />
          <MetalPill badge={t.nuevo}>{t.pastilla}</MetalPill>
        </div>

        <div
          data-rally-start
          className="relative mt-4 flex flex-col justify-center lg:h-[calc(100dvh-19rem)] lg:max-h-[38rem] lg:min-h-[22rem]"
        >
          <CourtLines />
          <CourtLinesMovil />
          <HeroTiles />

          <div className="relative z-20 mx-auto max-w-3xl px-7 py-12 text-center sm:px-0 sm:py-6">
            <h1 className="text-[2.35rem] leading-[1.12] sm:text-6xl lg:text-[clamp(3.5rem,8vh,4.5rem)]">
              {t.antes}{' '}
              <span className="rounded-2xl bg-accent px-2.5 whitespace-nowrap text-on-accent">
                {t.resaltado}
              </span>{' '}
              {t.despues}
            </h1>

            <p className="mx-auto mt-4 max-w-2xl text-base leading-relaxed text-text2 sm:mt-5 sm:text-xl">
              {t.lead}
            </p>

            <div className="mt-6 flex flex-col items-center gap-3 sm:mt-7 sm:gap-4">
              <Button to="/precios" desliza size="lg" data-nav-cta>
                <span className="size-1.5 rounded-full bg-on-accent" />
                {t.empezar}
              </Button>
              <a
                href="#video-demo"
                className="group inline-flex items-center gap-2.5 rounded-full py-1 pr-3 pl-1 text-sm font-medium text-text2 transition-colors hover:text-text"
              >
                <span className="grid size-8 place-content-center rounded-full border border-line2 bg-surface text-text transition-colors group-hover:border-accent-line group-hover:text-accent-ink">
                  <Icon name="play" size={13} strokeWidth={2.2} />
                </span>
                {t.demo}
              </a>
            </div>
          </div>
        </div>

        <div className="relative z-20 mx-auto mt-6 max-w-5xl sm:mt-8">
          <HeroMock />
          <div className="pointer-events-none absolute -inset-x-1 bottom-0 h-16 bg-linear-to-t from-bg to-transparent sm:h-36" />
        </div>
      </div>
    </section>
  )
}
