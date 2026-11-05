import { useEffect, useRef, useState } from 'react'
import { rallyLocal } from '../lib/rallyLocal.js'
import { createTrack } from '../lib/track.js'

const GUTTER = 32
const CROSSING = 200
const BALL_START_SCALE = 3.2
const BALL_SHRINK_UNTIL = 0.07
const SMOOTHING = 0.35
const STICKY_TOP = 64
const BUBBLE_SHIFT = 30
const BUBBLE_LIFT = 17
const MIN_CROSSING = 40
const END_APPROACH = 180
const END_MARGIN = 30
const RESUME_EASE = 320
const TAIL = 420
const TAIL_STEPS = 90
const TAIL_STROKE = 1.8
const GUIDE_STROKE = 1.5
const GUIDE_STEP = 6
const BALL_VIEWPORT_POSITION = 0.5
const END_INSET = 170
const END_LIFT = 170
const ARRIVED_WITHIN = 6
const END_MARK = 7
const END_LEAD = 230
const LEAD_RAMP = 260
const FRAME_MS = 1000 / 60

function buildRally(width, height, start, boundaries, gap, reachable) {
  const sides = [width - GUTTER, GUTTER]
  let side = 1
  let y = start.y + 220
  const track = createTrack(start.x, start.y).quad(sides[side], start.y, sides[side], y)
  let pending = boundaries
  if (gap) {
    track.line(sides[side], gap.from).move(gap.resumeX, gap.resumeY)
    y = gap.resumeY
    if (boundaries.length) {
      const [first, ...rest] = boundaries
      side = 1 - side
      const toX = sides[side]
      const landing = first + CROSSING
      track.cubic(gap.resumeX, y + (landing - y) * 0.55, toX, first, toX, landing)
      y = landing
      pending = rest
    }
  }

  for (const boundary of pending) {
    const reach = Math.max(MIN_CROSSING, Math.min(CROSSING, boundary - y))
    const fromX = sides[side]
    side = 1 - side
    const toX = sides[side]
    const middleX = (fromX + toX) / 2
    if (boundary - reach > y) track.line(fromX, boundary - reach)
    track
      .cubic(fromX, boundary, middleX, boundary - reach, middleX, boundary)
      .cubic(middleX, boundary + reach, toX, boundary, toX, boundary + reach)
    y = boundary + reach
  }

  const end = {
    x: side === 0 ? width - END_INSET : END_INSET,
    y: Math.max(Math.min(height - END_LIFT, reachable - END_MARGIN), y + MIN_CROSSING),
  }
  const fromX = sides[side]
  if (end.y - END_APPROACH > y) track.line(fromX, end.y - END_APPROACH)
  track.quad(fromX, end.y, end.x, end.y)

  return { end, track: track.finish() }
}

const CLOUD_PUFFS = [
  [-44, -46, 20],
  [-20, -62, 24],
  [12, -64, 24],
  [42, -48, 20],
  [0, -40, 24],
  [-26, -34, 18],
  [26, -34, 18],
  [14, -7, 5],
  [22, 2, 3],
]

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
          {
            transform: `translate(${x}px, ${y}px) rotate(${spin / 2}deg)`,
            opacity: 1,
            offset: 0.55,
          },
          { transform: `translate(${x * 1.15}px, ${y + 120}px) rotate(${spin}deg)`, opacity: 0 },
        ],
        { duration: 1300 + Math.random() * 500, easing: 'cubic-bezier(0.2, 0.7, 0.3, 1)' },
      )
      .finished.then(() => piece.remove())
  }
}

export default function RallyThread() {
  const hostRef = useRef(null)
  const ballRef = useRef(null)
  const bubbleRef = useRef(null)
  const bubbleAnchorRef = useRef(null)
  const confettiRef = useRef(null)
  const gapRef = useRef(null)
  const tailRef = useRef(null)
  const [canvas, setCanvas] = useState(null)

  useEffect(() => {
    const host = hostRef.current
    const rebuild = () => {
      const width = host.clientWidth
      const height = host.clientHeight
      if (!width || !height) return
      const parent = host.parentElement
      const hostRect = host.getBoundingClientRect()
      const court = parent.querySelector('[data-rally-start]').getBoundingClientRect()
      const start = {
        x: court.left - hostRect.left + court.width * 0.26,
        y: court.top - hostRect.top + court.height * 0.84,
      }
      const sections = [...parent.querySelectorAll(':scope > section')]
      const boundaries = sections.slice(2).map((section) => section.offsetTop)
      const pin = parent.querySelector('[data-rally-pin][data-pinned="true"]')
      const end = rallyLocal.end
      const viewHeight = window.innerHeight
      const pinBottom = pin ? pin.offsetTop + pin.offsetHeight : 0
      const gap =
        pin && end
          ? {
              from: pin.offsetTop - STICKY_TOP + viewHeight * BALL_VIEWPORT_POSITION,
              to: pinBottom - viewHeight * BALL_VIEWPORT_POSITION,
              pinBottom,
              endView: STICKY_TOP + end.y,
              resumeX: end.x - hostRect.left,
              resumeY: pinBottom - (viewHeight - STICKY_TOP) + end.y,
            }
          : null
      gapRef.current = gap
      const hostTop = hostRect.top + window.scrollY
      const reachable =
        document.documentElement.scrollHeight - viewHeight * (1 - BALL_VIEWPORT_POSITION) - hostTop
      setCanvas({
        width,
        height,
        ...buildRally(width, height, start, boundaries, gap, reachable),
      })
    }

    const observer = new ResizeObserver(rebuild)
    observer.observe(host)
    window.addEventListener('rally:layout', rebuild)
    return () => {
      observer.disconnect()
      window.removeEventListener('rally:layout', rebuild)
    }
  }, [])

  const rally = canvas?.track
  const end = canvas?.end

  useEffect(() => {
    const ball = ballRef.current
    if (!rally || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    const sampler = rally
    const total = sampler.total
    let frame = null
    let progress = null
    let arrived = false
    let lastTime = 0

    const followY = (hostTop) => {
      const viewHeight = window.innerHeight
      let position = viewHeight * BALL_VIEWPORT_POSITION
      const gap = gapRef.current
      if (gap) {
        const past = viewHeight - gap.pinBottom - hostTop
        if (past >= 0 && past < RESUME_EASE) {
          const mix = past / RESUME_EASE
          const eased = mix * mix * (3 - 2 * mix)
          position = gap.endView + (position - gap.endView) * eased
        }
      }
      return position - hostTop
    }

    const readTarget = () => {
      const targetY = followY(hostRef.current.getBoundingClientRect().top)
      const mix = Math.min(Math.max((targetY - (end.y - END_LEAD - LEAD_RAMP)) / LEAD_RAMP, 0), 1)
      return sampler.lengthAtY(targetY + END_LEAD * mix * mix * (3 - 2 * mix)) / total
    }

    const tail = tailRef.current
    const brush = tail.getContext('2d')
    let tailColor = getComputedStyle(tail).color
    let guideColor = getComputedStyle(tail).getPropertyValue('--line3')
    const themeWatcher = new MutationObserver(() => {
      tailColor = getComputedStyle(tail).color
      guideColor = getComputedStyle(tail).getPropertyValue('--line3')
      request()
    })
    themeWatcher.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme'],
    })

    const paintTail = (target) => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      const width = Math.round(tail.clientWidth * dpr)
      const height = Math.round(tail.clientHeight * dpr)
      if (tail.width !== width || tail.height !== height) {
        tail.width = width
        tail.height = height
      }

      brush.clearRect(0, 0, width, height)

      if (!target.local) {
        brush.setLineDash([3 * dpr, 9 * dpr])
        brush.lineWidth = GUIDE_STROKE * dpr
        brush.lineCap = 'butt'
        brush.strokeStyle = guideColor
        brush.beginPath()
        let last = target.sample(target.length)
        let complete = true
        brush.moveTo(last.x * dpr, last.y * dpr)
        for (let at = target.length + GUIDE_STEP; at <= total; at += GUIDE_STEP) {
          const point = target.sample(at)
          if (Math.hypot(point.x - last.x, point.y - last.y) > GUIDE_STEP * 3) {
            complete = false
            break
          }
          brush.lineTo(point.x * dpr, point.y * dpr)
          last = point
          if (point.y > window.innerHeight + 40) {
            complete = false
            break
          }
        }
        brush.stroke()
        brush.setLineDash([])

        if (complete && total - target.length > ARRIVED_WITHIN) {
          const mark = target.sample(total)
          brush.lineWidth = GUIDE_STROKE * 1.6 * dpr
          brush.lineCap = 'round'
          brush.beginPath()
          brush.moveTo((mark.x - END_MARK) * dpr, (mark.y - END_MARK) * dpr)
          brush.lineTo((mark.x + END_MARK) * dpr, (mark.y + END_MARK) * dpr)
          brush.moveTo((mark.x + END_MARK) * dpr, (mark.y - END_MARK) * dpr)
          brush.lineTo((mark.x - END_MARK) * dpr, (mark.y + END_MARK) * dpr)
          brush.stroke()
        }
      }

      brush.lineWidth = TAIL_STROKE * dpr
      brush.lineCap = 'round'
      brush.strokeStyle = tailColor

      let previous = null
      for (let step = 0; step <= TAIL_STEPS; step += 1) {
        const at = target.length - TAIL + (step / TAIL_STEPS) * TAIL
        if (at < 0) continue
        const point = target.sample(at)
        const jump = previous && Math.hypot(point.x - previous.x, point.y - previous.y) > TAIL / 6
        if (previous && !jump) {
          const fade = step / TAIL_STEPS
          brush.globalAlpha = fade * fade * (3 - 2 * fade)
          brush.beginPath()
          brush.moveTo(previous.x * dpr, previous.y * dpr)
          brush.lineTo(point.x * dpr, point.y * dpr)
          brush.stroke()
        }
        previous = point
      }
      brush.globalAlpha = 1
    }

    const readBallTarget = () => {
      const host = hostRef.current.getBoundingClientRect()
      const gap = gapRef.current
      const local = document.querySelector('[data-rally-local]')
      const pinnedY = window.innerHeight * BALL_VIEWPORT_POSITION - host.top

      if (gap && local && rallyLocal.track && pinnedY > gap.from && pinnedY < gap.to) {
        const length = Number(local.dataset.length) || 0
        const localPath = rallyLocal.track
        const point = localPath.pointAt(length)
        const box = local.ownerSVGElement.getBoundingClientRect()
        return {
          x: box.left + point.x - host.left,
          y: box.top + point.y - host.top,
          local: true,
          length,
          sample: (at) => {
            const p = localPath.pointAt(at)
            return { x: box.left + p.x, y: box.top + p.y }
          },
        }
      }

      const point = sampler.pointAt(total * progress)
      return {
        x: point.x,
        y: point.y,
        local: false,
        length: total * progress,
        sample: (at) => {
          const p = sampler.pointAt(at)
          return { x: host.left + p.x, y: host.top + p.y }
        },
      }
    }

    const render = () => {
      const target = readBallTarget()

      const shrink = Math.min(progress / BALL_SHRINK_UNTIL, 1)
      const scale = BALL_START_SCALE + (1 - BALL_START_SCALE) * shrink

      paintTail(target)
      ball.setAttribute('transform', `translate(${target.x} ${target.y}) scale(${scale})`)
      ball.style.opacity = 1
      const nowArrived = total - total * progress <= ARRIVED_WITHIN
      if (nowArrived && !arrived) burstConfetti(confettiRef.current)
      arrived = nowArrived
      bubbleRef.current.dataset.active = String(arrived)
      bubbleAnchorRef.current.setAttribute('transform', `translate(${target.x - BUBBLE_SHIFT} ${target.y - BUBBLE_LIFT})`)
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
    window.addEventListener('rally:local', request)

    return () => {
      window.removeEventListener('scroll', request)
      window.removeEventListener('resize', request)
      window.removeEventListener('rally:local', request)
      themeWatcher.disconnect()
      if (frame !== null) cancelAnimationFrame(frame)
    }
  }, [rally, end])

  return (
    <div
      ref={hostRef}
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 hidden overflow-hidden xl:block"
    >
      <canvas ref={tailRef} className="fixed inset-0 size-full text-accent-line" />
      {canvas ? (
        <svg width={canvas.width} height={canvas.height} fill="none" className="absolute inset-0">
          <g ref={ballRef} opacity="0">
            <circle r="7" fill="var(--accent)" />
            <path
              d="M-4.8 -4.8c2.6 2.6 2.6 7 0 9.6M4.8 -4.8c-2.6 2.6-2.6 7 0 9.6"
              stroke="var(--on-accent)"
              strokeWidth="0.8"
            />
          </g>
          <g ref={bubbleAnchorRef} transform={`translate(${end.x} ${end.y - 12})`}>
            <g
              ref={bubbleRef}
              data-active="false"
              className="origin-bottom scale-0 opacity-0 transition-[scale,opacity] duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)] [transform-box:fill-box] data-[active=true]:scale-100 data-[active=true]:opacity-100"
            >
              {CLOUD_PUFFS.map(([cx, cy, r]) => (
                <circle
                  key={`edge-${cx}-${cy}`}
                  cx={cx}
                  cy={cy}
                  r={r + 1.5}
                  fill="var(--cloud-edge)"
                />
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
