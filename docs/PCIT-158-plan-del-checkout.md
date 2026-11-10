# PCIT-158 — Guardar el plan contratado en el checkout

Responsable: Axel. Rama: `panel_web/conexiones`.

## Qué hace

Al pagar en el checkout simulado (`/checkout`), la organización queda con el plan
elegido y el panel se desbloquea. No hay cobro real y no se guarda nada de la tarjeta.

| Elegido en el checkout | Se guarda en `orgs/{orgId}.plan` | Análisis por mes |
| --- | --- | --- |
| Básico, primera vez | `prueba` (30 días) | 15 |
| Básico, después de haber contratado antes | `basico` | 30 |
| Pro | `pro` | 150 |
| Ultra | `ultra` | Sin tope |

Además se guardan `billingCycle` (`mensual` o `anual`) y `planSince` (hora del
servidor). Con esos dos datos, Configuración → Plan muestra el periodo y la próxima
renovación; en la prueba muestra cuándo termina (`proximaRenovacion` en
`web/src/panel/lib/planes.js`).

## Subtareas

| Subtarea | Qué hace |
| --- | --- |
| PCIT-170 | La prueba vence a los 30 días en la web (`planVigente`, `pruebaVencida`, `finDePrueba` en `planes.js`) |
| PCIT-171 | Las reglas aplican el vencimiento (`trialExpired` en `withinPlan`) |
| PCIT-172 | El checkout ofrece la prueba gratis solo si la organización puede usarla (`usePruebaDisponible`) |
| PCIT-173 | Datos de ejemplo con una prueba vencida y esta documentación |

## Vencimiento de la prueba

- La prueba de Básico dura **30 días** desde `planSince` (`DIAS_PRUEBA`). Después, la
  organización cuenta como **Sin plan**: el panel queda bloqueado, el límite es 0 y
  Configuración → Plan dice "Tu mes de prueba terminó el …".
- No se reescribe el documento: el plan guardado sigue siendo `prueba` y la web y las
  reglas calculan que venció. Así no hace falta un proceso que lo cambie a `free`.
- Una prueba sin `planSince` (cargada a mano) no vence.
- Para seguir, el dueño contrata otro plan. Como ya tiene `planSince`, Básico entra como
  Básico normal y el checkout no le vuelve a ofrecer la prueba gratis (PCIT-172).

## Cómo funciona

- `web/src/panel/rutas.jsx` pasa `contratar` a `<Checkout />`, que llama a `contratarPlan()`
  (`web/src/panel/lib/contratarPlan.js`). Una transacción lee la organización para
  decidir si Básico es prueba y escribe solo `plan`, `billingCycle` y `planSince`.
- Si no se puede guardar, el checkout avisa y deja reintentar.
- La barra lateral y Configuración escuchan la organización en vivo: muestran el plan
  nuevo apenas se paga, y el límite de análisis (PCIT-41) cambia en el mismo momento.

## Reglas (`firebase/firestore.rules`)

- Solo el dueño de la organización (`ownerId`) cambia el plan; un admin, un coach u
  otra organización no.
- Solo se tocan `plan`, `billingCycle` y `planSince`; `plan` debe ser `prueba`,
  `basico`, `pro` o `ultra` (nunca `free`), y `planSince` debe ser la hora del servidor.
- `prueba` solo si la organización nunca tuvo `planSince`: la prueba es una sola vez.
- `planes.test.js` comprueba que esa lista de planes coincida con `PLANES`.

## Pruebas

- Unitarias: `contratarPlan.test.js`, `Checkout.test.jsx` (prueba ofrecida o no),
  `usePruebaDisponible.test.js`, `planes.test.js` (renovación, vencimiento y que los 30
  días coincidan con las reglas) y Configuración → Plan.
- Reglas (`npm run test:rules`): dueño contrata Pro y Ultra, prueba una sola vez,
  planes, periodos, fechas y campos inválidos, que nadie más que el dueño contrate, y
  prueba vigente, vencida y sin fecha.
- `npm run seed`: Club Ejemplo (`coach2@acecam.test`) tiene la prueba vencida.

## Pendiente (PCIT-67 y cobro real)

- El pago es simulado: cualquier dueño puede activarse Ultra desde la web. Con un
  cobro real, el plan debe escribirlo el servidor tras confirmar el pago.
- Las reglas de Firestore llegan a producción solo cuando se fusione la PR #21, que
  saca Storage del paso de reglas del despliegue.
