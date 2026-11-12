export default function PelotaTitulo() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 30 30"
      className="ml-[0.08em] inline-block size-[0.3em] align-baseline"
    >
      <circle
        cx="15"
        cy="15"
        r="14"
        fill="var(--accent)"
        stroke="var(--accent-line)"
        strokeWidth="1"
      />
      <path
        d="M4.6 6.2c5.4 4.7 5.4 12.9 0 17.6M25.4 6.2c-5.4 4.7-5.4 12.9 0 17.6"
        stroke="var(--on-accent)"
        strokeWidth="2.2"
        fill="none"
      />
    </svg>
  )
}
