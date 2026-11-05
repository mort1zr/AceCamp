# PCIT-39 — Administrador y entrenador

Responsable: Fabián, reasignado por petición del usuario el 5 de noviembre de
2026. La implementación desbloquea PCIT-42 y se entrega en su propio commit.

## Matriz de acceso

| Recurso | Coach | Admin |
| --- | --- | --- |
| Jugadores, perfil y apoderado | Solo `createdBy == uid` de su organización | Todos los de su organización |
| Partidos y cola | Solo sus registros | Todos los de su organización |
| Alta de partido | Solo para un jugador propio | Para un jugador de su organización |
| Video original/procesado de un partido | Solo sus partidos | Todos los de su organización |
| Video antes de registrar el partido | Solo su propia subida | Subidas de su organización |
| Nota privada | Solo su nota en un partido accesible | Solo su nota en un partido accesible |
| Rol/organización del perfil | No puede cambiarlos desde el cliente | No puede cambiarlos desde el cliente |

La ficha `users/{uid}` de Firestore es la autoridad del rol. Declarar `admin` en
un argumento de JavaScript o en claims falsificados no cambia los permisos.
El registro público sigue creando `coach`; esta tarea no concede roles nuevos
a usuarios reales ni implementa invitaciones o administración de miembros.

Los datos generales de organización y miembros conservan el alcance compartido
anterior. Las postulaciones conservan las reglas de organización hasta su
entrega específica; no se introducen permisos públicos en PCIT-39.

## Implementación

Firestore valida rol, organización y propietario tanto para consultas como para
acceso directo, edición y borrado. `orgId`, `createdBy`, consentimiento y fechas
de creación siguen siendo inmutables. La web no puede escribir estadísticas ni
estados del worker. Admin SDK mantiene su acceso para procesar los videos.

Storage valida el propietario del partido incluso con una ruta conocida. Si aún
no existe el partido, la lectura del original requiere autoría de la subida.
El cliente nunca escribe ni borra el MP4 procesado.

Jugadores, Dashboard, Comparador, cola y consultas de uso/configuración ajustan
su alcance al rol. Un coach siempre añade el filtro `createdBy`; no puede quitarlo
pasando `onlyOwned: false`. Los perfiles de colegas se ocultan incluso si un SDK
simulado devuelve filas fuera del alcance. El uso mostrado para un entrenador
corresponde a sus análisis visibles; no es un contador global de cuota impuesto
por servidor. La gestión de facturación no cambia en esta entrega.

## Verificación

- 230 pruebas web correctas, compilación y lint correctos, con los avisos
  anteriores de Fast Refresh y tamaño del bundle.
- 47 pruebas con emuladores: registro, reglas anteriores, permisos por rol y
  Storage. Comprueban administrador, dos entrenadores de la misma organización,
  otra organización, rol desconocido, acceso sin sesión, escalamiento de rol,
  cambio de propietario y rutas de videos ajenos.
- Las pruebas de UI comprueban que el coach no recibe el botón de perfil de
  colegas y que el admin sí puede consultar esos perfiles en su organización.

Las pruebas completas se ejecutaron con instancias separadas, proyecto
`demo-acecam-pcit39-roles`: Auth 9198, Firestore 62820 y Storage 9299. La instancia
de ensayo del usuario se conserva. Los tests permiten configurar sus puertos y
proyecto para no limpiar los datos del ensayo existente. Para pruebas conjuntas
de Storage y Firestore, ambos emuladores deben pertenecer al mismo proyecto.

Las reglas quedan versionadas en Git; esta entrega no despliega reglas a un
proyecto real ni habilita servicios de pago.
