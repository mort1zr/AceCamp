# PCIT-43 — Dashboard completo con los datos disponibles

## Criterios y entrega

| Criterio de Jira | Comportamiento |
| --- | --- |
| Jugador y perfil | Conserva la selección y los datos personales de la ficha; cambio de sesión o jugador retira los resultados anteriores. |
| Periodo | Todo, último mes, 3 y 6 meses. Indicadores, último partido, gráficos y evolución usan el mismo snapshot y periodo. |
| Siete KPIs | Partidos analizados, golpes medidos, velocidad media de golpe, velocidad media de saque, primer saque dentro, dobles faltas y distancia recorrida. |
| Tendencias | Diferencia contra el periodo anterior de igual duración. Solo con valores comparables; porcentajes en puntos porcentuales, velocidades en km/h o mph y distancia en metros. Todo no inventa un periodo anterior. |
| Último partido | Conserva la tarjeta entregada en PCIT-153, filtrada por el periodo elegido. |
| Evolución de saque | Serie propia de velocidad media de saque hasta el bote, por fecha de partido; tabla accesible, valores ausentes y advertencia si solo hay una medición. Se conserva también la evolución de golpe. |
| Saque | Contadores de primeros saques dentro y dobles faltas. Segundo saque dentro muestra Sin datos porque el contrato no lo entrega. |
| Peloteos | Barras de 0–4, 5–8 y 9+ golpes, media ponderada por número de peloteos y máximo. Declara cuántos análisis aportaron distribución. |
| Movimiento | Distancia acumulada y velocidad máxima disponibles. |
| Radar, derecha/revés y mapa de calor | Secciones explícitas Sin datos, conforme al criterio de Jira para métricas aún ausentes del modelo. |

Los siete indicadores pertenecen al Dashboard; no se añade una métrica incompleta
al Comparador por compartir su catálogo anterior. Los campos opcionales siguen
mostrándose como Sin datos cuando no existen, en lugar de ocultar indicadores.

## Contrato y límites

Se usa el esquema publicado `acecam.match-stats.v1`, `statistics.player` ya
asignado por el worker según la posición del jugador, y `statistics.rallies` para
los peloteos del partido. Se filtran organización, jugador, estado Listo e ID
único antes de calcular. No se confunden las velocidades de golpe y saque.

Los indicadores totales requieren datos completos para ese campo. Una ausencia
no se sustituye por cero. La distancia se suma y la velocidad máxima se compara;
el promedio de velocidad del saque usa suma de velocidades/cantidad de muestras.

En el gráfico de peloteos se permite un subconjunto con distribución válida, con
cobertura visible de análisis incluidos/total. No se asignan ceros a los demás.
Se validan contadores y coherencia de los tramos antes de agregarlos. La media
de duración es suma de golpes/cantidad de peloteos; el más largo es un máximo,
no una suma ni una media de máximos.

No hay puntuaciones normalizadas 0–100 para un radar, clasificación derecha/revés,
posiciones por zona persistidas para un mapa de calor ni contador explícito de
segundos saques dentro. Se explica su ausencia; no se infieren estos datos de
velocidades, distancias, intentos de saque ni de los nombres de los jugadores.
Estos estados vacíos cumplen la excepción explícita de PCIT-43 y no certifican
la implementación futura de tales capacidades del modelo.

## Verificación

- Suite web: 218 pruebas. Compilación y lint; permanecen los avisos conocidos de
  Fast Refresh en `idioma.jsx` y tamaño del bundle.
- Prueba integrada de siete indicadores, gráficos y tabla de saque, peloteos,
  tendencia de distancia y recálculo al cambiar periodo y jugador.
- Pruebas de agregación ponderada, duplicados, aislamiento por organización y
  jugador, estados pendientes, contadores inválidos, datos parciales y ceros.
- La serie de saque conserva huecos; no rellena una velocidad ausente con la de
  golpe. Las líneas no conectan huecos y no animan valores inventados.
- Se ejecutaron los agregadores con estadísticas del jugador de prueba obtenidas
  del emulador local, incluidas las generadas por el worker real. Estos datos
  permanecen fuera del repositorio y no se usan como respaldo de producción.

Esta entrega modifica la presentación y agregación web. No cambia el detector,
los permisos de Firebase, los datos guardados ni los estados de los partidos.
No se afirma una nueva revisión visual automatizada en Edge; las verificaciones
descritas son pruebas de interfaz y de datos. Para revisión manual, abrir
`/dashboard`, seleccionar el jugador y alternar Todo/1/3/6 meses.
