import { useEffect, useRef, useState } from 'react'

const GUTTER = 32
const CROSSING = 70
const BALL_START_SCALE = 3.2
const BALL_SHRINK_UNTIL = 0.07
const SMOOTHING = 0.1
const BALL_VIEWPORT_POSITION = 0.5
const END_INSET = 170
const END_LIFT = 170
const ARRIVED_AT = 0.985
const FRAME_MS = 1000 / 60

function buildRally(width, height, start, boundaries) {
  const sides = [width - GUTTER, GUTTER]
  let side = 0
  let path = `M${start.x} ${start.y} Q${sides[side]} ${start.y} ${sides[side]} ${start.y + 220}`

  for (const boundary of boundaries) {
    const fromX = sides[side]
    side = 1 - side
    const toX = sides[side]
    const middleX = (fromX + toX) / 2
    path += ` L${fromX} ${boundary - CROSSING}`
    path += ` C${fromX} ${boundary} ${middleX} ${boundary - CROSSING} ${middleX} ${boundary}`
    path += ` S${toX} ${boundary} ${toX} ${boundary + CROSSING}`
  }

  const end = {
    x: side === 0 ? width - END_INSET : END_INSET,
    y: height - END_LIFT,
  }
  const fromX = sides[side]

  return {
    end,
    path: `${path} L${fromX} ${end.y - 180} Q${fromX} ${end.y} ${end.x} ${end.y}`,
  }
}

const CLOUD_PUFFS = [
  [-44, -46, 20],
  [-20, -62, 24],
  [12, -64, 24],
  [42, -48, 20],
  [0, -40, 24],
  [-26, -34, 18],
  [26, -34, 18],
  [6, -9, 5],
  [12, 0, 3],
]

function lengthAtY(trail, total, targetY) {
  let low = 0
  let high = total

  for (let step = 0; step < 16; step += 1) {
    const middle = (low + high) / 2
    if (trail.getPointAtLength(middle).y < targetY) low = middle
    else high = middle
  }

  return low
}

const CONFETTI_COLORS = ['--accent', '--electric', '--series1', '--series2', '--series4', '--good']
const CONFETTI_PIECES = 42
const SVG_NS = 'http://www.w3.org/2000/svg'

function burstConfetti(layer) {
  for (let index = 0; index < CONFETTI_PIECES; index += 1) {
    const piece = document.createElementNS(SVG_NS, 'rect')
    const angle = Math.random() * Math.PI * 2
    const distance = 70 + Math.random() * 110
    const x = Math.cos(angle) * distance
    const y = Math.sin(angle) * distance - 40
    const spin = (Math.random() - 0.5) * 720

    piece.setAttribute('x', '-3')
    piece.setAttribute('y', '-5')
    piece.setAttribute('width', '6')
    piece.setAttribute('height', '10')
    piece.setAttribute('rx', '1.5')
    piece.setAttribute('fill', `var(${CONFETTI_COLORS[index % CONFETTI_COLORS.length]})`)
    layer.appendChild(piece)

    piece
      .animate(
        [
          { transform: 'translate(0px, -50px) rotate(0deg)', opacity: 1 },
          { transform: `translate(${x}px, ${y}px) rotate(${spin / 2}deg)`, opacity: 1, offset: 0.55 },
          { transform: `translate(${x * 1.15}px, ${y + 120}px) rotate(${spin}deg)`, opacity: 0 },
        ],
        { duration: 1300 + Math.random() * 500, easing: 'cubic-bezier(0.2, 0.7, 0.3, 1)' },
      )
      .finished.then(() => piece.remove())
  }
}

export default function RallyThread() {
  const hostRef = useRef(null)
  const trailRef = useRef(null)
  const ballRef = useRef(null)
  const bubbleRef = useRef(null)
  const confettiRef = useRef(null)
  const [canvas, setCanvas] = useState(null)

  useEffect(() => {
    const host = hostRef.current
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect
      const parent = host.parentElement
      const hostRect = host.getBoundingClientRect()
      const court = parent.querySelector('[data-rally-start]').getBoundingClientRect()
      const start = {
        x: court.left - hostRect.left + court.width * 0.74,
        y: court.top - hostRect.top + court.height * 0.84,
      }
      const sections = [...parent.querySelectorAll(':scope > section')]
      const boundaries = sections.slice(2).map((section) => section.offsetTop)
      setCanvas({ width, height, ...buildRally(width, height, start, boundaries) })
    })
    observer.observe(host)
    return () => observer.disconnect()
  }, [])

  const path = canvas?.path
  const end = canvas?.end

  useEffect(() => {
    const trail = trailRef.current
    const ball = ballRef.current
    if (!path || !trail || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    const total = trail.getTotalLength()
    let frame = null
    let progress = null
    let arrived = false
    let lastTime = 0

    const readTarget = () => {
      const targetY = window.innerHeight * BALL_VIEWPORT_POSITION - hostRef.current.getBoundingClientRect().top
      return lengthAtY(trail, total, targetY) / total
    }

    const render = () => {
      const point = trail.getPointAtLength(total * progress)
      const shrink = Math.min(progress / BALL_SHRINK_UNTIL, 1)
      const scale = BALL_START_SCALE + (1 - BALL_START_SCALE) * shrink

      trail.style.strokeDasharray = `${total}`
      trail.style.strokeDashoffset = `${total * (1 - progress)}`
      ball.setAttribute('transform', `translate(${point.x} ${point.y}) scale(${scale})`)
      ball.style.opacity = 1
      const nowArrived = progress >= ARRIVED_AT
      if (nowArrived && !arrived) burstConfetti(confettiRef.current)
      arrived = nowArrived
      bubbleRef.current.dataset.active = String(arrived)
    }

    const tick = (time) => {
      const steps = Math.min((time - lastTime) / FRAME_MS, 3)
      lastTime = time

      const target = readTarget()
      progress += (target - progress) * (1 - (1 - SMOOTHING) ** steps)
      if (Math.abs(target - progress) < 0.00005) progress = target
      render()

      frame = progress === target ? null : requestAnimationFrame(tick)
    }

    const request = () => {
      if (frame !== null) return
      lastTime = performance.now()
      frame = requestAnimationFrame(tick)
    }

    const draw = () => {
      progress = readTarget()
      render()
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
          <path ref={trailRef} d={path} stroke="var(--accent-line)" strokeWidth="1.5" />
          <g ref={ballRef} opacity="0">
            <circle r="7" fill="var(--accent)" />
            <path
              d="M-4.8 -4.8c2.6 2.6 2.6 7 0 9.6M4.8 -4.8c-2.6 2.6-2.6 7 0 9.6"
              stroke="var(--on-accent)"
              strokeWidth="0.8"
            />
          </g>
          <g transform={`translate(${end.x} ${end.y - 12})`}>
            <g
              ref={bubbleRef}
              data-active="false"
              className="origin-bottom scale-0 opacity-0 transition-[scale,opacity] duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)] [transform-box:fill-box] data-[active=true]:scale-100 data-[active=true]:opacity-100"
            >
              {CLOUD_PUFFS.map(([cx, cy, r]) => (
                <circle key={`edge-${cx}-${cy}`} cx={cx} cy={cy} r={r + 1.5} fill="var(--cloud-edge)" />
              ))}
              {CLOUD_PUFFS.map(([cx, cy, r]) => (
                <circle key={`fill-${cx}-${cy}`} cx={cx} cy={cy} r={r} fill="var(--cloud)" />
              ))}
              <text
                y="-48"
                textAnchor="middle"
                dominantBaseline="middle"
                fill="var(--on-accent)"
                className="font-display text-2xl font-bold"
              >
                ¡ACEEE!
              </text>
            </g>
            <g ref={confettiRef} />
          </g>
        </svg>
      ) : null}
    </div>
  )
}
