function ejemplo() {
  return {
    account: {
      name: 'Coach Ramírez',
      email: 'coach@ejemplo.test',
      position: 'Entrenador principal',
      role: 'admin',
    },
    isOrganization: true,
    organization: {
      name: 'Universidad de ejemplo',
      program: 'Tenis varonil y femenil',
      canEdit: true,
    },
    team: [
      {
        id: 'm1',
        name: 'Coach Ramírez',
        email: 'coach@ejemplo.test',
        role: 'admin',
        players: null,
        status: 'activo',
      },
      {
        id: 'm2',
        name: 'Luis Herrera',
        email: 'luis@ejemplo.test',
        role: 'coach',
        players: 5,
        status: 'activo',
      },
      {
        id: 'm3',
        name: 'Patricia Núñez',
        email: 'patricia@ejemplo.test',
        role: 'coach',
        players: 4,
        status: 'invitado',
      },
    ],
    preferences: {
      units: 'kmh',
      notifications: { analysis: true, application: true, alerts: false, weekly: true },
    },
    plan: { id: 'ultra', trial: false, used: 18, limit: null, cycle: 'anual', renewsAt: '2027-03-01T00:00:00.000Z' },
  }
}

const esperar = () => new Promise((resolve) => setTimeout(resolve, 200))

export function createDemoConfiguracionService({ scenario = 'data', plan } = {}) {
  let data = ejemplo()
  if (plan) data = { ...data, isOrganization: plan.id === 'ultra', plan }
  const listeners = new Set()
  const emit = () => listeners.forEach((listener) => listener(structuredClone(data)))

  return {
    scopeKey: `demo:${crypto.randomUUID()}`,
    mode: 'demo',
    subscribe(onData, onError) {
      let active = true
      const listener = (value) => active && onData(value)
      queueMicrotask(() => {
        if (!active || scenario === 'loading') return
        if (scenario === 'error') return onError({ code: 'unavailable' })
        listeners.add(listener)
        onData(structuredClone(data))
      })
      return () => {
        active = false
        listeners.delete(listener)
      }
    },
    async saveAccount(values) {
      await esperar()
      data = { ...data, account: { ...data.account, name: values.name, position: values.position } }
      emit()
    },
    async changePassword({ current }) {
      await esperar()
      if (current !== 'demo1234') throw Object.assign(new Error(), { code: 'auth/wrong-password' })
    },
    async saveOrganization(values) {
      await esperar()
      data = { ...data, organization: { ...data.organization, ...values } }
      emit()
    },
    async savePreferences(values) {
      await esperar()
      data = { ...data, preferences: values }
      emit()
    },
    async inviteMember({ email, role }) {
      await esperar()
      data = {
        ...data,
        team: [
          ...data.team,
          { id: crypto.randomUUID(), name: email, email, role, players: 0, status: 'invitado' },
        ],
      }
      emit()
    },
    async cancelInvite({ email }) {
      await esperar()
      data = {
        ...data,
        team: data.team.filter((miembro) => !(miembro.status === 'invitado' && miembro.email === email)),
      }
      emit()
    },
  }
}
