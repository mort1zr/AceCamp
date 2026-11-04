import { normalizePlayer, PLAYER_CONSENT_VERSION } from '../lib/players.js'

const examples = [
  { id: 'example-1', fullName: 'Valeria Torres', birthDate: '2005-03-12', academy: 'Academia Central' },
  { id: 'example-2', fullName: 'Mateo Ríos', birthDate: '2003-08-24', academy: 'Club del Norte' },
  { id: 'example-3', fullName: 'Camila Vega', birthDate: '2006-01-08', academy: 'Academia Central' },
]

/** Ephemeral fixtures: no localStorage, Firebase, or production fallback. */
export function createDemoPlayersService({ initialPlayers = examples } = {}) {
  let players = initialPlayers.map(player => ({ ...player })).sort((a, b) => a.fullName.localeCompare(b.fullName, 'es'))
  const listeners = new Set()
  const emit = () => listeners.forEach(listener => listener(players.map(player => ({ ...player }))))

  return {
    scopeKey: `demo:${crypto.randomUUID()}`,
    mode: 'demo',
    subscribe(onPlayers) {
      listeners.add(onPlayers)
      queueMicrotask(() => { if (listeners.has(onPlayers)) onPlayers(players.map(player => ({ ...player }))) })
      return () => listeners.delete(onPlayers)
    },
    async create(input) {
      const player = {
        ...normalizePlayer(input),
        id: crypto.randomUUID(),
        createdBy: 'demo-coach',
        createdAt: new Date().toISOString(),
        consent: { accepted: true, version: PLAYER_CONSENT_VERSION, method: 'demo', recordedBy: 'demo-coach', recordedAt: new Date().toISOString() },
      }
      players = [...players, player].sort((a, b) => a.fullName.localeCompare(b.fullName, 'es'))
      emit()
      return { ...player }
    },
  }
}
