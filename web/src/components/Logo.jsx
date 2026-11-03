export default function Logo({ size = 30, withWordmark = true, className = '' }) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <svg width={size} height={size} viewBox="0 0 30 30" aria-hidden="true">
        <path
          d="M3 25h24"
          stroke="var(--faint)"
          strokeWidth="2"
          strokeLinecap="round"
        />
        <ellipse cx="15" cy="24.6" rx="6" ry="1.6" fill="var(--series1)" />
        <circle cx="15" cy="12" r="7.5" fill="var(--accent)" />
        <path
          d="M9.6 7.4c2.9 2.4 2.9 6.8 0 9.2M20.4 7.4c-2.9 2.4-2.9 6.8 0 9.2"
          stroke="var(--on-accent)"
          strokeWidth="1.4"
          fill="none"
        />
      </svg>
      {withWordmark ? (
        <span className="font-display text-2xl leading-none font-bold tracking-wide text-text">
          AceCam
        </span>
      ) : null}
    </span>
  )
}
