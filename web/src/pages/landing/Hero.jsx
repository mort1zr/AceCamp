import AppFrame from '../../components/AppFrame.jsx'
import Button from '../../components/Button.jsx'
import Icon from '../../components/Icon.jsx'
import Reveal from '../../components/Reveal.jsx'

export default function Hero() {
  return (
    <section className="px-6 pt-14 pb-16 sm:pt-20 sm:pb-24">
      <div className="mx-auto grid max-w-6xl items-center gap-12 lg:grid-cols-[1.05fr_1fr]">
        <Reveal>
          <p className="font-display text-xs font-semibold tracking-[0.22em] text-accent-ink uppercase">
            Análisis de tenis con IA
          </p>
          <h1 className="mt-4 text-4xl sm:text-5xl lg:text-6xl">
            Convierte cualquier partido en estadísticas de nivel profesional
          </h1>
          <p className="mt-5 max-w-xl text-lg text-text2">
            Sube un video o pega un link de YouTube. AceCam mide saques, golpes y movimiento por ti.
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Button to="/registro" size="lg">
              Prueba gratis tu primer análisis
            </Button>
            <Button href="#funciones" variant="secondary" size="lg">
              <Icon name="play" size={18} />
              Ver demo
            </Button>
          </div>

          <p className="mt-5 text-sm text-muted">
            Sin tarjeta de crédito · Sin cámaras especiales ni hardware
          </p>
        </Reveal>

        <Reveal delay={120}>
          <AppFrame label="Dashboard del jugador" />
        </Reveal>
      </div>
    </section>
  )
}
