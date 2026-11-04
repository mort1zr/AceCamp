import { createContext, useContext, useEffect, useState } from 'react'

const CLAVE = 'acecam-lang'

const titulos = {
  es: 'AceCam · Estadísticas de tenis a partir de tus videos',
  en: 'AceCam · Tennis stats from your videos',
}

const IdiomaContexto = createContext({ idioma: 'es', cambiarIdioma: () => {} })

function leerIdioma() {
  try {
    return localStorage.getItem(CLAVE) === 'en' ? 'en' : 'es'
  } catch {
    return 'es'
  }
}

export function IdiomaProvider({ children }) {
  const [idioma, setIdioma] = useState(leerIdioma)

  useEffect(() => {
    document.documentElement.lang = idioma
    document.title = titulos[idioma]
    try {
      localStorage.setItem(CLAVE, idioma)
    } catch {
      return
    }
  }, [idioma])

  const cambiarIdioma = () => setIdioma((actual) => (actual === 'es' ? 'en' : 'es'))

  return <IdiomaContexto value={{ idioma, cambiarIdioma }}>{children}</IdiomaContexto>
}

export function useIdioma() {
  return useContext(IdiomaContexto)
}

export function useTextos(textos) {
  return textos[useIdioma().idioma]
}
