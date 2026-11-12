import { dashboardMetricDefinitions, isDashboardMetricValue } from './dashboardOverview.js'
import { convertirVelocidad, etiquetaVelocidad } from './unidades.js'

const finito = (valor) => (Number.isFinite(valor) && valor >= 0 ? valor : null)
const mayor = (...valores) => {
  const validos = valores.map(finito).filter((valor) => valor != null)
  return validos.length ? Math.max(...validos) : null
}
const metrica = (clave) => dashboardMetricDefinitions.find((definicion) => definicion.key === clave)
const deMetrica = (clave) => (datos) => {
  const definicion = metrica(clave)
  const valor = datos?.metrics?.[clave]
  return isDashboardMetricValue(definicion, valor) ? valor : null
}

const SECCIONES = [
  {
    titulo: 'Saque',
    filas: [
      {
        clave: 'saqueMasRapido',
        etiqueta: 'Saque más rápido',
        velocidad: true,
        extra: true,
        valor: (d) => mayor(d?.details?.serve?.first?.maxSpeedKmh, d?.details?.serve?.second?.maxSpeedKmh),
      },
      { clave: 'averageServeSpeed', etiqueta: 'Velocidad media de saque', velocidad: true, valor: deMetrica('averageServeSpeed') },
      {
        clave: 'primerSaquePromedio',
        etiqueta: 'Primer saque promedio',
        velocidad: true,
        extra: true,
        valor: (d) => finito(d?.details?.serve?.first?.averageSpeedKmh),
      },
      { clave: 'firstServeInRate', etiqueta: 'Primer saque dentro', unidad: '%', valor: deMetrica('firstServeInRate') },
      {
        clave: 'doblesPorPartido',
        etiqueta: 'Dobles faltas por partido',
        menorEsMejor: true,
        valor: (d) => {
          const faltas = deMetrica('doubleFaults')(d)
          const partidos = deMetrica('analyzedMatches')(d)
          return faltas != null && partidos > 0 ? faltas / partidos : null
        },
      },
    ],
  },
  {
    titulo: 'Golpes de fondo',
    filas: [
      { clave: 'averageShotSpeed', etiqueta: 'Velocidad media de golpe', velocidad: true, valor: deMetrica('averageShotSpeed') },
      {
        clave: 'golpeMasRapido',
        etiqueta: 'Golpe más rápido',
        velocidad: true,
        extra: true,
        valor: (d) => finito(d?.details?.shots?.maxSpeedKmh),
      },
      { clave: 'measuredShots', etiqueta: 'Golpes medidos', valor: deMetrica('measuredShots') },
    ],
  },
  {
    titulo: 'Peloteos',
    filas: [
      {
        clave: 'peloteoPromedio',
        etiqueta: 'Peloteo promedio',
        unidad: 'golpes',
        extra: true,
        valor: (d) => finito(d?.details?.rallies?.averageShots),
      },
      {
        clave: 'peloteoMasLargo',
        etiqueta: 'Peloteo más largo',
        unidad: 'golpes',
        extra: true,
        valor: (d) => finito(d?.details?.rallies?.longestShots),
      },
    ],
  },
  {
    titulo: 'Movimiento',
    filas: [
      {
        clave: 'distanciaPorPartido',
        etiqueta: 'Distancia por partido',
        unidad: 'm',
        extra: true,
        valor: (d) => finito(d?.details?.movement?.distancePerMatch),
      },
      {
        clave: 'velocidadMaxMov',
        etiqueta: 'Velocidad máxima',
        velocidad: true,
        extra: true,
        valor: (d) => finito(d?.details?.movement?.maxSpeedKmh),
      },
      {
        clave: 'velocidadMediaMov',
        etiqueta: 'Velocidad promedio',
        velocidad: true,
        extra: true,
        valor: (d) => finito(d?.details?.movement?.averageSpeedKmh),
      },
    ],
  },
  {
    titulo: 'Volumen de datos',
    filas: [{ clave: 'analyzedMatches', etiqueta: 'Partidos analizados', valor: deMetrica('analyzedMatches') }],
  },
]

export function filasDeComparacion(resumenes, unidades) {
  const cargando = resumenes.some((resumen) => resumen.status === 'loading')
  return SECCIONES.map((seccion) => ({
    titulo: seccion.titulo,
    filas: seccion.filas
      .map((fila) => {
        const valores = resumenes.map((resumen) => {
          if (resumen.status !== 'ready') return null
          const valor = fila.valor(resumen.data)
          if (valor == null) return null
          return Number((fila.velocidad ? convertirVelocidad(valor, unidades) : valor).toFixed(1))
        })
        const comparables = valores.filter((valor) => valor !== null)
        const mejor =
          !cargando && comparables.length >= 2
            ? fila.menorEsMejor
              ? Math.min(...comparables)
              : Math.max(...comparables)
            : null
        return {
          clave: fila.clave,
          etiqueta: fila.etiqueta,
          extra: Boolean(fila.extra),
          valores,
          unidad: fila.velocidad ? etiquetaVelocidad(unidades) : fila.unidad,
          mejor,
          empate: mejor !== null && comparables.filter((valor) => valor === mejor).length > 1,
        }
      })
      .filter((fila) => !fila.extra || fila.valores.some((valor) => valor !== null)),
  })).filter((seccion) => seccion.filas.length > 0)
}
