# PCIT-40 — Invitar miembros al equipo

Responsable: Axel. Rama: `panel_web/conexiones`.

## Flujo

1. En **Configuración > Equipo** (visible con plan Ultra), el dueño de la
   organización o un administrador escribe el correo y el rol (`coach` o `admin`).
2. Se crea `invites/{correo}` con estado `pendiente`. La tabla del equipo la muestra
   como *Invitación enviada* y se puede **anular** mientras siga pendiente. Si el
   correo ya es de un miembro o ya tiene una invitación pendiente, la pantalla lo
   explica sin escribir nada.
3. El plan Spark no envía correos: la pantalla muestra el enlace
   `/registro?invitacion=<correo>` para copiarlo y compartirlo.
4. Con ese enlace, el registro rellena el correo y no pide organización. Al crear la
   cuenta, `registerCoach()` busca la invitación pendiente de su correo y, en un solo
   lote, crea `users/{uid}` con el `orgId` y el rol invitados y marca la invitación
   como `aceptada`. Si alguien se registra sin el enlace pero con un correo invitado,
   también se une a esa organización.
5. Si el enlace no tiene invitación detrás, el registro avisa y borra la cuenta de
   Auth para que pueda registrarse con su propia organización.

## Reglas (`firebase/firestore.rules`)

| Acción | Quién |
| --- | --- |
| Crear invitación | Dueño o admin de la organización; ID = correo en minúsculas, estado `pendiente`, `invitedBy` propio, no a su propio correo, sin pisar una existente |
| Listar / leer | Dueño o admin de esa organización; la persona invitada solo lee la suya |
| Aceptar | Solo la cuenta con ese correo, en el mismo lote que crea su ficha |
| Anular | Dueño o admin, solo si está `pendiente` |
| Crear `users/{uid}` con invitación | `orgId` y `role` iguales a los de la invitación pendiente |

Pruebas: `web/tests/rules/invites.rules.test.js` y `web/tests/auth/register.test.js`
(`npm run test:rules`), más las unitarias de `invitaciones.test.js`,
Configuración y Registro.

## Probarlo con los datos de ejemplo

`npm run seed` crea una invitación pendiente de Universidad Demo para
`asistente@acecam.test` e imprime su enlace. Abre
`/registro?invitacion=asistente%40acecam.test`, crea la cuenta y entrarás al equipo
como coach. Con `coach@acecam.test` (dueño, plan Ultra) se ve la invitación en
Configuración > Equipo.

## Límites conocidos (revisar en PCIT-67)

- Firebase Auth no exige verificar el correo: quien se registre primero con el correo
  invitado se une al equipo. Para producción conviene exigir `email_verified`.
- Un correo con una invitación de otra organización no se puede volver a invitar hasta
  que la anulen.
- Una cuenta ya registrada no puede cambiarse de organización con una invitación.
