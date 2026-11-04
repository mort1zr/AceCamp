import { createDemoAnalysisService } from '../previews/demoAnalysisService.js'
import { createDemoDashboardService } from '../previews/demoDashboardService.js'
import { createDemoPlayersService } from '../previews/demoPlayersService.js'

const jugadores = createDemoPlayersService()

export const serviciosDemo = {
  jugadores,
  analisis: createDemoAnalysisService({ playersService: jugadores }),
  resumen: createDemoDashboardService({ scopeKey: jugadores.scopeKey }),
}
