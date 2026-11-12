import { useEffect, useRef, useState } from 'react'

const animable = () =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  typeof window.requestAnimationFrame === 'function' &&
  !window.matchMedia('(prefers-reduced-motion: reduce)').matches

const suavizar = (avance) => 1 - (1 - avance) ** 3

export function useValoresAnimados(objetivo, duracion = 800) {
  const [mover] = useState(animable)
  const destino = objetivo.map((valor) => (Number.isFinite(valor) ? valor : 0))
  const clave = destino.join(',')
  const [valores, setValores] = useState(() => destino.map(() => 0))
  const actual = useRef(valores)

  useEffect(() => {
    if (!mover) return undefined
    const hacia = clave.split(',').map(Number)
    const desde = hacia.map((_, i) => actual.current[i] ?? 0)
    let cuadro
    let inicio
    const paso = (tiempo) => {
      inicio ??= tiempo
      const avance = Math.min(1, (tiempo - inicio) / duracion)
      const siguiente = hacia.map((valor, i) => desde[i] + (valor - desde[i]) * suavizar(avance))
      actual.current = siguiente
      setValores(siguiente)
      if (avance < 1) cuadro = requestAnimationFrame(paso)
    }
    cuadro = requestAnimationFrame(paso)
    return () => cancelAnimationFrame(cuadro)
  }, [clave, mover, duracion])

  return mover ? valores : destino
}
