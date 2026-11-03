export default function AppFrame({ label, ratio = 'aspect-[16/10]', className = '' }) {
  return (
    <div
      className={`overflow-hidden rounded-card border border-line bg-surface shadow-none ${className}`}
    >
      <div className="flex items-center gap-1.5 border-b border-line bg-surface2 px-4 py-3">
        <span className="size-2.5 rounded-full bg-line3" />
        <span className="size-2.5 rounded-full bg-line3" />
        <span className="size-2.5 rounded-full bg-line3" />
        <span className="ml-3 truncate font-display text-xs tracking-widest text-muted uppercase">
          AceCam
        </span>
      </div>
      <div
        className={`${ratio} grid place-content-center gap-2 bg-bg px-6 text-center`}
      >
        <p className="font-display text-sm tracking-[0.2em] text-muted uppercase">{label}</p>
        <p className="text-xs text-placeholder">Captura pendiente</p>
      </div>
    </div>
  )
}
