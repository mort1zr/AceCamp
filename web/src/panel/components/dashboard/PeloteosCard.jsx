import { useId } from 'react'
import { Bar, BarChart, CartesianGrid, LabelList, ResponsiveContainer, XAxis } from 'recharts'
import { DatoGrafico, tarjetaGrafico, tituloGrafico, Unidad } from './DatoGrafico.jsx'

const decimal = new Intl.NumberFormat('es-PE', { maximumFractionDigits: 1 })

const TRAMOS = [
  { clave: 'short', etiqueta: 'Cortos (0–4)', fila: '0–4 golpes' },
  { clave: 'medium', etiqueta: 'Medios (5–8)', fila: '5–8 golpes' },
  { clave: 'long', etiqueta: 'Largos (9+)', fila: '9+ golpes' },
]

export default function PeloteosCard({ rallies, playerId }) {
  const id = useId()
  const total = TRAMOS.every(({ clave }) => rallies?.[clave] != null)
    ? TRAMOS.reduce((suma, { clave }) => suma + rallies[clave], 0)
    : null
  const datos = TRAMOS.map(({ clave, etiqueta }) => ({
    etiqueta,
    porcentaje: total > 0 ? (rallies[clave] / total) * 100 : 0,
  }))

  return (
    <section className={`${tarjetaGrafico} flex flex-col gap-4`} aria-labelledby={id}>
      <div>
        <h2 id={id} className={tituloGrafico}>
          Peloteos
        </h2>
        <p className="mt-1 text-[13px] text-muted">
          Distribución por largo · {rallies?.coveredMatches ?? 0} de {rallies?.totalMatches ?? 0}{' '}
          análisis con datos
        </p>
      </div>
      {total > 0 ? (
        <div
          role="img"
          aria-label={`Peloteos: ${datos.map((d) => `${d.etiqueta} ${Math.round(d.porcentaje)}%`).join(', ')}`}
        >
          <ResponsiveContainer
            width="100%"
            height={200}
            minWidth={0}
            initialDimension={{ width: 400, height: 200 }}
          >
            <BarChart data={datos} margin={{ top: 24, right: 8, bottom: 0, left: 8 }}>
              <CartesianGrid vertical={false} stroke="var(--players-line)" />
              <XAxis
                dataKey="etiqueta"
                tick={{ fill: 'var(--players-muted)', fontSize: 12 }}
                axisLine={false}
                tickLine={false}
                interval={0}
              />
              <Bar
                key={playerId}
                dataKey="porcentaje"
                fill="var(--series1)"
                radius={[6, 6, 0, 0]}
                maxBarSize={64}
                isAnimationActive
                animationDuration={700}
                animationEasing="ease-out"
              >
                <LabelList
                  dataKey="porcentaje"
                  position="top"
                  formatter={(valor) => `${Math.round(valor)}%`}
                  fill="var(--text)"
                  fontSize={13}
                  fontWeight={700}
                />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <p className="py-6 text-muted">Sin datos de peloteos para este periodo.</p>
      )}
      <dl className="grid grid-cols-2 gap-2.5">
        <DatoGrafico etiqueta="Peloteo promedio">
          {rallies?.averageShots == null ? 'Sin datos' : decimal.format(rallies.averageShots)}
          {rallies?.averageShots != null && <Unidad>golpes</Unidad>}
        </DatoGrafico>
        <DatoGrafico etiqueta="Peloteo más largo">
          {rallies?.longestShots ?? 'Sin datos'}
          {rallies?.longestShots != null && <Unidad>golpes</Unidad>}
        </DatoGrafico>
      </dl>
      <table className="sr-only">
        <caption>Peloteos: datos del periodo</caption>
        <thead>
          <tr>
            <th scope="col">Categoría</th>
            <th scope="col">Cantidad</th>
          </tr>
        </thead>
        <tbody>
          {TRAMOS.map(({ clave, fila }) => (
            <tr key={clave}>
              <th scope="row">{fila}</th>
              <td>{rallies?.[clave] ?? 'Sin datos'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  )
}
