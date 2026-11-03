import Lenis from 'lenis'

let actual = null

export function subirAlInicio() {
  if (actual) actual.scrollTo(0, { immediate: true, force: true })
  else window.scrollTo(0, 0)
}

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

  actual = lenis
  return lenis
}
