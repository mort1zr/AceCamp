# PCIT-139 — estructura de consulta y KPIs

## Estado y acuerdo de alcance

PCIT-139 preparó la estructura de consulta. PCIT-144 conecta el formato
`acecam.match-stats.v1` que publica el worker de PCIT-35. Falta comprobar el
recorrido de punta a punta con los servicios del equipo.

Se implementan consulta por organización/jugador, validación de un contrato de
adaptación explícito y funciones puras de agregación. No se inicializa otro
Firebase ni se agregan credenciales. Los tests usan casos controlados y el SDK
simulado; no prueban las reglas desplegadas ni el modelo.

## Evidencia revisada en GitHub

En `ModeloAI` revisión `6c17537`, `model/stats/match_stats.py` asigna la
posición registrada a `statistics.player` y la otra posición a `opponent`.
El Dashboard lee `player.shots.count` y `player.shots.sumSpeedKmh`. El worker
también mide desplazamiento y, desde el Sprint 3 (TA-18), el saque: velocidad media
hasta el bote, primer saque dentro y dobles faltas.

La rama Landing_Rolando incorpora layout, rutas y tokens compartidos; no se ha
fusionado dentro de interfaces_Fabian durante PCIT-139.

## Contrato de adaptación

`buildDashboardOverview(rows, { orgId, playerId, decodeStatistics })` requiere
un decoder síncrono explícito. Lo llama con `(match, { playerId })`.
El servicio Firestore usa por defecto el decoder de PCIT-35.

El decoder debe devolver este modelo normalizado, **solo cuando la fuente real
permita construirlo sin inferencias**, o `null` cuando no sea compatible:

```js
{
  schemaVersion: 'acecam.player-match.v1', // Versión interna de adaptación
  playerId: 'id-del-jugador-registrado',
  shots: { sumKmh: 175, sampleCount: 2 },
  serveSpeed: { sumKmh: 1900, sampleCount: 10 },
  firstServe: { in: 2, attempts: 10 },
  doubleFaults: 2
}
```

Los números anteriores son un caso de prueba, no una salida del modelo ni datos
reales. Las métricas son opcionales: un campo ausente o inválido es desconocido,
no cero. Se admiten contadores cero cuando están realmente presentes. Los tipos
deben ser numéricos; no se convierten cadenas automáticamente.

La versión interna permite conservar el contrato de la interfaz. El decoder
de PCIT-35 (`workerDashboardStatistics.js`) mapea `statistics.player.shots` a `shots` y
`statistics.player.serve` a `serveSpeed` (`sumSpeedKmh`, `sampleCount`), `firstServe`
(`firstServeIn`, `firstServeAttempts`) y `doubleFaults`. Lo que el worker no escribió queda
ausente: ver `docs/firestore-schema.md`.

## Reglas de cálculo

Se incluyen solo documentos con ID, misma orgId y playerId, estado `listo` y al
menos una métrica reconocida. Se deduplican por ID físico de documento.

- **Partidos analizados:** número de documentos compatibles con resultados
  válidos para el jugador. Los terminados sin resultados compatibles se cuentan
  por separado en `coverage.incompatibleMatches`.
- **Golpes medidos:** suma de los contadores de golpe.
- **Velocidad media de golpe:** suma de velocidades en km/h dividida entre la
  cantidad total de golpes medidos.
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

```jsx
<Route path="/dashboard" element={<Dashboard db={db} session={session} />} />
```

La página recibe `{ uid, orgId }` de la sesión verificada y mantiene ambos
servicios estables para ese usuario y organización.

`subscribePlayer` valida primero el documento players del jugador. Después abre
matches con dos filtros de igualdad: orgId y playerId. Vuelve a comprobar esas
identidades antes de agregar y exige estado `listo`. Usa el ID físico del
snapshot, no un campo id que pudiera contener el documento.

Se limpian las suscripciones y se ignoran respuestas tardías. Cancelar mientras
se consulta el jugador impide abrir después una escucha de partidos. Errores de
permisos, red o del decoder se propagan al estado de error; no generan ceros.
El filtrado del cliente no reemplaza las reglas de Firestore de PCIT-23.

## Pendientes para validar la conexión real

1. Conectar la sesión compartida de PCIT-21 a la ruta de la aplicación.
2. Probar consulta y aislamiento con las reglas de PCIT-23.
3. Verificar el recorrido completo con el worker en PCIT-137.

PCIT-144 se contrastó con datos sintéticos procesados por el generador de
estadísticas publicado en `6c17537`. Dos partidos dieron tres golpes y
79,17 km/h de promedio ponderado. La prueba ejercitó el mapeo y la agregación.
La evolución de saque de PCIT-140 conservó valores ausentes.
