import { useCallback, useEffect, useState } from 'react'
import { DARK, LIGHT, applyTheme, resolveInitialTheme, storeTheme } from '../lib/theme.js'

export function useTheme() {
  const [theme, setTheme] = useState(resolveInitialTheme)

  useEffect(() => {
    applyTheme(theme)
    storeTheme(theme)
  }, [theme])

  const toggleTheme = useCallback(() => {
    setTheme((current) => (current === LIGHT ? DARK : LIGHT))
  }, [])

  return { theme, toggleTheme, isLight: theme === LIGHT }
}
