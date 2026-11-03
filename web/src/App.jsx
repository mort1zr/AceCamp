import ThemeToggle from './components/ThemeToggle.jsx'

const stats = [
  { label: 'Saque más rápido', value: '184', unit: 'km/h', tone: 'text-series1' },
  { label: 'Primeros saques', value: '68', unit: '%', tone: 'text-series2' },
  { label: 'Dobles faltas', value: '4', unit: '', tone: 'text-series3' },
  { label: 'Distancia recorrida', value: '3.2', unit: 'km', tone: 'text-series4' },
]

export default function App() {
  return (
    <div className="min-h-dvh bg-bg text-text">
      <header className="flex items-center justify-between border-b border-line px-6 py-4">
        <span className="font-display text-2xl font-bold tracking-wide">AceCam</span>
        <ThemeToggle />
      </header>

      <main className="mx-auto max-w-5xl px-6 py-12">
        <p className="font-display text-sm font-semibold tracking-[0.2em] text-accent-ink uppercase">
          Base visual
        </p>
        <h1 className="mt-3 text-4xl sm:text-5xl">
          Convierte cualquier partido en estadísticas de nivel profesional
        </h1>
        <p className="mt-4 max-w-2xl text-text2">
          Paleta, tipografías y tema claro/oscuro funcionando. Las pantallas se construyen encima de
          estos tokens.
        </p>

        <div className="mt-10 grid grid-cols-2 gap-4 lg:grid-cols-4">
          {stats.map((stat) => (
            <article key={stat.label} className="rounded-card border border-line bg-surface p-5">
              <p className="text-xs font-medium tracking-wide text-muted uppercase">{stat.label}</p>
              <p className={`mt-2 font-display text-4xl font-bold ${stat.tone}`}>
                {stat.value}
                {stat.unit ? <span className="ml-1 text-xl text-muted">{stat.unit}</span> : null}
              </p>
            </article>
          ))}
        </div>

        <button
          type="button"
          className="mt-10 rounded-full bg-accent px-6 py-3 font-semibold text-on-accent"
        >
          Prueba gratis tu primer análisis
        </button>
      </main>
    </div>
  )
}
