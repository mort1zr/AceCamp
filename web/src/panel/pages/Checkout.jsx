import { useEffect, useId, useState } from 'react'
import { Link, Navigate, useLocation, useSearchParams } from 'react-router'
import ControlsPill from '../../compartido/components/ControlsPill.jsx'
import LinkDeslizante from '../../compartido/components/LinkDeslizante.jsx'
import Logo from '../../compartido/components/Logo.jsx'
import { useAterrizaje } from '../../compartido/hooks/useAterrizaje.js'
import { useIdioma } from '../../compartido/lib/idioma.jsx'
import Icon from '../../landing/components/Icon.jsx'
import { Field } from '../components/AuthForm.jsx'
import { useAuth } from '../context/AuthContext.js'
import { useEntrada } from '../context/EntradaContext.js'
import {
  formatearNumero,
  formatearVencimiento,
  marcaTarjeta,
  soloDigitos,
  validarTarjeta,
} from '../lib/tarjeta.js'

const PLANES = ['basico', 'pro', 'ultra']
const VACIA = { nombre: '', numero: '', vencimiento: '', cvc: '' }
const PROCESAR_MS = 1600

const textos = {
  es: {
    volver: 'Volver a precios',
    pasos: ['Plan', 'Pago', 'Listo'],
    titulo: 'Activa tu plan',
    subtitulo: 'Elige el plan y el periodo, y agrega tu tarjeta.',
    tuPlan: 'Tu plan',
    periodo: 'Periodo',
    mensual: 'Mensual',
    anual: 'Anual',
    metodo: 'Método de pago',
    tarjeta: 'Tarjeta de crédito o débito',
    simulado: 'Pago simulado: no se hace ningún cobro real. Usa 4242 4242 4242 4242.',
    nombre: 'Nombre en la tarjeta',
    numero: 'Número de tarjeta',
    vencimiento: 'Vencimiento',
    cvc: 'CVC',
    errores: {
      nombre: 'Escribe el nombre como aparece en la tarjeta.',
      numero: 'Revisa el número de la tarjeta.',
      vencimiento: 'Usa MM/AA con una fecha futura.',
      cvc: 'Revisa el código de seguridad.',
    },
    resumen: 'Resumen',
    precio: '[PRECIO]',
    porMes: 'por mes',
    porAnio: 'por año',
    prueba: '1 mes de prueba gratis',
    hoy: 'Total hoy',
    gratis: 'Gratis',
    luego: (precio, periodo) => `Luego ${precio} ${periodo}. Cancela cuando quieras.`,
    renueva: (periodo) =>
      `Se renueva ${periodo === 'anual' ? 'cada año' : 'cada mes'}. Cancela cuando quieras.`,
    pagar: 'Pagar y activar',
    empezarPrueba: 'Empezar prueba gratis',
    procesando: 'Procesando pago…',
    seguro: 'Tus datos de pago no se guardan en AceCam.',
    fallo: 'No pudimos activar el plan. Revisa tu conexión e inténtalo otra vez; no se hizo ningún cobro.',
    listoTitulo: (plan) => `Tu plan ${plan} está activo`,
    listoPrueba: 'Tu mes de prueba ya empezó.',
    listoTexto: 'Ya puedes entrar al panel y empezar a analizar partidos.',
    recibo: 'Recibo',
    pagado: 'Pagado hoy',
    termina: 'Tarjeta terminada en',
    irPanel: 'Ir al panel',
    verPlan: 'Ver mi plan',
    planes: {
      basico: {
        nombre: 'Básico',
        para: 'Para jugadores y padres',
        incluye: ['Hasta 2 jugadores', '30 análisis al mes', 'Reporte en PDF'],
      },
      pro: {
        nombre: 'Pro',
        para: 'Para entrenadores y reclutadores',
        incluye: ['Hasta 24 jugadores', '150 análisis al mes', 'Comparador y reclutamiento'],
      },
      ultra: {
        nombre: 'Ultra',
        para: 'Para academias, clubes y universidades',
        incluye: ['Muchos más jugadores', 'Muchos más análisis', 'Todo tu cuerpo técnico'],
      },
    },
  },
  en: {
    volver: 'Back to pricing',
    pasos: ['Plan', 'Payment', 'Done'],
    titulo: 'Activate your plan',
    subtitulo: 'Choose the plan and billing period, then add your card.',
    tuPlan: 'Your plan',
    periodo: 'Billing',
    mensual: 'Monthly',
    anual: 'Yearly',
    metodo: 'Payment method',
    tarjeta: 'Credit or debit card',
    simulado: 'Simulated payment: no real charge is made. Use 4242 4242 4242 4242.',
    nombre: 'Name on card',
    numero: 'Card number',
    vencimiento: 'Expiry',
    cvc: 'CVC',
    errores: {
      nombre: 'Type the name as it appears on the card.',
      numero: 'Check the card number.',
      vencimiento: 'Use MM/YY with a future date.',
      cvc: 'Check the security code.',
    },
    resumen: 'Summary',
    precio: '[PRICE]',
    porMes: 'per month',
    porAnio: 'per year',
    prueba: '1-month free trial',
    hoy: 'Due today',
    gratis: 'Free',
    luego: (precio, periodo) => `Then ${precio} ${periodo}. Cancel anytime.`,
    renueva: (periodo) =>
      `Renews ${periodo === 'anual' ? 'every year' : 'every month'}. Cancel anytime.`,
    pagar: 'Pay and activate',
    empezarPrueba: 'Start free trial',
    procesando: 'Processing payment…',
    fallo: 'We could not activate the plan. Check your connection and try again; you were not charged.',
    seguro: 'Your payment details are not stored by AceCam.',
    listoTitulo: (plan) => `Your ${plan} plan is active`,
    listoPrueba: 'Your trial month has started.',
    listoTexto: 'You can now open the dashboard and start analyzing matches.',
    recibo: 'Receipt',
    pagado: 'Paid today',
    termina: 'Card ending in',
    irPanel: 'Go to dashboard',
    verPlan: 'View my plan',
    planes: {
      basico: {
        nombre: 'Basic',
        para: 'For players and parents',
        incluye: ['Up to 2 players', '30 analyses per month', 'PDF report'],
      },
      pro: {
        nombre: 'Pro',
        para: 'For coaches and recruiters',
        incluye: ['Up to 24 players', '150 analyses per month', 'Compare and recruiting'],
      },
      ultra: {
        nombre: 'Ultra',
        para: 'For academies, clubs and universities',
        incluye: ['Many more players', 'Many more analyses', 'Your whole coaching staff'],
      },
    },
  },
}

const tarjeta = 'rounded-card border border-line bg-surface p-5 sm:p-7'
const subtitulo = 'font-display text-xl font-semibold'

function Pasos({ t, paso }) {
  return (
    <ol className="flex items-center gap-2 text-[13px] font-semibold">
      {t.pasos.map((nombre, indice) => {
        const hecho = indice < paso
        const actual = indice === paso
        return (
          <li key={nombre} className="flex items-center gap-2">
            {indice > 0 && (
              <span
                aria-hidden="true"
                className={`h-px w-6 sm:w-10 ${hecho || actual ? 'bg-accent' : 'bg-line2'}`}
              />
            )}
            <span
              aria-current={actual ? 'step' : undefined}
              className={`flex items-center gap-1.5 ${actual ? 'text-text' : hecho ? 'text-accent-ink' : 'text-muted'}`}
            >
              <span
                className={`grid size-6 place-items-center rounded-full text-[11px] ${
                  hecho
                    ? 'bg-accent text-on-accent'
                    : actual
                      ? 'border-2 border-accent text-text'
                      : 'border border-line2'
                }`}
              >
                {hecho ? <Icon name="check" size={12} strokeWidth={3} /> : indice + 1}
              </span>
              {nombre}
            </span>
          </li>
        )
      })}
    </ol>
  )
}

function ElegirPlan({ t, plan, onPlan, periodo, onPeriodo }) {
  const id = useId()
  return (
    <section className={tarjeta} aria-labelledby={`${id}-plan`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id={`${id}-plan`} className={subtitulo}>
          {t.tuPlan}
        </h2>
        <div
          role="radiogroup"
          aria-label={t.periodo}
          className="grid grid-cols-2 gap-0.5 rounded-full border border-line2 bg-bg p-1"
        >
          {['mensual', 'anual'].map((opcion) => (
            <button
              key={opcion}
              type="button"
              role="radio"
              aria-checked={periodo === opcion}
              onClick={() => onPeriodo(opcion)}
              className="cursor-pointer rounded-full px-4 py-1.5 text-[13px] font-semibold text-text2 transition-colors hover:text-text aria-checked:bg-accent aria-checked:text-on-accent"
            >
              {t[opcion]}
            </button>
          ))}
        </div>
      </div>
      <div
        role="radiogroup"
        aria-labelledby={`${id}-plan`}
        className="mt-5 grid gap-3 sm:grid-cols-3"
      >
        {PLANES.map((clave) => {
          const opcion = t.planes[clave]
          const activo = clave === plan
          return (
            <button
              key={clave}
              type="button"
              role="radio"
              aria-checked={activo}
              onClick={() => onPlan(clave)}
              className={`flex cursor-pointer flex-col gap-1.5 rounded-xl border p-4 text-left transition-colors ${
                activo
                  ? 'border-accent-line bg-accent/8 ring-1 ring-accent-line'
                  : 'border-line2 hover:border-line3'
              }`}
            >
              <span className="flex items-center justify-between gap-2">
                <span className="font-display text-xl font-bold">{opcion.nombre}</span>
                <span
                  aria-hidden="true"
                  className={`grid size-5 place-items-center rounded-full border-2 ${
                    activo ? 'border-accent bg-accent text-on-accent' : 'border-line3'
                  }`}
                >
                  {activo && <Icon name="check" size={11} strokeWidth={3.2} />}
                </span>
              </span>
              <span className="text-[13px] leading-snug text-muted">{opcion.para}</span>
              {clave === 'basico' && (
                <span className="mt-1 self-start rounded-full bg-electric/15 px-2 py-0.5 text-[11px] font-semibold text-electric-ink">
                  {t.prueba}
                </span>
              )}
            </button>
          )
        })}
      </div>
    </section>
  )
}

function Pago({ t, valores, errores, onCambio, bloqueado }) {
  const id = useId()
  const marca = marcaTarjeta(valores.numero)
  return (
    <section className={tarjeta} aria-labelledby={`${id}-pago`}>
      <h2 id={`${id}-pago`} className={subtitulo}>
        {t.metodo}
      </h2>
      <p className="mt-1 text-sm text-muted">{t.tarjeta}</p>
      <p className="mt-4 flex items-start gap-2 rounded-lg border border-dashed border-electric/50 bg-electric/5 px-3 py-2.5 text-[13px] text-text2">
        <span className="mt-0.5 shrink-0 text-electric-ink">
          <Icon name="shield" size={15} strokeWidth={2} />
        </span>
        {t.simulado}
      </p>
      <fieldset disabled={bloqueado} className="mt-5 grid gap-4">
        <Field
          id="nombre"
          label={t.nombre}
          autoComplete="cc-name"
          value={valores.nombre}
          onChange={onCambio}
          error={errores.nombre && t.errores.nombre}
        />
        <div className="relative">
          <Field
            id="numero"
            label={t.numero}
            autoComplete="cc-number"
            inputMode="numeric"
            placeholder="1234 1234 1234 1234"
            value={valores.numero}
            onChange={onCambio}
            error={errores.numero && t.errores.numero}
          />
          {marca && (
            <span className="pointer-events-none absolute top-[2.15rem] right-3 rounded-[4px] bg-surface2 px-1.5 py-0.5 font-display text-[10px] font-bold tracking-[0.06em] text-text2 uppercase">
              {marca}
            </span>
          )}
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Field
            id="vencimiento"
            label={t.vencimiento}
            autoComplete="cc-exp"
            inputMode="numeric"
            placeholder="MM/AA"
            value={valores.vencimiento}
            onChange={onCambio}
            error={errores.vencimiento && t.errores.vencimiento}
          />
          <Field
            id="cvc"
            label={t.cvc}
            autoComplete="cc-csc"
            inputMode="numeric"
            placeholder="123"
            value={valores.cvc}
            onChange={onCambio}
            error={errores.cvc && t.errores.cvc}
          />
        </div>
      </fieldset>
    </section>
  )
}

function Resumen({ t, plan, periodo, procesando }) {
  const opcion = t.planes[plan]
  const prueba = plan === 'basico'
  const porPeriodo = periodo === 'anual' ? t.porAnio : t.porMes
  return (
    <aside className={`${tarjeta} flex flex-col gap-5 lg:sticky lg:top-20`}>
      <h2 className={subtitulo}>{t.resumen}</h2>
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="font-display text-2xl font-bold">{opcion.nombre}</p>
          <p className="text-[13px] text-muted">{t[periodo]}</p>
        </div>
        <p className="text-right">
          <span className="block font-semibold">{t.precio}</span>
          <span className="text-[13px] text-muted">{porPeriodo}</span>
        </p>
      </div>
      <ul className="flex flex-col gap-2 border-t border-chip pt-4">
        {opcion.incluye.map((item) => (
          <li key={item} className="flex items-center gap-2 text-sm text-text2">
            <span className="text-accent-ink">
              <Icon name="check" size={14} strokeWidth={2.6} />
            </span>
            {item}
          </li>
        ))}
      </ul>
      {prueba && (
        <p className="flex items-center justify-between rounded-lg bg-electric/10 px-3 py-2 text-sm">
          <span>{t.prueba}</span>
          <span className="font-semibold text-electric-ink">−{t.precio}</span>
        </p>
      )}
      <div className="flex items-baseline justify-between border-t border-chip pt-4">
        <span className="font-semibold">{t.hoy}</span>
        <span className="font-display text-3xl font-bold">{prueba ? t.gratis : t.precio}</span>
      </div>
      <p className="-mt-3 text-xs text-muted">
        {prueba ? t.luego(t.precio, porPeriodo) : t.renueva(periodo)}
      </p>
      <button
        type="submit"
        form="checkout-pago"
        disabled={procesando}
        className="inline-flex min-h-12 w-full cursor-pointer items-center justify-center gap-2 rounded-full bg-accent px-5 font-semibold text-on-accent transition hover:opacity-90 disabled:cursor-wait disabled:opacity-70"
      >
        {procesando ? (
          <>
            <span
              aria-hidden="true"
              className="size-4 animate-spin rounded-full border-2 border-on-accent border-t-transparent"
            />
            {t.procesando}
          </>
        ) : (
          <>
            {prueba ? t.empezarPrueba : t.pagar}
            <Icon name="arrow" size={18} strokeWidth={2.2} />
          </>
        )}
      </button>
      <p className="-mt-2 flex items-center justify-center gap-1.5 text-xs text-muted">
        <Icon name="shield" size={13} strokeWidth={2} />
        {t.seguro}
      </p>
    </aside>
  )
}

function Confirmacion({ t, plan, periodo, ultimos, prueba }) {
  const opcion = t.planes[plan]
  return (
    <section className={`${tarjeta} mx-auto flex max-w-lg flex-col items-center gap-5 text-center`}>
      <span className="grid size-16 place-items-center rounded-full bg-accent text-on-accent shadow-[0_8px_30px_-8px_var(--accent)]">
        <Icon name="check" size={30} strokeWidth={3} />
      </span>
      <div>
        <h2 className="font-display text-3xl font-bold">{t.listoTitulo(opcion.nombre)}</h2>
        <p className="mt-2 text-text2">{prueba ? t.listoPrueba : t.listoTexto}</p>
      </div>
      <dl className="w-full rounded-xl border border-line2 bg-surface2 p-4 text-left text-sm">
        <p className="mb-2 text-xs font-semibold tracking-[0.08em] text-muted uppercase">
          {t.recibo}
        </p>
        <div className="flex justify-between py-1">
          <dt className="text-muted">{t.tuPlan}</dt>
          <dd className="font-semibold">
            {opcion.nombre} · {t[periodo]}
          </dd>
        </div>
        <div className="flex justify-between py-1">
          <dt className="text-muted">{t.pagado}</dt>
          <dd className="font-semibold">{prueba ? t.gratis : t.precio}</dd>
        </div>
        <div className="flex justify-between py-1">
          <dt className="text-muted">{t.termina}</dt>
          <dd className="font-semibold">•••• {ultimos}</dd>
        </div>
      </dl>
      <div className="flex w-full flex-col gap-2 sm:flex-row">
        <Link
          to="/inicio"
          className="inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-full bg-accent px-5 font-semibold text-on-accent transition hover:opacity-90"
        >
          {t.irPanel}
          <Icon name="arrow" size={18} strokeWidth={2.2} />
        </Link>
        <Link
          to="/configuracion?seccion=plan"
          className="inline-flex min-h-12 flex-1 items-center justify-center rounded-full border border-line3 px-5 font-semibold text-text transition-colors hover:border-text2"
        >
          {t.verPlan}
        </Link>
      </div>
    </section>
  )
}

export default function Checkout({ contratar = async () => {} }) {
  const { user, loading } = useAuth()
  const location = useLocation()
  const entrada = useEntrada()
  const aterrizaje = useAterrizaje()
  const { idioma } = useIdioma()
  const t = textos[idioma]
  const [parametros, setParametros] = useSearchParams()
  const plan = PLANES.includes(parametros.get('plan')) ? parametros.get('plan') : 'pro'
  const periodo = parametros.get('ciclo') === 'anual' ? 'anual' : 'mensual'
  const [valores, setValores] = useState(VACIA)
  const [errores, setErrores] = useState({})
  const [procesando, setProcesando] = useState(false)
  const [listo, setListo] = useState(null)
  const [fallo, setFallo] = useState(false)

  useEffect(() => {
    entrada?.panelListo()
  }, [entrada])

  if (loading) return <div aria-busy="true" className="min-h-dvh bg-bg" />
  if (!user) return <Navigate to="/registro" replace state={{ from: location }} />

  const cambiarParametro = (clave, valor) => {
    const siguientes = new URLSearchParams(parametros)
    siguientes.set(clave, valor)
    setParametros(siguientes, { replace: true })
  }

  const cambiar = (evento) => {
    const { name, value } = evento.target
    const formateado =
      name === 'numero'
        ? formatearNumero(value)
        : name === 'vencimiento'
          ? formatearVencimiento(value)
          : name === 'cvc'
            ? soloDigitos(value).slice(0, marcaTarjeta(valores.numero) === 'amex' ? 4 : 3)
            : value
    setValores((actual) => ({ ...actual, [name]: formateado }))
    if (errores[name]) setErrores((actual) => ({ ...actual, [name]: undefined }))
  }

  const pagar = async (evento) => {
    evento.preventDefault()
    const encontrados = validarTarjeta(valores)
    setErrores(encontrados)
    if (Object.keys(encontrados).length) {
      document.getElementById(Object.keys(encontrados)[0])?.focus()
      return
    }
    setProcesando(true)
    setFallo(false)
    let guardado
    try {
      ;[guardado] = await Promise.all([
        contratar({ plan, periodo }),
        new Promise((resolver) => setTimeout(resolver, PROCESAR_MS)),
      ])
    } catch {
      setFallo(true)
      setProcesando(false)
      return
    }
    // Básico es mes de prueba solo la primera vez (PCIT-158).
    const prueba = guardado ? guardado === 'prueba' : plan === 'basico'
    setListo({ ultimos: soloDigitos(valores.numero).slice(-4), prueba })
    setValores(VACIA)
    setProcesando(false)
    window.scrollTo({ top: 0 })
  }

  return (
    <div className="relative min-h-dvh overflow-clip bg-bg pt-[calc(env(safe-area-inset-top)+4.75rem)] pb-16 text-text sm:pt-6">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage: 'radial-gradient(var(--line2) 1px, transparent 1px)',
          backgroundSize: '22px 22px',
          maskImage: 'radial-gradient(ellipse 70% 50% at 50% 20%, black, transparent 80%)',
        }}
      />
      <ControlsPill cuenta className="max-sm:absolute" />

      <div className="relative mx-auto max-w-6xl px-5 sm:px-6">
        <LinkDeslizante
          to="/precios"
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

        <header className="mt-8 flex flex-col gap-4 sm:mt-12 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-4xl sm:text-5xl">{t.titulo}</h1>
            {!listo && <p className="mt-2 text-text2">{t.subtitulo}</p>}
          </div>
          <Pasos t={t} paso={listo ? 3 : 1} />
        </header>

        <div className="mt-8">
          {listo ? (
            <Confirmacion t={t} plan={plan} periodo={periodo} ultimos={listo.ultimos} prueba={listo.prueba} />
          ) : (
            <div className="grid items-start gap-5 lg:grid-cols-[1fr_380px]">
              <form id="checkout-pago" className="flex flex-col gap-5" onSubmit={pagar} noValidate>
                <ElegirPlan
                  t={t}
                  plan={plan}
                  onPlan={(valor) => cambiarParametro('plan', valor)}
                  periodo={periodo}
                  onPeriodo={(valor) => cambiarParametro('ciclo', valor)}
                />
                <Pago
                  t={t}
                  valores={valores}
                  errores={errores}
                  onCambio={cambiar}
                  bloqueado={procesando}
                />
                {fallo && (
                  <p role="alert" className="rounded-lg border border-bad px-4 py-3 text-sm text-bad">
                    {t.fallo}
                  </p>
                )}
              </form>
              <Resumen t={t} plan={plan} periodo={periodo} procesando={procesando} />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
