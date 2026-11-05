# Comparador v1 · PCIT-57

En **Comparador**, selecciona dos jugadores distintos y agrega hasta dos
columnas más. Los indicadores se actualizan cuando Firestore recibe el
resultado del análisis.

La pantalla usa el mismo resumen por jugador que el Dashboard. El entrenador
consulta jugadores y partidos que registró. El administrador consulta los de
su organización. Las consultas incluyen el ámbito de la sesión. La política
general por rol de Firestore se desarrolla en PCIT-39.

El valor destacado se calcula entre los números que se muestran en cada fila.
Se marca el menor valor en dobles faltas y el mayor en las demás filas.
Se indican los empates y los campos sin medición aparecen como «Sin datos».
La cantidad de partidos y golpes indica el volumen de datos. Las velocidades
respetan la unidad elegida en Configuración.

Para verificar la pantalla, ejecuta `npm test` desde `web/`. Para comprobar
las consultas con cuentas de prueba, ejecuta `npm run test:rules` y abre
`/comparador` en la app conectada a Firebase Emulator Suite.
