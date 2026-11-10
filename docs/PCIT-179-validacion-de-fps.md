# PCIT-179 · Validación de FPS en el worker

El worker lee los FPS informados por el archivo después de descargarlo y
antes de ejecutar el modelo. Los valores de `worker.min_fps` y
`worker.max_fps` se configuran en `model/config.yaml`. El rango por defecto
es de 25 a 60 FPS inclusive. Se recomienda exportar a 30 FPS.

Si el video queda fuera del rango o sus FPS no se pueden verificar, el
partido termina en **Error**. **Analizar video → Cola de análisis** muestra
el motivo. El valor alternativo que usa el lector de video para otras
herramientas del modelo queda fuera de esta validación.

## Pruebas

- Archivos de 25, 30 y 60 FPS pasan al modelo.
- Archivos de 24 o 61 FPS se rechazan antes de ejecutar el modelo.
- Un archivo que no informa sus FPS recibe un mensaje específico.
- La cola muestra el motivo de rechazo en la fila del partido.

PCIT-147 sigue el trabajo de adjuntar y validar videos en el formulario
público y de alinear la validación de resolución con la web.
