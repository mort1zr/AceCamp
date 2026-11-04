const minutos = (cantidad) => new Date(Date.now() - cantidad * 60000).toISOString()

function ejemplo() {
  return {
    coachName: 'Coach',
    summary: {
      trackedPlayers: 12,
      playersAnalyzedThisWeek: 4,
      analyzedMatchesThisMonth: 18,
      newApplications: 3,
      applicationsInReview: 9,
      processing: 2,
      estimatedMinutes: 14,
      readyToReview: 2,
    },
    applications: [
      {
        id: 'ap-1',
        fullName: 'Sofía Vargas',
        age: 17,
        academy: 'Academia Pacífico',
        utr: 9.6,
        status: 'nueva',
      },
      {
        id: 'ap-2',
        fullName: 'Rafael Chávez',
        age: 18,
        academy: 'Club Las Lomas',
        utr: 10.2,
        status: 'nueva',
      },
      {
        id: 'ap-3',
        fullName: 'Ana Flores',
        age: 16,
        academy: 'Academia Costa Verde',
        utr: 8.9,
        status: 'nueva',
      },
      {
        id: 'ap-4',
        fullName: 'Gabriel Medina',
        age: 17,
        academy: 'Academia Andina',
        utr: 9.8,
        status: 'en revisión',
      },
      {
        id: 'ap-5',
        fullName: 'Lucía Mendoza',
        age: 18,
        academy: 'Club Las Lomas',
        utr: 10.1,
        status: 'analizada',
      },
    ],
    queue: [
      {
        id: 'q-1',
        title: 'Diego Salazar vs. T. Ríos',
        source: 'Copa Juvenil',
        uploadedAt: minutos(6),
        status: 'procesando',
        progress: 64,
      },
      {
        id: 'q-2',
        title: 'Sofía Vargas · video de postulación',
        source: 'YouTube',
        uploadedAt: minutos(2),
        status: 'en cola',
        progress: 4,
      },
      {
        id: 'q-3',
        title: 'Mateo Rojas vs. J. Luna',
        source: 'Torneo Nacional',
        uploadedAt: minutos(95),
        status: 'listo',
        progress: 100,
      },
    ],
    recentMatches: [
      {
        id: 'm-1',
        player: 'Mateo Rojas',
        opponent: 'J. Luna',
        tournament: 'Torneo Nacional Sub-18',
        date: '2026-10-31',
        score: '6-4 3-6 7-5',
      },
      {
        id: 'm-2',
        player: 'Valentina Quispe',
        opponent: 'M. Paz',
        tournament: 'Interclubes',
        date: '2026-10-30',
        score: '6-2 6-3',
      },
      {
        id: 'm-3',
        player: 'Diego Salazar',
        opponent: 'P. Ortiz',
        tournament: 'Copa Juvenil',
        date: '2026-10-28',
        score: '7-6 4-6 6-4',
      },
      {
        id: 'm-4',
        player: 'Camila Torres',
        opponent: 'R. Silva',
        tournament: 'Entrenamiento',
        date: '2026-10-27',
        score: '4-6 6-4',
      },
    ],
    alerts: [
      {
        id: 'al-1',
        type: 'down',
        title: 'Mateo Rojas bajó su % de primeros saques',
        detail: '58% en los últimos 3 partidos (venía de 66%)',
      },
      {
        id: 'al-2',
        type: 'up',
        title: 'Valentina Quispe subió su velocidad de derecha',
        detail: '+6 km/h promedio en el último mes',
      },
      {
        id: 'al-3',
        type: 'error',
        title: 'Falló el análisis de “Andrés Paredes vs. K. Díaz”',
        detail: 'El ángulo de cámara no muestra la cancha completa',
      },
    ],
    tracked: [
      {
        id: 't-1',
        fullName: 'Mateo Rojas',
        category: 'Sub-18',
        utr: 10.4,
        kpiLabel: 'Saque más rápido',
        kpiValue: '171 km/h',
        delta: '+3',
      },
      {
        id: 't-2',
        fullName: 'Valentina Quispe',
        category: 'Sub-16',
        utr: 9.1,
        kpiLabel: 'Derecha más rápida',
        kpiValue: '118 km/h',
        delta: '+6',
      },
      {
        id: 't-3',
        fullName: 'Diego Salazar',
        category: 'Sub-18',
        utr: 10.9,
        kpiLabel: '% primeros saques',
        kpiValue: '68%',
        delta: '+4',
      },
      {
        id: 't-4',
        fullName: 'Camila Torres',
        category: 'Sub-16',
        utr: 8.2,
        kpiLabel: 'Peloteo promedio',
        kpiValue: '5.8 golpes',
        delta: '+0.7',
      },
    ],
  }
}

export function createDemoInicioService({ overview, scenario = 'data' } = {}) {
  return {
    scopeKey: `demo:${crypto.randomUUID()}`,
    mode: 'demo',
    subscribe(onData, onError) {
      let active = true
      queueMicrotask(() => {
        if (!active || scenario === 'loading') return
        if (scenario === 'error') onError({ code: 'unavailable' })
        else onData(structuredClone(overview ?? ejemplo()))
      })
      return () => {
        active = false
      }
    },
  }
}
