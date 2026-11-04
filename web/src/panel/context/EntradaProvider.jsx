import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { EntradaContexto, PELOTA_PX } from './EntradaContext.js'
import './entrada.css'

const CUBRIR_MS = 550
const GIRO_MINIMO_MS = 1400
const ABRIR_MS = 800

const esperar = (ms) => new Promise((resolver) => setTimeout(resolver, ms))

export default function EntradaProvider({ children }) {
  const [entrada, setEntrada] = useState(null)
  const [listo, setListo] = useState(false)
  const inicio = useRef(0)

  const comenzar = useCallback(async ({ x, y, escala }) => {
    setListo(false)
    inicio.current = performance.now()
    setEntrada({ x, y, escala, fase: 'cubriendo' })
    await esperar(CUBRIR_MS)
    setEntrada((actual) => actual && { ...actual, fase: 'girando' })
  }, [])

  const panelListo = useCallback(() => setListo(true), [])

  useEffect(() => {
    if (entrada?.fase !== 'girando' || !listo) return
    const resto = Math.max(0, GIRO_MINIMO_MS - (performance.now() - inicio.current))
    const abrir = setTimeout(
      () => setEntrada((actual) => actual && { ...actual, fase: 'abriendo' }),
      resto,
    )
    return () => clearTimeout(abrir)
  }, [entrada?.fase, listo])

  useEffect(() => {
    if (entrada?.fase !== 'abriendo') return
    const cerrar = setTimeout(() => setEntrada(null), ABRIR_MS)
    return () => clearTimeout(cerrar)
  }, [entrada?.fase])

  const valor = useMemo(() => ({ comenzar, panelListo }), [comenzar, panelListo])

  return (
    <EntradaContexto value={valor}>
      {children}
      {entrada ? (
        <div
          role="status"
          aria-label="Cargando tu panel"
          className={`entrada entrada-${entrada.fase}`}
          style={{
            '--entrada-x': `${entrada.x}px`,
            '--entrada-y': `${entrada.y}px`,
            '--entrada-escala': entrada.escala,
            '--entrada-pelota': `${PELOTA_PX}px`,
          }}
        >
          <div className="entrada-fondo" />
          <div className="entrada-pelota">
            <svg viewBox="0 0 30 30" aria-hidden="true">
              <circle cx="15" cy="15" r="14" fill="var(--accent)" />
              <path
                d="M7.4 6.2c4.4 3.6 4.4 14 0 17.6M22.6 6.2c-4.4 3.6-4.4 14 0 17.6"
                stroke="var(--on-accent)"
                strokeWidth="1.6"
                strokeLinecap="round"
                fill="none"
              />
            </svg>
          </div>
        </div>
      ) : null}
    </EntradaContexto>
  )
}
