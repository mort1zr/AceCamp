# PCIT-162 — Integración del diseño de Otin

Integración de `panel_web/diseno@3de8fb5` en `panel_web/conexiones`, realizada el
5 de noviembre de 2026. Se conservan los commits originales de Rolando Roller
(Otin):

| Commit | Tarea | Cambio |
| --- | --- | --- |
| `5450aa8` | PCIT-36 | Menú de cuenta en los controles de precios. |
| `a4f26f7` | PCIT-116 | Checkout simulado con resumen y confirmación. |
| `15167ac` | PCIT-36 | Precios → registro/login → checkout con plan y ciclo conservados. |
| `3de8fb5` | PCIT-36 | Cuenta sin plan, acceso a configuración y bloqueo visual del panel. |

## Compatibilidad

La integración automática de `App.jsx` conserva el Dashboard conectado, la ruta
de Partidos con Storage y los servicios de análisis. No cambia el modelo ni las
reglas de seguridad, y no retira el reproductor privado de PCIT-161.

`free` ahora representa una cuenta sin plan (`ninguno`). Los planes `basico`,
`pro` y `ultra` mantienen sus accesos; `prueba` es una opción distinta. La vista
local de plan se guarda por UID para no propagarse entre cuentas. Esta vista
y el bloqueo del panel son presentación; no sustituyen permisos de servidor.

## Alcance del checkout

Se conserva como **simulación**, con aviso y tarjeta de prueba. No hay conexión
a un proveedor de cobros, facturación activa ni cambios de infraestructura.
Los campos completos de tarjeta permanecen en memoria del componente y se
vacían tras la simulación; no se envían a Firestore ni se guardan en localStorage.

La ruta monta `Checkout` sin un servicio `contratar`; su callback predeterminado
no realiza ninguna operación. Por tanto, la confirmación simulada **no activa
ni persiste un plan real**. No se presenta esta integración como backend de
pagos terminado. Una cuenta `free` seguirá sin plan real después de simular.
Para las pruebas actuales se conserva el plan existente del emulador.

## Verificación

- Suite web final, incluida la integración de planes: 228 pruebas.
- Compilación y lint correctos; permanecen los avisos existentes de bundle y
  Fast Refresh de `idioma.jsx`.
- Regresiones de login/registro conservan `plan` y `ciclo` al volver al checkout.
- Checkout sin sesión redirige al registro manteniendo el destino.
- Cuenta sin plan permite configuración y bloquea las secciones del panel.
- Vista de plan por UID: la simulación de una cuenta no aparece en la siguiente.
- Las pruebas existentes de Dashboard, reportes y reproductor siguen pasando.

No se afirma una nueva revisión visual automatizada. Las pruebas no activan
pagos ni crean usuarios de facturación. El backend de pagos continúa fuera del
alcance de esta tarea de integración.

## Propuesta de incorporación al equipo

El destino confirmado por Fabián es un PR de `panel_web/conexiones` hacia
`panel_web/base`, donde el equipo revisará la integración. No se propone ni se
abre un PR hacia `main` en esta entrega. No se publica ni se fusiona ningún PR
sin la autorización previa que solicitó Fabián. Los cambios permanecen
publicados en conexiones mientras se revisa la propuesta.
