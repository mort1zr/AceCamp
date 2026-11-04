const heatCells = [0.1, 0.25, 0.4, 0.2, 0.3, 0.7, 1, 0.5, 0.2, 0.6, 0.85, 0.35, 0.1, 0.2, 0.3, 0.15]

export function BallTile() {
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

export function SpeedTile() {
  return (
    <div className="text-center">
      <p className="font-display text-4xl leading-none font-bold text-electric-ink">184</p>
      <p className="mt-1 text-xs text-muted">km/h</p>
    </div>
  )
}

export function ScoreTile() {
  return (
    <div className="text-center">
      <p className="text-xs text-muted">Set 1</p>
      <p className="mt-1 font-display text-4xl leading-none font-bold text-text">6-4</p>
    </div>
  )
}

export function CourtTile() {
  return (
    <svg width="52" height="73" viewBox="0 0 60 84" fill="none" aria-hidden="true">
      <path
        d="M4 4h52v76H4zM14 4v76M46 4v76M14 24h32M14 60h32M30 24v36M4 42h52"
        stroke="var(--electric)"
        strokeWidth="1.5"
      />
      <circle cx="21" cy="16" r="3" fill="var(--accent-line)" />
      <circle cx="39" cy="31" r="3" fill="var(--series1)" />
      <circle cx="24" cy="68" r="3" fill="var(--series2)" />
    </svg>
  )
}

export function HeatTile() {
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

export function LensTile() {
  return (
    <span className="grid size-16 place-content-center rounded-full bg-text">
      <span className="grid size-9 place-content-center rounded-full border-4 border-line3 bg-bg">
        <span className="size-2 rounded-full bg-series1" />
      </span>
    </span>
  )
}
