export function inclinar(aplicar, soltar) {
  return {
    onPointerMove: (evento) => {
      if (evento.pointerType !== 'mouse') return
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
      const elemento = evento.currentTarget
      const rect = elemento.getBoundingClientRect()
      const x = (evento.clientX - rect.left) / rect.width - 0.5
      const y = (evento.clientY - rect.top) / rect.height - 0.5
      aplicar(elemento, x, y)
    },
    onPointerLeave: (evento) => soltar(evento.currentTarget),
  }
}
