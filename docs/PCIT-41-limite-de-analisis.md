# PCIT-41 — Contador de análisis y límite del plan

Responsable: Axel. Rama `panel_web/conexiones`.

## Qué hace

Cada partido nuevo cuenta como un análisis de la organización en el mes. Al
llegar al límite del plan no se pueden crear más análisis y la web lo avisa.

| Plan (`orgs/{orgId}.plan`) | Análisis por mes |
| --- | --- |
| `free` (sin plan) | 0 |
| `prueba` (Básico de prueba, 30 días; vencida = 0) | 15 |
| `basico` | 30 |
| `pro` | 150 |
| `ultra` | Sin tope |

Los valores están en `web/src/panel/lib/planes.js` y en `withinPlan` de
`firebase/firestore.rules`. Si cambian, hay que cambiar los dos:
`planes.test.js` lee las reglas y falla si no coinciden.

## Cómo funciona

- **Contador:** `orgs/{orgId}/usage/{YYYY-MM}` con `analyses`, `lastMatchId` y
  `updatedAt`. El mes va en UTC, igual que `request.time` en las reglas. Cada mes
  empieza un documento nuevo, así que no hay que reiniciar nada.
- **Alta del partido:** `firestoreAnalysisService` crea el partido y suma 1 al
  contador en la misma transacción.
- **Reglas:** un partido nuevo solo se acepta si el contador del mes sube
  exactamente en 1 con ese `matchId`, y el contador solo sube si en la misma
  escritura se crea ese partido. Si la suma pasa el límite del plan, se niegan las
  dos escrituras. Es la protección real: no depende de la pantalla.
- **Antes de subir el video:** el servicio lee el plan y el contador. Si ya no
  quedan análisis, no transfiere el archivo y devuelve `analysis/limit`. Dentro de
  la transacción lo vuelve a revisar, por si otro entrenador usó el último
  análisis mientras se subía el video.
- **Pantallas:** la barra lateral y Configuración → Plan leen el contador de la
  organización (el mismo número para admin y coach). En el último 20 % del plan
  (como mínimo los 3 últimos análisis), Analizar avisa cuántos quedan sin bloquear
  nada; al llegar al límite muestra otro aviso y desactiva el formulario.

Reintentar un partido con `error` no suma; borrar un partido no devuelve el
análisis. `npm run seed` carga el contador que corresponde a los partidos de
ejemplo.

## Pruebas

- Unitarias: contador, límite antes de subir y en la transacción, mensajes,
  avisos en Analizar (quedan pocos y límite alcanzado), Configuración, datos de
  ejemplo y que los límites de la web coincidan con las reglas.
- Reglas (`npm run test:rules`): suma de a uno, partido sin contador, contador sin
  partido, saltos, otro mes, otra organización, límites de `prueba`, `basico` y
  `pro`, sin plan, plan desconocido, Ultra sin tope y el contador compartido entre
  entrenadores.

## Relación con otras historias

- **PCIT-158** guarda el plan pagado en el checkout (`docs/PCIT-158-plan-del-checkout.md`).
  Una cuenta nueva queda en `free` (0 análisis, panel bloqueado) hasta que paga.
- El "plan de vista" local de la barra lateral cambia lo que se muestra, pero no el
  límite real, que siempre sale del plan guardado en Firestore.
- `npm run seed`: Universidad Demo tiene Ultra (sin tope) y Club Ejemplo tiene la
  prueba de Básico vencida (0 análisis, panel bloqueado), así se ven los dos casos.
- La prueba vence a los 30 días desde `planSince` (PCIT-170 en la web, PCIT-171 en
  las reglas): `trialExpired` en `firestore.rules` y `planVigente` en `planes.js`.
