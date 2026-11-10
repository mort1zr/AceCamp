# PCIT-181 · Resolución mínima del video

**Analizar video** y el worker exigen al menos 1280 píxeles en el lado largo
y 720 en el corto. Esto admite 1280×720 en horizontal y 720×1280 en
vertical. Un archivo de 720×720 queda por debajo del mínimo.

El formulario comprueba el archivo local antes de subirlo. El worker
vuelve a comprobarlo antes de ejecutar el modelo. Ambos muestran el
siguiente mensaje cuando la resolución es insuficiente.

> El video debe tener al menos 720p (1280×720). Grábalo o expórtalo en 720p o 1080p.

El worker conserva la opción `worker.min_resolution` para el lado corto
y calcula el mínimo del lado largo con la proporción 16:9. El valor 0
desactiva la comprobación de resolución.

Las pruebas usan clips horizontales, verticales y cuadrados, incluidos
archivos por debajo de cada límite. PCIT-147 sigue el trabajo de adjuntar
y validar videos en el formulario público.
