# PCIT-176 · Validación previa a la subida

Al pulsar **Añadir a la cola** con un archivo local en **Analizar video**, el
navegador lee los metadatos. Se aceptan hasta 60 segundos y se requieren al
menos 1280 píxeles en el lado largo y 720 en el corto. Si el archivo se rechaza,
la pantalla explica el motivo y conserva los datos del partido para reemplazar
el video. El rechazo ocurre antes de transferir el archivo o registrar el partido.

El navegador muestra un estado de verificación separado del progreso de carga.
Si no puede leer los metadatos en 10 segundos, pide elegir otro archivo. Los
recursos locales se liberan al terminar o cancelar la lectura.

## Verificación

Las pruebas cubren los límites de dimensiones y duración, los metadatos
ilegibles, la cancelación y el rechazo sin encolar desde la pantalla. También
comprueban que un archivo de reemplazo puede enviarse.

Este paso se aplica a archivos locales. La verificación fiable de FPS sigue en
PCIT-147 junto con la validación del worker. El formulario público corresponde
a PCIT-54.
