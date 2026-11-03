import { useEffect } from 'react'

const STIFFNESS = 0.05
const DAMPING = 0.8
const FRAME_MS = 1000 / 60

export function useScrollSpring(ref, { start, end, property = '--scroll-progress' }) {
  useEffect(() => {
    const node = ref.current
    if (!node || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    let value = 0
    let velocity = 0
    let frame = null
    let lastTime = 0

    const readTarget = () => Math.min(Math.max((window.scrollY - start) / (end - start), 0), 1)

    const tick = (time) => {
      const steps = Math.min((time - lastTime) / FRAME_MS, 2)
      lastTime = time

      const target = readTarget()
      velocity += (target - value) * STIFFNESS * steps
      velocity *= DAMPING ** steps
      value += velocity * steps
      node.style.setProperty(property, value.toFixed(4))

      const settled = Math.abs(target - value) < 0.001 && Math.abs(velocity) < 0.001
      frame = settled ? null : requestAnimationFrame(tick)
    }

    const wake = () => {
      if (frame !== null) return
      lastTime = performance.now()
      frame = requestAnimationFrame(tick)
    }

    wake()
    window.addEventListener('scroll', wake, { passive: true })

    return () => {
      window.removeEventListener('scroll', wake)
      if (frame !== null) cancelAnimationFrame(frame)
    }
  }, [ref, start, end, property])
}
