# PCIT-139 — estructura de consulta y KPIs

## Estado y acuerdo de alcance

El usuario indicó que la conexión con el JSON de Aaron se añadirá después y
autorizó dejar preparada la estructura. No se dispone aún de ese contrato ni de
una salida JSON del worker. PCIT-139 permanece En curso hasta comprobar la
integración real. No se declara terminada la historia PCIT-28.

Se implementan consulta por organización/jugador, validación de un contrato de
adaptación explícito y funciones puras de agregación. No se inicializa otro
Firebase ni se agregan credenciales. Los tests usan casos controlados y el SDK
simulado; no prueban las reglas desplegadas ni el modelo.

## Evidencia revisada en GitHub

Se revisó `origin/ModeloAI` en 53bdd56, incluyendo `model/main.py` y
`model/utils/player_stats_drawer_utils.py`. Esa versión calcula velocidades de
golpes y de desplazamiento, con variables por player_1/player_2 y cuadros de
video; no se encontró un exportador JSON del worker ni métricas de saque.
No se transforman esas velocidades en velocidad de saque ni se supone que
player_1 sea el jugador registrado. La asignación la debe resolver el adaptador
acordado con Aaron y Axel.

La rama Landing_Rolando incorpora layout, rutas y tokens compartidos; no se ha
fusionado dentro de interfaces_Fabian durante PCIT-139.

## Contrato de adaptación propuesto (pendiente de confirmar)

`buildDashboardOverview(rows, { orgId, playerId, decodeStatistics })` requiere
un decoder síncrono explícito. Lo llama con `(match, { playerId })`. No se asume
la ruta del JSON real ni se incluye un decoder por defecto en producción.

El decoder debe devolver este modelo normalizado, **solo cuando la fuente real
permita construirlo sin inferencias**, o `null` cuando no sea compatible:

```js
{
  schemaVersion: 'acecam.player-match.v1', // Versión propuesta de adaptación
  playerId: 'id-del-jugador-registrado',
  serveSpeed: { sumKmh: 1900, sampleCount: 10 },
  firstServe: { in: 2, attempts: 10 },
  doubleFaults: 2
}
```

Los números anteriores son un caso de prueba, no una salida del modelo ni datos
reales. Las métricas son opcionales: un campo ausente o inválido es desconocido,
no cero. Se admiten contadores cero cuando están realmente presentes. Los tipos
deben ser numéricos; no se convierten cadenas automáticamente.

Antes de conectar la fuente, confirmar el significado de cada contador, el
jugador que representa, las unidades y la versión del esquema. La versión
propuesta no obliga a Aaron a cambiar su formato: puede mapearse en el adaptador.

## Reglas de cálculo

Se incluyen solo documentos con ID, misma orgId y playerId, estado `listo` y al
menos una métrica reconocida. Se deduplican por ID físico de documento.

- **Partidos analizados:** número de documentos compatibles con resultados
  válidos para el jugador. Los terminados sin resultados compatibles se cuentan
  por separado en `coverage.incompatibleMatches`.
- **Velocidad media de saque:** suma de velocidades en km/h dividida entre
  total de muestras. No es la media simple de los promedios por partido.
- **Primer saque dentro:** suma de primeros saques dentro / suma de intentos
  de primer saque × 100. No es la media simple de porcentajes de cada partido.
- **Dobles faltas:** suma de los contadores explícitos por partido.

Política conservadora por métrica: si un partido incluido carece de sus
contadores, esa métrica global es `null`. No se muestran totales parciales como
si fueran completos. Un denominador cero, un contador imposible o un
desbordamiento numérico produce `null`, nunca NaN, Infinity o un cero supuesto.

Una consulta vacía sí permite afirmar que hay cero resultados compatibles;
las otras métricas permanecen `null`. El Dashboard muestra un aviso cuando hay
resultados terminados no compatibles y no los trata como estadísticas de saque.

## Servicio Firestore

```js
const overviewService = createFirestoreDashboardService({
  db,
  orgId: profile.orgId,
  actorId: user.uid,
  decodeStatistics: agreedWorkerMapper, // Pendiente: no inventar este mapeo
})
```

La instancia debe permanecer estable por sesión. Se pasa a Dashboard junto con
playersService, compartiendo scopeKey y mode `live` según DASHBOARD_UI.md.

`subscribePlayer` valida primero el documento players del jugador. Después abre
matches con dos filtros de igualdad: orgId y playerId. Vuelve a comprobar esas
identidades antes de agregar y exige estado `listo`. Usa el ID físico del
snapshot, no un campo id que pudiera contener el documento.

Se limpian las suscripciones y se ignoran respuestas tardías. Cancelar mientras
se consulta el jugador impide abrir después una escucha de partidos. Errores de
permisos, red o del decoder se propagan al estado de error; no generan ceros.
El filtrado del cliente no reemplaza las reglas de Firestore de PCIT-23.

## Pendientes para validar la conexión real

1. PCIT-20/21: Firebase y sesión compartida; PCIT-22/35: JSON y mapeo acordados.
2. Contrastar las fórmulas y unidades con una salida real del worker.
3. Probar consulta y aislamiento con Firestore real/emulador y reglas de PCIT-23.
4. Integrar el servicio estable en /dashboard dentro de la aplicación.

El gráfico de evolución pertenece a PCIT-140. No se añadieron cálculos ni
componentes de ese gráfico a este commit.

La tarea PCIT-139 ya conserva estos pendientes: por ahora no se creó otra
actividad duplicada. Un cambio adicional que requiera código después de su
único commit deberá registrarse con otra PCIT según la convención del usuario.
