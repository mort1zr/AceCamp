import { useRef } from 'react'
import { useScrollSpring } from '../hooks/useScrollSpring.js'
import {
  BallTile,
  CourtTile,
  Ficha,
  HeatTile,
  LensTile,
  ScoreTile,
  SpeedTile,
} from '../components/TileArt.jsx'

const tiles = [
  { Content: LensTile, place: 'top-[6%] left-12 size-28 -rotate-6', delay: 0, to: [300, 720] },
  {
    Content: SpeedTile,
    place: 'top-[37%] left-20 size-28 rotate-6 [@media(max-height:720px)]:hidden',
    delay: 1400,
    to: [210, 540],
  },
  {
    Content: HeatTile,
    place: 'bottom-[6%] left-12 size-28 -rotate-3',
    delay: 2600,
    to: [280, 380],
  },
  { Content: BallTile, place: 'top-[6%] right-12 size-28 rotate-6', delay: 800, to: [-300, 720] },
  {
    Content: ScoreTile,
    place: 'top-[37%] right-20 size-28 -rotate-6 [@media(max-height:720px)]:hidden',
    delay: 2000,
    to: [-210, 540],
  },
  {
    Content: CourtTile,
    place: 'bottom-[6%] right-12 size-28 rotate-3',
    delay: 3200,
    to: [-280, 380],
  },
]

export default function HeroTiles() {
  const ref = useRef(null)
  useScrollSpring(ref, { start: 80, end: 700 })

  return (
    <div
      ref={ref}
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 z-10 hidden min-[1200px]:block"
    >
      {tiles.map(({ Content, place, delay, to: [x, y] }) => (
        <Ficha
          key={place}
          Contenido={Content}
          lugar={place}
          demora={delay}
          className="size-full"
          estilo={{
            translate: `calc(var(--scroll-progress, 0) * ${x}px) calc(var(--scroll-progress, 0) * ${y}px)`,
            scale: 'calc(1 - var(--scroll-progress, 0) * 0.5)',
          }}
        />
      ))}
    </div>
  )
}
