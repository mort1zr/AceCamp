import { isValidBirthDate, localDateString } from './players.js'

export const dashboardPeriods = [
  { value: 'all', label: 'Todo' },
  { value: '1', label: 'Último mes' },
  { value: '3', label: 'Últimos 3 meses' },
  { value: '6', label: 'Últimos 6 meses' },
]

export function buildDashboardPeriods(matches, summarize, today = new Date()) {
  const year = today.getFullYear()
  const month = today.getMonth()
  const day = today.getDate()
  const end = localDateString(today)
  return Object.fromEntries(dashboardPeriods.slice(1).map(({ value }) => {
    const first = new Date(year, month - Number(value), 1)
    const lastDay = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate()
    first.setDate(Math.min(day, lastDay))
    const start = localDateString(first)
    const rows = matches.filter(match => isValidBirthDate(match?.matchDate, end) && match.matchDate >= start)
    return [value, summarize(rows)]
  }))
}
