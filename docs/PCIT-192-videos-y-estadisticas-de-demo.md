# PCIT-192 · Videos y estadísticas de ejemplo

Desde `web`, ejecuta `npm run emulators` en una terminal y `npm run seed` en otra. El seed reconstruye los datos locales de Auth y Firestore y carga los videos en Storage emulado. Para ver el resumen sin escribir, ejecuta `npm run seed -- --dry-run`.

Abre AceCam conectado a los emuladores, entra con la cuenta ficticia de Universidad Demo indicada por el seed y abre **Partidos → Ver reporte**. Los partidos listos tienen un MP4 de ejemplo en Storage y estadísticas ficticias de saque, golpes, desplazamiento, peloteos, marcador y puntos. El reproductor usa el mismo video ilustrativo que el landing. Las cifras son datos de demostración.

El seed usa el proyecto `demo-acecam` y solo acepta direcciones de emuladores en el propio equipo.
