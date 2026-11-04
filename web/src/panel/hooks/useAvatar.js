import { useCallback, useSyncExternalStore } from 'react'
import { AVATARES } from '../lib/avatares.jsx'

const EVENTO = 'acecam-avatar'

function leer(clave) {
  try {
    const guardado = Number(localStorage.getItem(clave))
    return Number.isInteger(guardado) && guardado >= 0 && guardado < AVATARES.length ? guardado : 0
  } catch {
    return 0
  }
}

function suscribir(aviso) {
  window.addEventListener(EVENTO, aviso)
  window.addEventListener('storage', aviso)
  return () => {
    window.removeEventListener(EVENTO, aviso)
    window.removeEventListener('storage', aviso)
  }
}

export function useAvatar(correo) {
  const clave = `acecam-avatar:${correo ?? ''}`
  const indice = useSyncExternalStore(
    suscribir,
    () => leer(clave),
    () => 0,
  )

  const siguiente = useCallback(() => {
    try {
      localStorage.setItem(clave, String((leer(clave) + 1) % AVATARES.length))
    } catch {
      return
    }
    window.dispatchEvent(new Event(EVENTO))
  }, [clave])

  return { indice, siguiente }
}
