import { useEffect, useRef, useState } from 'react'

const animable = () =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  typeof window.requestAnimationFrame === 'function' &&
  !window.matchMedia('(prefers-reduced-motion: reduce)').matches

const suavizar = (avance) => 1 - (1 - avance) ** 3

export function useContador(objetivo, { duracion = 1100, retraso = 0 } = {}) {
  const [mover] = useState(animable)
  const directo = !mover || typeof objetivo !== 'number' || !Number.isFinite(objetivo)
  const [valor, setValor] = useState(0)
  const actual = useRef(0)

  useEffect(() => {
    if (directo) return undefined
    const desde = typeof actual.current === 'number' ? actual.current : 0
    let cuadro
    let inicio
    const paso = (tiempo) => {
      inicio ??= tiempo + retraso
      const avance = Math.min(1, Math.max(0, (tiempo - inicio) / duracion))
      const siguiente = desde + (objetivo - desde) * suavizar(avance)
      actual.current = siguiente
      setValor(siguiente)
      if (avance < 1) cuadro = requestAnimationFrame(paso)
    }
    cuadro = requestAnimationFrame(paso)
    return () => cancelAnimationFrame(cuadro)
  }, [objetivo, directo, duracion, retraso])

  return directo ? objetivo : valor
}
