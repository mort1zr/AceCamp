import { isValidBirthDate, localDateString } from './players.js'

export const dashboardPeriods = [
  { value: 'all', label: 'Todo' },
  { value: '1', label: 'Último mes' },
  { value: '3', label: 'Últimos 3 meses' },
  { value: '6', label: 'Últimos 6 meses' },
]

export function monthsBefore(date, months) {
  const first = new Date(date.getFullYear(), date.getMonth() - months, 1)
  const lastDay = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate()
  first.setDate(Math.min(date.getDate(), lastDay))
  return first
}

export function buildDashboardPeriods(matches, summarize, summarizePrevious, today = new Date()) {
  const end = localDateString(today)
  const dated = matches.filter(match => isValidBirthDate(match?.matchDate, end))
  return Object.fromEntries(dashboardPeriods.slice(1).map(({ value }) => {
    const first = monthsBefore(today, Number(value))
    const start = localDateString(first)
    const report = summarize(dated.filter(match => match.matchDate >= start))
    // ISO date-only values are UTC for counting calendar days, including both ends.
    const days = (Date.parse(end) - Date.parse(start)) / 86_400_000 + 1
    const previousStart = new Date(first.getFullYear(), first.getMonth(), first.getDate() - days)
    const lowerBound = localDateString(previousStart)
    const previous = report.coverage.compatibleMatches > 0 && !report.coverage.incompatibleMatches
      ? summarizePrevious(dated.filter(match => match.matchDate >= lowerBound && match.matchDate < start))
      : null
    const previousMetrics = previous?.coverage.compatibleMatches > 0 && !previous.coverage.incompatibleMatches
      ? previous.metrics
      : null
    return [value, { ...report, previousMetrics }]
  }))
}
