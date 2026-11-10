# PCIT-180 · Prueba de enlaces de postulación

El botón **Crear enlace** puede aparecer antes de que React registre la
suscripción a Firestore. La prueba espera a que se registre la suscripción
a la colección de la organización antes de simular los datos recibidos.

La prueba conserva las comprobaciones de crear, compartir y desactivar
un enlace. El cambio se limita a la prueba de PCIT-54.

Para verificarlo, ejecuta `npm test` desde `web/`.
