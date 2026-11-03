import { useEffect, useRef, useState } from 'react'

const GUTTER = 32
const CROSSING = 70

function buildRally(width, height, boundaries) {
  const sides = [width - GUTTER, GUTTER]
  let side = 0
  let path = `M${sides[side]} 0`

  for (const boundary of boundaries) {
    const fromX = sides[side]
    side = 1 - side
    const toX = sides[side]
    const middleX = (fromX + toX) / 2
    path += ` L${fromX} ${boundary - CROSSING}`
    path += ` C${fromX} ${boundary} ${middleX} ${boundary - CROSSING} ${middleX} ${boundary}`
    path += ` S${toX} ${boundary} ${toX} ${boundary + CROSSING}`
  }

  return `${path} L${sides[side]} ${height}`
}

export default function RallyThread() {
  const hostRef = useRef(null)
  const trailRef = useRef(null)
  const ballRef = useRef(null)
  const [canvas, setCanvas] = useState(null)

  useEffect(() => {
    const host = hostRef.current
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect
      const sections = [...host.parentElement.querySelectorAll(':scope > section')]
      const boundaries = sections.slice(1).map((section) => section.offsetTop)
      setCanvas({ width, height, path: buildRally(width, height, boundaries) })
    })
    observer.observe(host)
    return () => observer.disconnect()
  }, [])

  const path = canvas?.path

  useEffect(() => {
    const trail = trailRef.current
    const ball = ballRef.current
    if (!path || !trail || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    const total = trail.getTotalLength()
    let frame = null

    const draw = () => {
      frame = null
      const rect = hostRef.current.getBoundingClientRect()
      const reached = (window.innerHeight * 0.6 - rect.top) / rect.height
      const progress = Math.min(Math.max(reached, 0), 1)
      const point = trail.getPointAtLength(total * progress)

      trail.style.strokeDasharray = `${total}`
      trail.style.strokeDashoffset = `${total * (1 - progress)}`
      ball.setAttribute('cx', point.x)
      ball.setAttribute('cy', point.y)
      ball.style.opacity = progress > 0 && progress < 1 ? 1 : 0
    }

    const request = () => {
      if (frame === null) frame = requestAnimationFrame(draw)
    }

    draw()
    window.addEventListener('scroll', request, { passive: true })
    window.addEventListener('resize', request)

    return () => {
      window.removeEventListener('scroll', request)
      window.removeEventListener('resize', request)
      if (frame !== null) cancelAnimationFrame(frame)
    }
  }, [path])

  return (
    <div
      ref={hostRef}
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 hidden overflow-hidden xl:block"
    >
      {canvas ? (
        <svg width={canvas.width} height={canvas.height} fill="none" className="absolute inset-0">
          <path d={path} stroke="var(--line2)" strokeWidth="1.5" strokeDasharray="4 10" />
          <path ref={trailRef} d={path} stroke="var(--electric)" strokeWidth="1.5" />
          <circle ref={ballRef} r="7" fill="var(--accent)" stroke="var(--on-accent)" opacity="0" />
        </svg>
      ) : null}
    </div>
  )
}
