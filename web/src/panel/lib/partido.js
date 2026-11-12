import { setsDelMarcador } from './reportePdf.js'

function setTerminado({ propios, rival }) {
  const mayor = Math.max(propios, rival)
  const menor = Math.min(propios, rival)
  if (mayor === 7) return menor === 5 || menor === 6
  if (mayor === 6) return menor <= 4
  return mayor >= 10 && mayor - menor >= 2
}

export function resultadoDelPartido(resultado) {
  const sets = setsDelMarcador(resultado)
  if (sets.length === 0 || !sets.every(setTerminado)) return null
  const ganados = sets.filter((set) => set.propios > set.rival).length
  const perdidos = sets.length - ganados
  if (ganados === perdidos) return null
  return ganados > perdidos ? 'gano' : 'perdio'
}
