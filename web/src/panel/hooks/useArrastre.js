import { useEffect, useRef } from 'react'

export function useArrastre() {
  const ref = useRef(null)

  useEffect(() => {
    const zona = ref.current
    if (!zona) return undefined
    let activo = false
    let movido = false
    let inicioX = 0
    let inicioScroll = 0

    const bajar = (evento) => {
      if (evento.pointerType !== 'mouse' || evento.button !== 0) return
      activo = true
      movido = false
      inicioX = evento.clientX
      inicioScroll = zona.scrollLeft
    }
    const mover = (evento) => {
      if (!activo) return
      const distancia = evento.clientX - inicioX
      if (!movido && Math.abs(distancia) > 5) {
        movido = true
        zona.setPointerCapture?.(evento.pointerId)
        zona.dataset.arrastrando = ''
      }
      if (movido) zona.scrollLeft = inicioScroll - distancia
    }
    const soltar = () => {
      if (!activo) return
      activo = false
      delete zona.dataset.arrastrando
    }
    const clic = (evento) => {
      if (!movido) return
      evento.preventDefault()
      evento.stopPropagation()
      movido = false
    }

    zona.addEventListener('pointerdown', bajar)
    zona.addEventListener('pointermove', mover)
    zona.addEventListener('pointerup', soltar)
    zona.addEventListener('pointercancel', soltar)
    zona.addEventListener('click', clic, true)
    return () => {
      zona.removeEventListener('pointerdown', bajar)
      zona.removeEventListener('pointermove', mover)
      zona.removeEventListener('pointerup', soltar)
      zona.removeEventListener('pointercancel', soltar)
      zona.removeEventListener('click', clic, true)
    }
  }, [])

  return ref
}
