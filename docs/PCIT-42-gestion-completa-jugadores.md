# PCIT-42 — Gestión completa y perfil de jugadores

## Criterios de aceptación

| Criterio | Entrega |
| --- | --- |
| Búsqueda, filtros y paginación | Se conserva PCIT-150, ahora dentro del alcance por rol de PCIT-39. |
| Perfil completo | Datos personales, deportivos, apoderado y partidos analizados. |
| Edición validada | Formulario precargado con nombre, nacimiento, academia, categoría, mano, revés, UTR, ranking, nacionalidad, graduación, entrenador y apoderado. |
| Eliminación validada | Confirmación para retirar de plantilla; conserva partidos, videos y notas. |
| Rol y organización | Coach solo sus registros; admin los de su organización. Comprobación en UI, servicio, transacción y reglas. |

## Edición

El alta y la edición comparten los campos y validaciones. Los campos opcionales
se pueden limpiar; los números se convierten a tipos numéricos y los enums se
validan contra el esquema. Las fechas deben existir y no ser futuras. Los menores
requieren nombre, teléfono y correo del apoderado. Las reglas comprueban los
datos también cuando se omite el formulario.

La actualización solo escribe campos editables, nunca organización, propietario,
fecha de creación ni metadatos de autorización. Se conserva la autorización
original; el formulario no simula registrar una autorización nueva al editar.
La transacción compara `updatedAt` con la versión abierta al iniciar la edición.
Si cambió, informa el conflicto y conserva el borrador para no sobrescribir el
avance de otra persona. Ante errores de red conserva los valores y permite
reintentar. La suscripción actualiza el perfil/listado después de guardar.

## Eliminación de plantilla

Es una eliminación lógica: `service.remove()` registra `deletedAt` y `updatedAt`
con fecha de servidor. La confirmación explica que los datos y el historial se
conservan; el foco comienza en Cancelar y vuelve al botón al cancelar. Los
errores permiten reintentar y el envío pendiente desactiva los botones.

Los jugadores retirados se ocultan de la plantilla, Dashboard, Comparador y
selector de nuevos análisis. El servidor rechaza encolar partidos nuevos para
ellos. Partidos consulta también las fichas retiradas para conservar los nombres
en los reportes históricos. No se borran videos ni notas, no se transfieren
jugadores entre entrenadores y no se añade una restauración en esta entrega.
Esta acción no es un borrado definitivo de datos personales.

## Verificación

- 233 pruebas web correctas; compilación y lint correctos con los avisos previos
  de bundle y Fast Refresh en `idioma.jsx`.
- 50 pruebas de registro, Firestore, roles y Storage en emuladores aislados.
- SDK real: edición del coach y del admin, metadatos y consentimiento inmutables,
  rechazo de edición obsoleta, fecha/apoderado/deporte inválidos por acceso
  directo, retirada de plantilla y conservación del historial, y rechazo de
  nuevos análisis del jugador retirado.
- UI: contacto del apoderado, validación, borrador tras error de red, guardado,
  confirmación, cancelación con foco y reintento de eliminación.
- Se conservan los tests de búsqueda, paginación y aislamiento por rol; se
  actualiza la expectativa de apoderado del perfil a su nuevo alcance autorizado.

No se modificaron jugadores ni cuentas del ensayo del usuario. Las pruebas usan
`demo-acecam-pcit39-roles`, separado del proyecto de ensayo; las reglas quedan
versionadas y no se desplegaron a Firebase real. No se afirma una nueva revisión
visual automatizada en Edge. Para revisar: Jugadores → Ver perfil → Editar jugador
o Eliminar de la plantilla.
