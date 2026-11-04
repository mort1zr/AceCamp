# Jugadores v1 · PCIT-26

## Estado de integración

Interfaz, validaciones, servicio Firestore y demostración implementados en
`interfaces_Fabian`. Axel publicó la inicialización de Firebase (PCIT-20) y
el esquema de Firestore en revisión (PCIT-22, rama `FireBaseComienzo`,
revisión `74572b6`). La conexión de sesión (PCIT-21) y las reglas por
organización (PCIT-23) siguen pendientes.

PCIT-26 permite empezar con ejemplos. Abrir `/jugadores.html` con `npm run dev`:
la demostración está identificada, usa memoria y se reinicia al recargar. Usar
solo datos ficticios. No se escribe en Firebase ni en almacenamiento del navegador.
La entrada normal de producción no importa la demostración.

## Campos del alta según el esquema en revisión de PCIT-22

Colección `players`, documentos con estos campos mínimos:

| Campo | Formato / procedencia |
| --- | --- |
| fullName | Nombre y apellidos, texto normalizado, 2–120 caracteres |
| birthDate | Fecha calendario YYYY-MM-DD; no se guarda la edad calculada |
| academy | Texto opcional, hasta 120 caracteres |
| guardian | Para menores de 18 años, objeto con `name`, `phone` y `email` |
| orgId | Organización autenticada, fuera del formulario |
| createdBy | UID del entrenador autenticado |
| createdAt | serverTimestamp de Firestore |
| consent | accepted, version, recordedBy, recordedAt y method |

`consent.method = coach-attestation`: registra la confirmación del entrenador
sobre la autorización recibida, no una firma directa del jugador. El texto del
formulario está versionado como `players-v1`; el mecanismo y el aviso de privacidad
definitivos deben coordinarse con las tareas de consentimiento y datos del equipo.
El alta mínima captura los datos del apoderado que exige el esquema para menores.
El perfil deportivo, la edición, la búsqueda y la paginación pertenecen a PCIT-42.

## Conexión en la aplicación autenticada

La ruta `/jugadores` de PCIT-96 puede pasar a `Jugadores` la instancia `db` de
PCIT-20 y una sesión que reúna el UID y la organización del mismo usuario
autenticado. La página mantiene una instancia del servicio por base de datos,
usuario y organización. El proveedor de sesión debe retirar el valor al salir
o mientras carga el perfil de otra cuenta.

```jsx
<Route path="/jugadores" element={<Jugadores db={db} session={session} />} />
```

`session` es `{ uid, orgId }` y debe derivarse de la sesión y el perfil verificados
por PCIT-21. Si falta alguno de los dos valores, la pantalla muestra el estado de
indisponibilidad. El prop `service` se conserva para las vistas de demostración y
las pruebas. La conexión se ensayó en una copia aislada de la ruta y layout de
Rolando (`fdddeed`) con el SDK de Firestore simulado.

El servicio expone `subscribe(onPlayers, onError)` con función de limpieza y
`create(input)`. El listener usa `where('orgId', '==', orgId)` y actualiza la lista
sin recargar. Al cambiar de servicio se descarta la suscripción anterior y sus
eventos tardíos. El scope incluye proyecto, organización y usuario.

El filtrado del cliente no sustituye las reglas de Firestore de PCIT-23. Antes de
cerrar la tarea deben probarse con Auth y reglas reales/emuladas: lectura y alta de
la organización correcta, rechazo entre organizaciones, identidad/consentimiento
no suplantables y actualización tras escribir. Los tests actuales del adaptador
usan el SDK simulado y no acreditan estas reglas.

## Diseño

Reutiliza DataTable y estados de PCIT-25. La página hereda tipografía y tokens
`--bg`, `--surface`, `--surface2`, `--line2`, `--text`, `--muted`, `--accent-ink`,
`--good` y `--bad` observados en la rama de Rolando. Incluye defaults oficiales
para la vista aislada, sin copiar su layout ni su selector global.

## Verificación

- `npm test`: validación, consentimiento obligatorio, altas sin recargar, errores
  sin pérdida del formulario, bloqueo de doble envío y cambio de organización.
- El adaptador se prueba con SDK simulado: filtro por orgId, campos permitidos,
  identidad de sesión, consentimiento con timestamp y propagación de errores.
- En el proyecto local `demo-acecam-pcit135`, con Auth y Firestore Emulator y dos
  cuentas ficticias, se comprobó el alta de un menor, su aparición por suscripción,
  la persistencia al iniciar sesión desde otra instancia de la app y el rechazo
  de lecturas y escrituras entre organizaciones. También se verificó el rechazo
  de lecturas sin sesión. Esta prueba usó reglas temporales de alcance reducido.
  Falta repetirla con el proveedor de PCIT-21 y las reglas definitivas de PCIT-23.
- `npm run lint` y `npm run build`.
- Revisión visual de `/jugadores.html` en ambos temas y en móvil.

El SDK Firebase trae un transporte Node gRPC indirecto. Se fija un override
`@grpc/grpc-js ^1.13.6` porque la versión transitiva original generaba avisos de
seguridad en npm audit. No se usa ese transporte como backend del navegador.

No fue necesario crear otra incidencia Jira: las dependencias ya están cubiertas
por PCIT-20/21/22/23. No publicar pull requests sin autorización del usuario.
