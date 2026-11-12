const escala = (valor, bajo, alto) => {
  if (typeof valor !== 'number' || !Number.isFinite(valor)) return null
  return Math.round(Math.min(99, Math.max(30, 40 + ((valor - bajo) / (alto - bajo)) * 59)))
}

export const PESO_METRICAS = 0.86

export function valoracionJugador(player, metrics) {
  const partidos = metrics?.analyzedMatches
  const porPartido = (total) =>
    typeof total === 'number' && partidos > 0 ? total / partidos : null
  const dobles = porPartido(metrics?.doubleFaults)
  const primer = escala(metrics?.firstServeInRate, 35, 70)
  const control = dobles == null ? null : Math.round(Math.min(99, Math.max(30, 99 - dobles * 8)))
  const mente = [primer, control].filter((valor) => valor != null)
  const atributos = [
    {
      clave: 'SER',
      nombre: 'Saque',
      icono: 'saque',
      valor: escala(metrics?.averageServeSpeed, 110, 180),
    },
    {
      clave: 'GOL',
      nombre: 'Golpe',
      icono: 'golpe',
      valor: escala(metrics?.averageShotSpeed, 75, 120),
    },
    {
      clave: 'MOV',
      nombre: 'Movimiento',
      icono: 'movimiento',
      valor: escala(porPartido(metrics?.distanceMeters), 1200, 2500),
    },
    {
      clave: 'MEN',
      nombre: 'Consistencia',
      icono: 'mente',
      valor: mente.length ? Math.round(mente.reduce((a, b) => a + b, 0) / mente.length) : null,
    },
  ]
  const medidos = atributos.filter((atributo) => atributo.valor != null)
  const mediaMetricas = medidos.length
    ? medidos.reduce((suma, atributo) => suma + atributo.valor, 0) / medidos.length
    : null
  const nivel = escala(player?.utr, 4, 16.5)
  const media =
    mediaMetricas == null
      ? null
      : Math.round(
          nivel == null
            ? mediaMetricas
            : mediaMetricas * PESO_METRICAS + nivel * (1 - PESO_METRICAS),
        )
  return { media, atributos, nivel }
}

export function posicionRanking(players, metricasPorId, id) {
  const medias = players.map((player) => ({
    id: player.id,
    media: valoracionJugador(player, metricasPorId?.[player.id]).media,
  }))
  const propia = medias.find((fila) => fila.id === id)?.media
  if (propia == null) return null
  return 1 + medias.filter((fila) => fila.media != null && fila.media > propia).length
}
