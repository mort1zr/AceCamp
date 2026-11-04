export const THEME_KEY = 'acecam-theme'
export const DARK = 'dark'
export const LIGHT = 'light'

export function readStoredTheme() {
  try {
    const stored = localStorage.getItem(THEME_KEY)
    return stored === LIGHT || stored === DARK ? stored : null
  } catch {
    return null
  }
}

export function storeTheme(theme) {
  try {
    localStorage.setItem(THEME_KEY, theme)
  } catch {
    return
  }
}

export function applyTheme(theme) {
  const root = document.documentElement
  if (theme === LIGHT) {
    root.dataset.theme = LIGHT
  } else {
    delete root.dataset.theme
  }
}

export function resolveInitialTheme() {
  return readStoredTheme() ?? DARK
}
