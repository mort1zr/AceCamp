# PCIT-191 · Estadísticas reales del jugador y del partido

En **Jugadores**, abre una ficha para ver las estadísticas del último partido analizado, identificado por fecha y rival. En **Partidos**, abre un reporte para ver las estadísticas de ese encuentro.

Las dos pantallas leen las mediciones de `matches.statistics` mediante `workerDashboardStatistics.js`. Las tarjetas conservan un cero medido, respetan la preferencia de km/h o mph y se reacomodan cuando faltan métricas. Si el partido no tiene mediciones disponibles, se muestra «Sin datos de estadísticas».

Para verificar ambos flujos con documentos completos, parciales y sin análisis, ejecuta `npm test -- src/panel/pages/Jugadores.test.jsx src/panel/pages/Partidos.test.jsx` desde `web`.
