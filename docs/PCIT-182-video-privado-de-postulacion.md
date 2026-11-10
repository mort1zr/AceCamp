# PCIT-182 · Adjuntar video a una postulación

La carga está disponible en la demo local con los emuladores de Firebase.
Inicia los emuladores y ejecuta `npm run demo` en `web/` con las rutas
de `ffprobe` y `yt-dlp` configuradas según [el README de la web](../web/README.md).
Abre la demo en `http://127.0.0.1:5176`.

1. El dueño o administrador crea un enlace en **Reclutamiento**.
2. Abre el enlace de la demo en una ventana sin sesión. Completa los datos,
   adjunta un MP4 o MOV opcional y confirma la autorización.
3. Se admiten hasta 60 segundos y 500 MiB, al menos 1280 píxeles en el lado
   largo y 720 en el corto, y de 25 a 60 FPS. El navegador comprueba
   duración y dimensiones. La API comprueba formato y metadatos antes
   de guardar en Storage.
4. Al confirmar el archivo, la bandeja muestra **Video adjunto**. Si falla
   la carga, se puede reintentar desde la misma pantalla con la postulación
   que ya quedó guardada.

El servidor guarda el archivo sin token de descarga y solo confirma
`videoPaths` tras subirlo. Los clientes tienen cerrado el acceso directo
al objeto. La lectura por la API verifica un token de Firebase Auth y
el rol y organización del usuario en Firestore. Desactivar el enlace
detiene nuevas cargas y conserva las ya confirmadas.

El uso en un entorno compartido sigue en PCIT-147. El envío del video a
la cola de análisis corresponde a PCIT-148.
