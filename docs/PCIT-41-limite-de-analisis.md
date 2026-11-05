# PCIT-41 — Contador de análisis y límite del plan

Responsable: Axel. Rama `panel_web/conexiones`.

## Qué hace

Cada partido nuevo cuenta como un análisis de la organización en el mes. Al
llegar al límite del plan no se pueden crear más análisis y la web lo avisa.

| Plan (`orgs/{orgId}.plan`) | Análisis por mes |
| --- | --- |
| `free` (sin plan) | 0 |
| `prueba` (Básico de prueba) | 15 |
| `basico` | 30 |
| `pro` | 150 |
| `ultra` | Sin tope |

Los valores están en `web/src/panel/lib/planes.js` y en `withinPlan` de
`firebase/firestore.rules`. Si cambian, hay que cambiar los dos.

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
  organización (el mismo número para admin y coach). Analizar muestra un aviso y
  desactiva el formulario cuando se llega al límite.

Reintentar un partido con `error` no suma; borrar un partido no devuelve el
análisis. `npm run seed` carga el contador que corresponde a los partidos de
ejemplo.

## Pruebas

- Unitarias: contador, límite antes de subir y en la transacción, mensajes,
  aviso en Analizar, Configuración y datos de ejemplo.
- Reglas (`npm run test:rules`): suma de a uno, partido sin contador, contador sin
  partido, saltos, otro mes, otra organización, límites de `prueba`, `basico` y
  `pro`, sin plan, plan desconocido, Ultra sin tope y el contador compartido entre
  entrenadores.

## Pendiente fuera de esta historia

- PCIT-158 guarda el plan pagado en el checkout. Mientras tanto, las cuentas
  nuevas quedan en `free` (0 análisis), igual que el panel bloqueado de "Sin plan".
- El "plan de vista" local de la barra lateral cambia lo que se muestra, pero no el
  límite real, que siempre sale del plan guardado en Firestore.
