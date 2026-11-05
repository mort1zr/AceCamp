import { buildDashboardOverview } from './dashboardOverview.js'
import { monthsBefore } from './dashboardPeriods.js'
import { isValidBirthDate, localDateString } from './players.js'

export const comparisonPeriods = [
  { value: '0', label: 'Actual' },
  { value: '3', label: 'Hace 3 meses' },
  { value: '6', label: 'Hace 6 meses' },
  { value: '9', label: 'Hace 9 meses' },
]

export function buildPlayerComparisonHistory(rows, context, today = new Date()) {
  const { orgId, playerId } = context
  const ready = rows.filter(match => match.orgId === orgId && match.playerId === playerId
    && match.status === 'listo' && typeof match.id === 'string' && match.id)
  const todayLabel = localDateString(today)
  const dated = ready.filter(match => isValidBirthDate(match.matchDate, todayLabel))
  const periods = Object.fromEntries(comparisonPeriods.map(({ value }) => {
    const months = Number(value)
    const start = localDateString(monthsBefore(today, months + 3))
    const end = localDateString(monthsBefore(today, months))
    const matches = dated.filter(match => match.matchDate >= start && (months === 0 || match.matchDate < end))
    return [value, buildDashboardOverview(matches, context)]
  }))
  const matches = ready.map(match => ({
    id: match.id,
    date: isValidBirthDate(match.matchDate, todayLabel) ? match.matchDate : '',
    opponent: match.opponent,
    tournament: match.tournament,
    ...buildDashboardOverview([match], context),
  })).sort((a, b) => b.date.localeCompare(a.date) || a.id.localeCompare(b.id))
  return { periods, matches }
}
