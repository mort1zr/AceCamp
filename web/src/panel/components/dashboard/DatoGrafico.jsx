export const tarjetaGrafico = 'rounded-card border border-line bg-surface p-5 min-w-0'
export const tituloGrafico = 'font-display text-[22px] leading-tight font-bold tracking-[0.01em]'

export function DatoGrafico({ etiqueta, children, className = '' }) {
  return (
    <div className={`rounded-xl bg-surface2 px-3.5 py-3 ${className}`}>
      <dt className="text-[11px] font-semibold tracking-[0.08em] text-muted uppercase">
        {etiqueta}
      </dt>
      <dd className="mt-1 font-display text-[28px] leading-none font-bold tabular-nums">
        {children}
      </dd>
    </div>
  )
}

export function Unidad({ children }) {
  return <span className="ml-1 font-sans text-[13px] font-semibold text-muted">{children}</span>
}
