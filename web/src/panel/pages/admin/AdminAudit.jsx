import { useEffect, useState } from 'react'
import { DataTable } from '../../components/ui'
import { db } from '../../lib/firebase.js'
import { loadPlatformAudit } from '../../lib/services/platformAudit.js'

const labels = {
  name: 'Nombre', plan: 'Plan', archived: 'Archivada', role: 'Rol',
  suspended: 'Suspendido', orgId: 'Organización', status: 'Estado',
}
const entities = { orgs: 'Organización', users: 'Usuario', invites: 'Invitación' }
const date = new Intl.DateTimeFormat('es-PE', { dateStyle: 'short', timeStyle: 'short' })
const display = value => typeof value === 'boolean' ? (value ? 'Sí' : 'No') : (value ?? '—')

function Changes({ before, after }) {
  return (
    <dl className="space-y-1">
      {Object.entries(after ?? {}).filter(([field, value]) => before?.[field] !== value).map(([field, value]) => (
        <div key={field}>
          <dt className="font-medium">{labels[field] ?? field}</dt>
          <dd>{before && <>{display(before[field])} → </>}{display(value)}</dd>
        </div>
      ))}
    </dl>
  )
}

const columns = [
  { key: 'createdAt', label: 'Fecha', render: value => value?.toDate ? date.format(value.toDate()) : '—' },
  { key: 'actorId', label: 'Responsable (UID)', render: value => <span className="break-all">{value}</span> },
  { key: 'targetId', label: 'Entidad', render: (value, row) => <>{entities[row.entity]}<br /><span className="break-all">{value}</span></> },
  { key: 'after', label: 'Cambios', render: (value, row) => <Changes before={row.before} after={value} /> },
]

export default function AdminAudit() {
  const [result, setResult] = useState(null)
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    let active = true
    loadPlatformAudit(db).then(
      rows => { if (active) setResult({ rows }) },
      () => { if (active) setResult({ error: 'No pudimos cargar la bitácora.' }) },
    )
    return () => { active = false }
  }, [attempt])
  return (
    <DataTable caption="Últimos 100 cambios administrativos" columns={columns} rows={result?.rows}
      loading={!result} error={result?.error} emptyTitle="Todavía no hay cambios registrados"
      onRetry={() => { setResult(null); setAttempt(current => current + 1) }} />
  )
}
