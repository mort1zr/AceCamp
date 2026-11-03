# Jugadores v1 · PCIT-26

## Estado de integración

Interfaz, validaciones, servicio Firestore y demostración implementados en
`interfaces_Fabian`. Las tareas PCIT-20/21/22/23 de Axel siguen pendientes en la
consulta de Jira realizada durante esta implementación. No se dispone de una
sesión Firebase ni de un esquema definitivo para probar datos reales.

PCIT-26 permite empezar con ejemplos. Abrir `/jugadores.html` con `npm run dev`:
la demostración está identificada, usa memoria y se reinicia al recargar. Usar
solo datos ficticios. No se escribe en Firebase ni en almacenamiento del navegador.
La entrada normal de producción no importa la demostración.

## Contrato propuesto para acordar con PCIT-22

Colección `players`, documentos con estos campos mínimos:

| Campo | Formato / procedencia |
| --- | --- |
| fullName | Nombre y apellidos, texto normalizado, 2–120 caracteres |
| birthDate | Fecha calendario YYYY-MM-DD; no se guarda la edad calculada |
| academy | Texto opcional, hasta 120 caracteres |
| orgId | Organización autenticada, fuera del formulario |
| createdBy | UID del entrenador autenticado |
| createdAt | serverTimestamp de Firestore |
| consent | accepted, version, recordedBy, recordedAt y method |

`consent.method = coach-attestation`: registra la confirmación del entrenador
sobre la autorización recibida, no una firma directa del jugador. El texto del
formulario está versionado como `players-v1`; el mecanismo y el aviso de privacidad
definitivos deben coordinarse con las tareas de consentimiento y datos del equipo.
No se declara que esta interfaz sustituya dicho proceso. Perfil deportivo,
apoderado, edición, búsqueda y paginación pertenecen a PCIT-42.

## Conexión en la aplicación autenticada

La página `src/pages/Jugadores.jsx` exporta `Jugadores({ service })`. Su ruta final
será `/jugadores`, ya prevista en PCIT-96 en la rama de Rolando. No se ha fusionado
esa rama ni reemplazado su layout dentro de la rama personal de Fabián.

Crear el servicio **una vez por sesión/organización**, por ejemplo mediante
`useMemo`, y pasarlo a la página:

```jsx
import { createFirestorePlayersService } from './lib/services/firestorePlayersService.js'

const playersService = useMemo(() => {
  if (!db || !user?.uid || !profile?.orgId) return null
  return createFirestorePlayersService({ db, orgId: profile.orgId, actorId: user.uid })
}, [db, user?.uid, profile?.orgId])

// En la ruta autenticada /jugadores:
<Jugadores service={playersService} />
```

`db`, `user` y `profile` proceden de Firebase y AuthContext de Axel. No se inicializa
otra app Firebase. Sin servicio la página muestra indisponibilidad, nunca ejemplos
como respaldo silencioso. No introducir credenciales en el código.

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
- `npm run lint` y `npm run build`.
- Revisión visual de `/jugadores.html` en ambos temas y en móvil.

El SDK Firebase trae un transporte Node gRPC indirecto. Se fija un override
`@grpc/grpc-js ^1.13.6` porque la versión transitiva original generaba avisos de
seguridad en npm audit. No se usa ese transporte como backend del navegador.

No fue necesario crear otra incidencia Jira: las dependencias ya están cubiertas
por PCIT-20/21/22/23. No publicar pull requests sin autorización del usuario.
