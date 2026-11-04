import { createContext, useContext } from 'react'

export const EntradaContexto = createContext(null)

export const PELOTA_PX = 112

export function useEntrada() {
  return useContext(EntradaContexto)
}
