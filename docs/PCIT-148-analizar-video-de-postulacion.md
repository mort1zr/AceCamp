# PCIT-148 · Analizar video de una postulación

En la demo local, abre **Reclutamiento**, vincula una ficha al postulante
y entra en **Ver videos**. Elige si el jugador aparece arriba o abajo
en la cancha y pulsa **Analizar video**.

El partido se incorpora a la cola normal y consume un análisis del plan.
El worker lee el video privado de la postulación y guarda el procesado
en la carpeta del partido. Al terminar, actualiza la postulación a
**Analizada** si sigue en **Nueva** o **En revisión**.

El detalle muestra cuánto video se analizó, cuántos golpes se midieron,
las velocidades y la distancia recorrida. Si falla, muestra el mensaje
del worker y permite reintentar el mismo partido.

Los enlaces quedan pendientes de la importación por URL. La carga privada
de videos en un entorno compartido se sigue en PCIT-147.
