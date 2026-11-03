import { Fragment, memo, useEffect, useRef, useState } from 'react'
import Icon from '../../components/Icon.jsx'
import { rallyLocal } from '../../lib/rallyLocal.js'
import { createTrack } from '../../lib/track.js'

const titulo = 'Cada partido tiene datos. Nadie los está midiendo.'

const problemas = [
  'Revisar un partido toma *horas*.',
  'Las postulaciones no dicen cuánto saca ni cuánto corre un jugador.',
  'Comparar candidatos termina siendo por intuición.',
]

const subtitulo = 'Con AceCam, solo necesitas tres pasos:'

const pasos = [
  { icon: 'upload', title: 'Sube el video', text: 'Un archivo o un link de YouTube.' },
  { icon: 'ai', title: 'AceCam lo analiza por ti', text: 'Detecta recorrido, saques y golpes.' },
  { icon: 'report', title: 'Tú recibes el reporte', text: 'Estadísticas, clips y PDF.' },
]

const crudas = [
  titulo,
  ...problemas,
  subtitulo,
  ...pasos.flatMap((paso) => [paso.title, paso.text]),
]

const piezas = crudas.map((pieza) => pieza.replaceAll('*', ''))

const enfasis = crudas.map(
  (pieza) =>
    new Set(
      pieza
        .split(' ')
        .map((palabra, posicion) => (palabra.includes('*') ? posicion : -1))
        .filter((posicion) => posicion >= 0),
    ),
)

const inicios = piezas.reduce((acumulado, pieza, indice) => {
  acumulado.push(indice === 0 ? 0 : acumulado[indice - 1] + piezas[indice - 1].length)
  return acumulado
}, [])

const palabras = piezas.flatMap((pieza, indice) => {
  let desde = inicios[indice]
  return pieza.split(' ').map((palabra) => {
    const inicio = desde
    desde += palabra.length + 1
    return { inicio, largo: palabra.length }
  })
})

const TOTAL = inicios.at(-1) + piezas.at(-1).length
const CARET_EN_PANTALLA = 0.6
const SCROLL_POR_PX = 0.8
const RECORRIDO_INICIAL = TOTAL * 9
const FIJAR = '(min-width: 1024px) and (min-height: 640px)'
const TOPE_FIJO = 64
const ARCO = 34
const RETORNO = 60
const TIPEO_PX = 110
const SUAVIDAD = 0.35
const ORILLA = 32
const PELOTA_EN_PANTALLA = 0.5

function limitar(valor) {
  return Math.min(Math.max(valor, 0), 1)
}

function useAvance(seccionRef, contenidoRef) {
  const [avance, setAvance] = useState(1)
  const [fijo, setFijo] = useState(false)

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    const consulta = window.matchMedia(FIJAR)
    let frame = null
    let actual = null
    let ultimo = 0

    const medir = (tiempo) => {
      frame = null
      if (!consulta.matches) {
        const rect = contenidoRef.current.getBoundingClientRect()
        setAvance(limitar((window.innerHeight * CARET_EN_PANTALLA - rect.top) / rect.height))
        return
      }

      const rect = seccionRef.current.getBoundingClientRect()
      const objetivo = limitar(
        (TOPE_FIJO - rect.top) / (rect.height - window.innerHeight + TOPE_FIJO),
      )
      const pasos = Math.min((tiempo - ultimo) / (1000 / 60), 3)
      ultimo = tiempo
      actual =
        actual === null ? objetivo : actual + (objetivo - actual) * (1 - (1 - SUAVIDAD) ** pasos)
      if (Math.abs(objetivo - actual) < 0.0002) actual = objetivo
      setAvance(actual)
      if (actual !== objetivo) frame = requestAnimationFrame(medir)
    }

    const pedir = () => {
      if (frame !== null) return
      ultimo = performance.now()
      frame = requestAnimationFrame(medir)
    }

    const cambiarModo = () => {
      setFijo(consulta.matches)
      pedir()
    }

    cambiarModo()
    window.addEventListener('scroll', pedir, { passive: true })
    window.addEventListener('resize', pedir)
    consulta.addEventListener('change', cambiarModo)

    return () => {
      window.removeEventListener('scroll', pedir)
      window.removeEventListener('resize', pedir)
      consulta.removeEventListener('change', cambiarModo)
      if (frame !== null) cancelAnimationFrame(frame)
    }
  }, [seccionRef, contenidoRef])

  return { avance, fijo }
}

function useRecorridoLocal(fijoRef, activo) {
  const [recorrido, setRecorrido] = useState(null)

  useEffect(() => {
    const caja = fijoRef.current
    if (!activo || !caja) return

    const construir = () => {
      const base = caja.getBoundingClientRect()
      const inicio = {
        x: ORILLA - base.left,
        y: window.innerHeight * PELOTA_EN_PANTALLA - TOPE_FIJO,
      }
      const puntos = [...caja.querySelectorAll('[data-word]')]
        .sort((a, b) => Number(a.dataset.word) - Number(b.dataset.word))
        .map((nodo) => {
          const rect = nodo.getBoundingClientRect()
          return { x: rect.left + rect.width / 2 - base.left, y: rect.top - base.top - 6 }
        })

      const track = createTrack(inicio.x, inicio.y)
      let anterior = inicio
      const largos = []

      for (const [orden, punto] of puntos.entries()) {
        const control = Math.min(anterior.y, punto.y) - ARCO
        const saltoDeLinea = punto.y > anterior.y + 10 && punto.x < anterior.x
        if (orden === 0) {
          track.line(punto.x, punto.y)
        } else if (saltoDeLinea) {
          const vuelta = anterior.x + RETORNO
          track
            .cubic(vuelta, anterior.y, vuelta, punto.y, anterior.x, punto.y)
            .line(punto.x, punto.y)
        } else {
          track.quad((anterior.x + punto.x) / 2, control, punto.x, punto.y)
        }
        largos.push(track.length)
        anterior = punto
      }

      const muestra = track.finish()
      const ultimo = puntos.at(-1) ?? inicio
      rallyLocal.track = muestra
      rallyLocal.end = { x: base.left + ultimo.x, y: ultimo.y }
      window.dispatchEvent(new Event('rally:layout'))
      setRecorrido({ d: muestra.d, largos, total: muestra.total })
    }

    const observador = new ResizeObserver(construir)
    observador.observe(caja)
    document.fonts?.ready.then(construir)
    return () => observador.disconnect()
  }, [fijoRef, activo])

  return recorrido
}

function escritosEn(recorrido, largo) {
  const { largos } = recorrido
  const indice = largos.findIndex((hasta) => largo < hasta)
  if (indice === -1 || indice >= palabras.length) return TOTAL
  const desde = Math.max(indice === 0 ? 0 : largos[indice - 1], largos[indice] - TIPEO_PX)
  const palabra = palabras[indice]
  const tramo = limitar((largo - desde) / (largos[indice] - desde))
  return palabra.inicio + Math.round(tramo * palabra.largo)
}

function Pelota() {
  return (
    <span aria-hidden="true" className="relative inline-block w-0 xl:hidden">
      <span className="absolute -top-[0.75em] left-0.5 size-[0.42em] min-h-2 min-w-2 rounded-full bg-accent shadow-[inset_-0.08em_-0.08em_0_rgb(0_0_0/0.18)] motion-safe:animate-hop" />
    </span>
  )
}

const Pieza = memo(function Pieza({ indice, escritos }) {
  const texto = piezas[indice]
  let desde = inicios[indice]

  return texto.split(' ').map((palabra, posicion) => {
    const inicio = desde
    desde += palabra.length + 1
    const visibles = Math.min(Math.max(escritos - inicio, 0), palabra.length)
    const conCaret = escritos > 0 && escritos < TOTAL && escritos >= inicio && escritos < desde

    return (
      <Fragment key={inicio}>
        {posicion > 0 ? ' ' : null}
        <span
          data-word={inicio}
          className={enfasis[indice].has(posicion) ? 'text-accent-ink' : undefined}
        >
          {palabra.slice(0, visibles)}
          <span className="opacity-0">{palabra.slice(visibles)}</span>
          {conCaret ? <Pelota key={inicio} /> : null}
        </span>
      </Fragment>
    )
  })
})

function Escrito({ indice, escritos }) {
  const inicio = inicios[indice]
  const fin = inicio + piezas[indice].length
  const local = escritos < inicio ? inicio - 1 : escritos > fin ? fin + 1 : escritos
  return <Pieza indice={indice} escritos={local} />
}

export default function Problema() {
  const seccionRef = useRef(null)
  const contenidoRef = useRef(null)
  const fijoRef = useRef(null)
  const { avance, fijo } = useAvance(seccionRef, contenidoRef)
  const recorrido = useRecorridoLocal(fijoRef, fijo)
  const largo = fijo && recorrido ? avance * recorrido.total : 0
  const escritos = fijo
    ? recorrido
      ? escritosEn(recorrido, largo)
      : 0
    : Math.round(avance * TOTAL)
  const recorridoPx = recorrido ? recorrido.total * SCROLL_POR_PX : RECORRIDO_INICIAL

  useEffect(() => {
    window.dispatchEvent(new Event('rally:local'))
  }, [largo])

  let indice = 0
  const siguiente = () => indice++

  return (
    <section
      ref={seccionRef}
      id="el-problema"
      data-rally-pin
      data-pinned={fijo}
      className="relative px-6"
      style={fijo ? { height: `calc(100dvh + ${recorridoPx}px)` } : undefined}
    >
      <div
        ref={fijoRef}
        className={
          fijo ? 'sticky top-16 flex h-[calc(100dvh-4rem)] items-center' : 'py-14 sm:py-20'
        }
      >
        {fijo && recorrido ? (
          <svg
            aria-hidden="true"
            fill="none"
            className={`pointer-events-none absolute inset-0 hidden size-full overflow-visible xl:block ${
              avance > 0 && avance < 1 ? 'opacity-100' : 'opacity-0'
            }`}
          >
            <path data-rally-local data-length={largo} d={recorrido.d} stroke="none" />
          </svg>
        ) : null}

        <div ref={contenidoRef} className="relative mx-auto w-full max-w-6xl text-center">
          <h2 className="mx-auto max-w-3xl text-4xl sm:text-5xl">
            <Escrito indice={siguiente()} escritos={escritos} />
          </h2>

          <ul className="mx-auto mt-6 max-w-3xl space-y-2">
            {problemas.map((problema) => (
              <li
                key={problema}
                className="font-display text-2xl leading-snug font-semibold text-text2 sm:text-3xl"
              >
                <Escrito indice={siguiente()} escritos={escritos} />
              </li>
            ))}
          </ul>

          <h3 id="como-funciona" className="mt-12 text-3xl sm:text-4xl">
            <Escrito indice={siguiente()} escritos={escritos} />
          </h3>

          <ol className="relative mt-8 grid gap-8 text-left sm:grid-cols-3 sm:text-center">
            <span className="absolute top-6 right-1/6 left-1/6 hidden h-px bg-line2 sm:block" />
            {pasos.map((paso) => {
              const tituloIndice = siguiente()
              const textoIndice = siguiente()
              const activo = escritos > inicios[tituloIndice]

              return (
                <li
                  key={paso.title}
                  className="relative flex items-start gap-4 sm:flex-col sm:items-center"
                >
                  <span
                    className={`inline-flex size-12 shrink-0 items-center justify-center rounded-full border-2 border-electric bg-bg text-electric-ink transition-opacity duration-300 ${
                      activo ? 'opacity-100' : 'opacity-25'
                    }`}
                  >
                    <Icon name={paso.icon} strokeWidth={2.4} />
                  </span>
                  <div>
                    <p className="font-display text-xl font-semibold">
                      <Escrito indice={tituloIndice} escritos={escritos} />
                    </p>
                    <p className="mt-1 text-sm text-text2">
                      <Escrito indice={textoIndice} escritos={escritos} />
                    </p>
                  </div>
                </li>
              )
            })}
          </ol>
        </div>
      </div>
    </section>
  )
}
