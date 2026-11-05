import { Link } from 'react-router'
import { useTextos } from '../../compartido/lib/idioma.jsx'
import Icon from '../../landing/components/Icon.jsx'

const textos = {
  es: {
    etiqueta: 'Sin plan',
    titulo: 'Elige un plan para empezar',
    texto:
      'Tu cuenta ya está creada. Activa un plan para analizar partidos, ver el dashboard y seguir a tus jugadores.',
    elegir: (plan) => `Elegir ${plan}`,
    probar: 'Probar gratis',
    popular: 'Más popular',
    prueba: '1 mes gratis',
    mientras: 'Mientras tanto puedes editar los datos de tu cuenta en',
    configuracion: 'Configuración',
    planes: [
      {
        id: 'basico',
        nombre: 'Básico',
        para: 'Para jugadores y padres',
        incluye: ['Hasta 2 jugadores', '30 análisis al mes', 'Reporte en PDF'],
      },
      {
        id: 'pro',
        nombre: 'Pro',
        para: 'Para entrenadores y reclutadores',
        incluye: ['Hasta 24 jugadores', '150 análisis al mes', 'Comparador y reclutamiento'],
        popular: true,
      },
      {
        id: 'ultra',
        nombre: 'Ultra',
        para: 'Para academias, clubes y universidades',
        incluye: ['Muchos más jugadores', 'Muchos más análisis', 'Todo tu cuerpo técnico'],
      },
    ],
  },
  en: {
    etiqueta: 'No plan',
    titulo: 'Choose a plan to get started',
    texto:
      'Your account is ready. Activate a plan to analyze matches, open the dashboard and follow your players.',
    elegir: (plan) => `Choose ${plan}`,
    probar: 'Try it free',
    popular: 'Most popular',
    prueba: '1 month free',
    mientras: 'Meanwhile you can edit your account details in',
    configuracion: 'Settings',
    planes: [
      {
        id: 'basico',
        nombre: 'Basic',
        para: 'For players and parents',
        incluye: ['Up to 2 players', '30 analyses per month', 'PDF report'],
      },
      {
        id: 'pro',
        nombre: 'Pro',
        para: 'For coaches and recruiters',
        incluye: ['Up to 24 players', '150 analyses per month', 'Compare and recruiting'],
        popular: true,
      },
      {
        id: 'ultra',
        nombre: 'Ultra',
        para: 'For academies, clubs and universities',
        incluye: ['Many more players', 'Many more analyses', 'Your whole coaching staff'],
      },
    ],
  },
}

export default function SinPlan() {
  const t = useTextos(textos)
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col items-center gap-8 py-4 text-center sm:py-10">
      <div className="flex flex-col items-center gap-4">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-line2 bg-surface px-3 py-1 text-xs font-semibold tracking-[0.06em] text-text2 uppercase">
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <rect x="5" y="11" width="14" height="10" rx="2" />
            <path d="M8 11V8a4 4 0 018 0v3" />
          </svg>
          {t.etiqueta}
        </span>
        <h1 className="font-display text-4xl leading-none font-bold sm:text-5xl">{t.titulo}</h1>
        <p className="max-w-[52ch] text-text2">{t.texto}</p>
      </div>

      <ul className="grid w-full gap-4 text-left md:grid-cols-3">
        {t.planes.map((plan) => (
          <li
            key={plan.id}
            className={`relative flex flex-col gap-4 rounded-card border bg-surface p-5 ${
              plan.popular ? 'border-accent-line/60 ring-1 ring-accent-line' : 'border-line'
            }`}
          >
            {plan.popular && (
              <span className="absolute -top-3 right-4 rounded-full bg-accent px-2.5 py-0.5 text-[11px] font-semibold text-on-accent">
                {t.popular}
              </span>
            )}
            <div>
              <p className="font-display text-2xl font-bold">{plan.nombre}</p>
              <p className="text-[13px] text-muted">{plan.para}</p>
            </div>
            <ul className="flex flex-col gap-2">
              {plan.incluye.map((item) => (
                <li key={item} className="flex items-center gap-2 text-sm text-text2">
                  <span className="text-accent-ink">
                    <Icon name="check" size={14} strokeWidth={2.6} />
                  </span>
                  {item}
                </li>
              ))}
            </ul>
            {plan.id === 'basico' && (
              <span className="self-start rounded-full bg-electric/15 px-2 py-0.5 text-[11px] font-semibold text-electric-ink">
                {t.prueba}
              </span>
            )}
            <Link
              to={`/checkout?plan=${plan.id}`}
              className={`mt-auto inline-flex min-h-11 items-center justify-center gap-2 rounded-full px-5 font-semibold transition ${
                plan.popular
                  ? 'bg-accent text-on-accent hover:opacity-90'
                  : 'border border-line3 text-text hover:border-text2'
              }`}
            >
              {plan.id === 'basico' ? t.probar : t.elegir(plan.nombre)}
              <Icon name="arrow" size={16} strokeWidth={2.2} />
            </Link>
          </li>
        ))}
      </ul>

      <p className="text-sm text-muted">
        {t.mientras}{' '}
        <Link to="/configuracion" className="font-semibold text-accent-ink hover:underline">
          {t.configuracion}
        </Link>
        .
      </p>
    </div>
  )
}
