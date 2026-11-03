import Lenis from 'lenis'

export function startSmoothScroll() {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return null

  const lenis = new Lenis({
    lerp: 0.09,
    wheelMultiplier: 0.9,
    anchors: { offset: -80 },
  })

  const raf = (time) => {
    lenis.raf(time)
    requestAnimationFrame(raf)
  }
  requestAnimationFrame(raf)

  return lenis
}
