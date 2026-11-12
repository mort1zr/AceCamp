# PCIT-188 · Acceso de administración

El pie del landing tiene el enlace **Administración**. Abre `/admin`, que usa el login existente y un espacio separado del panel del entrenador. El permiso se verifica con Firestore. Al cerrar sesión se vuelve al landing.

## Conceder acceso

1. En el proyecto Firebase correspondiente, identifica el UID de la cuenta en **Authentication**. Puede ser una cuenta dedicada sin ficha de equipo.
2. Un operador autorizado del proyecto crea el documento `platformAdmins/{uid}` desde la consola de Firestore o el Admin SDK. El documento puede estar vacío. Su existencia concede el permiso.
3. Inicia sesión y abre **Administración**. Para revocar el acceso, borra el documento.

El permiso permite consultar `orgs`, `users` y los contadores de uso. Las escrituras siguen sujetas a las reglas existentes de cada equipo. Los jugadores, las postulaciones, los partidos y los videos conservan el acceso por organización. Los clientes solo pueden leer su propia marca de plataforma.

Verifica el acceso, la revocación, el cierre de sesión y la separación de permisos con `npm test -- src/panel/pages/admin` y `npm run test:rules` desde `web`.
