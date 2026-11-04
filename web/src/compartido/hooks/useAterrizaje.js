import { useRef, useState } from 'react'

export function useAterrizaje() {
  const ref = useRef(null)
  const soltar = useRef(false)
  const [aterrizando, setAterrizando] = useState(false)

  const onClick = (evento) => {
    if (
      soltar.current ||
      evento.button !== 0 ||
      evento.metaKey ||
      evento.ctrlKey ||
      evento.shiftKey ||
      evento.altKey
    )
      return
    const pelota = ref.current?.querySelector('.logo-pelota')
    if (!pelota?.getAnimations?.().length) return
    evento.preventDefault()
    setAterrizando(true)
  }

  const onAnimationIteration = (evento) => {
    if (!aterrizando || evento.animationName !== 'logo-rebote') return
    soltar.current = true
    ref.current?.click()
    soltar.current = false
    setAterrizando(false)
  }

  return { ref, onClick, onAnimationIteration, 'data-aterrizando': aterrizando || undefined }
}
