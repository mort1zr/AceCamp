import { flushSync } from 'react-dom'
import { Link, useNavigate } from 'react-router'
import { subirAlInicio } from '../lib/smoothScroll.js'

export default function LinkDeslizante({ to, sentido = 'adelante', onClick, ...props }) {
  const navigate = useNavigate()

  const deslizar = (evento) => {
    onClick?.(evento)
    if (
      evento.defaultPrevented ||
      evento.button !== 0 ||
      evento.metaKey ||
      evento.ctrlKey ||
      evento.shiftKey ||
      evento.altKey
    )
      return

    evento.preventDefault()
    const cambiar = () => {
      flushSync(() => navigate(to))
      subirAlInicio()
    }

    if (
      !document.startViewTransition ||
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ) {
      cambiar()
      return
    }

    const raiz = document.documentElement
    raiz.dataset.deslizar = sentido
    document.startViewTransition(cambiar).finished.finally(() => {
      delete raiz.dataset.deslizar
    })
  }

  return <Link to={to} onClick={deslizar} {...props} />
}
