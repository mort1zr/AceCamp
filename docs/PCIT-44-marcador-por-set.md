# PCIT-44 · Marcador por set en Partidos

Abre **Partidos → Ver reporte → Desglose por set** para ver los juegos del
jugador registrado y su rival en cada set completo que detectó el modelo.
Los reportes sin sets guardados muestran el aviso de datos faltantes.

El worker guarda cada set de `matches.statistics.score.sets` como un objeto
con `playerGames` y `opponentGames`. El formato interno del modelo conserva
las parejas de juegos que usa el marcador del video. El panel también admite
parejas en los datos de ejemplo anteriores.

El reporte conserva el marcador ingresado por el usuario, los filtros,
el video procesado, los indicadores y las notas privadas.
