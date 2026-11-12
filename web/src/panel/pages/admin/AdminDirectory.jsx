import { useEffect, useState } from 'react'
import { useTextos } from '../../../compartido/lib/idioma.jsx'
import { DataTable } from '../../components/ui'
import { db } from '../../lib/firebase.js'
import { loadAdminDirectory } from '../../lib/services/firestoreAdminDirectory.js'

const copy = {
  es: {
    locale: 'es-PE', organizations: 'Organizaciones', users: 'Usuarios', name: 'Nombre', plan: 'Plan',
    members: 'Miembros', used: 'Análisis usados', email: 'Correo', org: 'Organización', role: 'Rol',
    created: 'Fecha de alta', error: 'No pudimos cargar los datos de administración.',
    plans: { free: 'Sin plan', prueba: 'Prueba de Básico', basico: 'Básico', pro: 'Pro', ultra: 'Ultra' },
    roles: { coach: 'Entrenador', admin: 'Administrador de equipo' },
  },
  en: {
    locale: 'en', organizations: 'Organizations', users: 'Users', name: 'Name', plan: 'Plan',
    members: 'Members', used: 'Analyses used', email: 'Email', org: 'Organization', role: 'Role',
    created: 'Joined on', error: 'We could not load the administration data.',
    plans: { free: 'No plan', prueba: 'Basic trial', basico: 'Basic', pro: 'Pro', ultra: 'Ultra' },
    roles: { coach: 'Coach', admin: 'Team administrator' },
  },
}

export default function AdminDirectory() {
  const t = useTextos(copy)
  const [result, setResult] = useState(null)
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    let active = true
    loadAdminDirectory(db).then(
      data => { if (active) setResult(data) },
      () => { if (active) setResult({ failed: true }) },
    )
    return () => { active = false }
  }, [attempt])

  function retry() {
    setResult(null)
    setAttempt(current => current + 1)
  }

  const date = new Intl.DateTimeFormat(t.locale, { dateStyle: 'medium', timeZone: 'UTC' })
  const month = result?.period
    ? new Intl.DateTimeFormat(t.locale, { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(result.period + '-01T00:00:00Z'))
    : ''
  const organizations = [
    { key: 'name', label: t.name },
    { key: 'plan', label: t.plan, render: plan => Object.hasOwn(t.plans, plan) ? t.plans[plan] : (plan || '—') },
    { key: 'members', label: t.members, align: 'right' },
    { key: 'analyses', label: month ? `${t.used} · ${month}` : t.used, align: 'right' },
  ]
  const users = [
    { key: 'email', label: t.email },
    { key: 'organization', label: t.org },
    { key: 'role', label: t.role, render: role => Object.hasOwn(t.roles, role) ? t.roles[role] : (role || '—') },
    { key: 'createdAt', label: t.created, render: value => {
      const created = value?.toDate?.()
      return Number.isFinite(created?.getTime()) ? date.format(created) : '—'
    } },
  ]

  if (result?.failed) return <DataTable caption={t.organizations} columns={organizations} error={t.error} onRetry={retry} />
  return (
    <div className="grid min-w-0 gap-5">
      <DataTable caption={t.organizations} columns={organizations} rows={result?.organizations} loading={!result} />
      <DataTable caption={t.users} columns={users} rows={result?.users} loading={!result} />
    </div>
  )
}
