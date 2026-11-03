import Button from '../../components/Button.jsx'
import Reveal from '../../components/Reveal.jsx'

export default function CierreFinal() {
  return (
    <section className="relative px-6 py-20 sm:py-28">
      <Reveal className="mx-auto max-w-3xl text-center">
        <h2 className="text-3xl sm:text-5xl">
          El próximo partido ya puede darte datos en vez de dudas
        </h2>
        <p className="mt-5 text-lg text-text2">
          Sube un video y mira el reporte completo antes de decidir si AceCam es para tu equipo.
        </p>
        <div className="mt-8 flex justify-center">
          <Button to="/registro" size="lg">
            Prueba gratis tu primer análisis
          </Button>
        </div>
      </Reveal>
    </section>
  )
}
