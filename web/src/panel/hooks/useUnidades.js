import { useSyncExternalStore } from 'react'
import { EVENTO_UNIDADES, leerUnidades } from '../lib/unidades.js'

function suscribir(aviso) {
  window.addEventListener(EVENTO_UNIDADES, aviso)
  window.addEventListener('storage', aviso)
  return () => {
    window.removeEventListener(EVENTO_UNIDADES, aviso)
    window.removeEventListener('storage', aviso)
  }
}

export function useUnidades() {
  return useSyncExternalStore(suscribir, leerUnidades, () => 'kmh')
}
