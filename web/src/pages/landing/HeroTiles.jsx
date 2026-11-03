import { useRef } from 'react'
import { useScrollSpring } from '../../hooks/useScrollSpring.js'

const heatCells = [0.1, 0.25, 0.4, 0.2, 0.3, 0.7, 1, 0.5, 0.2, 0.6, 0.85, 0.35, 0.1, 0.2, 0.3, 0.15]

function BallTile() {
  return (
    <svg width="58" height="58" viewBox="0 0 30 30" aria-hidden="true">
      <circle cx="15" cy="15" r="13" fill="var(--accent)" />
      <path
        d="M6 7c5 4.2 5 11.8 0 16M24 7c-5 4.2-5 11.8 0 16"
        stroke="var(--on-accent)"
        strokeWidth="1.5"
        fill="none"
      />
    </svg>
  )
}

function SpeedTile() {
  return (
    <div className="text-center">
      <p className="font-display text-4xl leading-none font-bold text-text">184</p>
      <p className="mt-1 text-xs text-muted">km/h</p>
    </div>
  )
}

function ScoreTile() {
  return (
    <div className="text-center">
      <p className="text-xs text-muted">Set 1</p>
      <p className="mt-1 font-display text-4xl leading-none font-bold text-text">6-4</p>
    </div>
  )
}

function CourtTile() {
  return (
    <svg width="60" height="84" viewBox="0 0 60 84" fill="none" aria-hidden="true">
      <path
        d="M4 4h52v76H4zM14 4v76M46 4v76M14 24h32M14 60h32M30 24v36M4 42h52"
        stroke="var(--line3)"
        strokeWidth="1.5"
      />
      <circle cx="21" cy="16" r="3" fill="var(--accent-line)" />
      <circle cx="39" cy="31" r="3" fill="var(--series1)" />
      <circle cx="24" cy="68" r="3" fill="var(--series2)" />
    </svg>
  )
}

function HeatTile() {
  return (
    <div className="grid grid-cols-4 gap-1">
      {heatCells.map((intensity, index) => (
        <span
          key={index}
          className="size-3 rounded-[3px] bg-accent-line"
          style={{ opacity: 0.12 + intensity * 0.85 }}
        />
      ))}
    </div>
  )
}

function LensTile() {
  return (
    <span className="grid size-16 place-content-center rounded-full bg-text">
      <span className="grid size-9 place-content-center rounded-full border-4 border-line3 bg-bg">
        <span className="size-2 rounded-full bg-series1" />
      </span>
    </span>
  )
}

const tiles = [
  { Content: LensTile, place: 'top-2 left-6 size-28 -rotate-6', delay: 0, to: [200, 480] },
  { Content: SpeedTile, place: 'top-64 left-20 size-28 rotate-6', delay: 1400, to: [110, 240] },
  { Content: HeatTile, place: 'top-[27rem] -left-4 size-32 -rotate-3', delay: 2600, to: [220, 170] },
  { Content: BallTile, place: 'top-6 right-8 size-28 rotate-6', delay: 800, to: [-200, 440] },
  { Content: ScoreTile, place: 'top-64 right-16 size-28 -rotate-6', delay: 2000, to: [-90, 190] },
  { Content: CourtTile, place: 'top-[26rem] -right-4 size-32 rotate-3', delay: 3200, to: [-240, 170] },
]

export default function HeroTiles() {
  const ref = useRef(null)
  useScrollSpring(ref, { start: 120, end: 620 })

  return (
    <div
      ref={ref}
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 z-10 hidden xl:block"
    >
      {tiles.map(({ Content, place, delay, to: [x, y] }) => (
        <div
          key={place}
          className={`absolute will-change-transform ${place}`}
          style={{
            translate: `calc(var(--scroll-progress, 0) * ${x}px) calc(var(--scroll-progress, 0) * ${y}px)`,
          }}
        >
          <div
            style={{ animationDelay: `${delay}ms` }}
            className="grid size-full place-content-center rounded-3xl border border-line2 bg-surface shadow-tile motion-safe:animate-float"
          >
            <Content />
          </div>
        </div>
      ))}
    </div>
  )
}
