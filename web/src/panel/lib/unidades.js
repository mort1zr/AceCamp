export const CLAVE_UNIDADES = 'acecam-unidades'
export const EVENTO_UNIDADES = 'acecam-unidades'
const KMH_A_MPH = 0.621371

export function leerUnidades() {
  try {
    return localStorage.getItem(CLAVE_UNIDADES) === 'mph' ? 'mph' : 'kmh'
  } catch {
    return 'kmh'
  }
}

export function guardarUnidades(unidades) {
  try {
    localStorage.setItem(CLAVE_UNIDADES, unidades === 'mph' ? 'mph' : 'kmh')
  } catch {
    return
  }
  window.dispatchEvent(new Event(EVENTO_UNIDADES))
}

export function convertirVelocidad(kmh, unidades) {
  if (typeof kmh !== 'number' || !Number.isFinite(kmh)) return kmh
  return unidades === 'mph' ? kmh * KMH_A_MPH : kmh
}

export function etiquetaVelocidad(unidades) {
  return unidades === 'mph' ? 'mph' : 'km/h'
}
