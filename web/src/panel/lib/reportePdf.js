export function iniciales(nombre = '') {
  return nombre
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((palabra) => palabra[0])
    .join('')
}

export function nombreArchivo(...partes) {
  return ['AceCam', ...partes]
    .filter(Boolean)
    .join(' - ')
    .replace(/[\\/:*?"<>|]/g, '')
}

export function setsDelMarcador(resultado) {
  if (typeof resultado !== 'string') return []
  return resultado
    .trim()
    .split(/[\s,;]+/)
    .map((parcial) => parcial.match(/^(\d{1,2})[-–](\d{1,2})(?:\((\d{1,2})\))?$/))
    .filter(Boolean)
    .map(([, propios, rival, tiebreak]) => ({
      propios: Number(propios),
      rival: Number(rival),
      tiebreak,
    }))
}
