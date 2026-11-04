export function TrazoVacio({ children, size = 22 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="shrink-0"
    >
      {children}
    </svg>
  )
}

export default function BloqueVacio({ icono, titulo, texto, children, className = '' }) {
  return (
    <div
      className={`relative isolate flex flex-col items-center justify-center gap-3 overflow-hidden rounded-xl border border-dashed border-line2 px-6 py-8 text-center ${className}`}
    >
      <svg
        aria-hidden="true"
        viewBox="0 0 200 100"
        preserveAspectRatio="xMidYMid slice"
        className="absolute inset-0 -z-10 size-full text-line opacity-60"
        fill="none"
        stroke="currentColor"
        strokeWidth="0.6"
      >
        <rect x="20" y="12" width="160" height="76" />
        <path d="M20 22h160M20 78h160M100 12v76M55 22v56M145 22v56M55 50h90" />
      </svg>
      <span className="grid size-12 place-items-center rounded-full border border-line2 bg-surface text-electric-ink">
        <TrazoVacio>{icono}</TrazoVacio>
      </span>
      <div>
        <p className="font-semibold">{titulo}</p>
        {texto && <p className="mx-auto mt-1 max-w-[36ch] text-[13px] text-muted">{texto}</p>}
      </div>
      {children}
    </div>
  )
}
