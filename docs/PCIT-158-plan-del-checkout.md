# PCIT-158 — Guardar el plan contratado en el checkout

Responsable: Axel. Rama: `panel_web/conexiones`.

## Qué hace

Al pagar en el checkout simulado (`/checkout`), la organización queda con el plan
elegido y el panel se desbloquea. No hay cobro real y no se guarda nada de la tarjeta.

| Elegido en el checkout | Se guarda en `orgs/{orgId}.plan` | Análisis por mes |
| --- | --- | --- |
| Básico, primera vez | `prueba` (1 mes) | 15 |
| Básico, después de haber contratado antes | `basico` | 30 |
| Pro | `pro` | 150 |
| Ultra | `ultra` | Sin tope |

Además se guardan `billingCycle` (`mensual` o `anual`) y `planSince` (hora del
servidor). Con esos dos datos, Configuración → Plan muestra el periodo y la próxima
renovación; en la prueba muestra cuándo termina (`proximaRenovacion` en
`web/src/panel/lib/planes.js`).

## Cómo funciona

- `App.jsx` pasa `contratar` a `<Checkout />`, que llama a `contratarPlan()`
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

- Unitarias: `contratarPlan.test.js`, `Checkout.test.jsx`, `planes.test.js`
  (renovación mensual, anual y fin de la prueba) y Configuración → Plan.
- Reglas (`npm run test:rules`): dueño contrata Pro y Ultra, prueba una sola vez,
  planes, periodos, fechas y campos inválidos, y que nadie más que el dueño contrate.

## Pendiente (PCIT-67 y cobro real)

- El pago es simulado: cualquier dueño puede activarse Ultra desde la web. Con un
  cobro real, el plan debe escribirlo el servidor tras confirmar el pago.
- El fin de la prueba se muestra, pero todavía nada pasa la organización a `free`
  cuando vence.
