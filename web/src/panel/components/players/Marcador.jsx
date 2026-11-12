export default function Marcador({ value }) {
  if (!value) return '—'
  const sets = String(value).trim().split(/\s+/)
  return (
    <span className="players-marcador" aria-label={`Resultado ${value}`}>
      {sets.map((set, index) => {
        const [juegos, desempate] = set.split(/[()]/)
        return (
          <span key={`${set}-${index}`} className="players-set" aria-hidden="true">
            {juegos}
            {desempate && <sup>{desempate}</sup>}
          </span>
        )
      })}
    </span>
  )
}
