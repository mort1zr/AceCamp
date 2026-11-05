# Comparador · PCIT-57 y PCIT-68

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

## Comparar el mismo jugador

- **Por periodos.** Selecciona un jugador y compara el tramo actual de tres
  meses con el que terminó hace 3, 6 o 9 meses. Se usa la fecha del partido.
  El rango actual incluye el día de hoy. Los rangos anteriores incluyen su
  fecha inicial y excluyen la fecha de corte para que un partido no cuente
  dos veces. Si el día no existe en el mes de corte, se usa su último día.
- **Partido contra partido.** Selecciona dos partidos Listo distintos del
  jugador. Se muestran las estadísticas disponibles de cada partido. Los
  partidos sin fecha pueden seleccionarse aquí y quedan fuera de los rangos
  por periodo.

Al cambiar el rango o los partidos del mismo jugador se reutiliza la
suscripción existente. La vista expone los indicadores y los campos usados
para identificar el partido.

Para verificar la pantalla, ejecuta `npm test` desde `web/`. Para comprobar
las consultas con cuentas de prueba, ejecuta `npm run test:rules` y abre
`/comparador` en la app conectada a Firebase Emulator Suite.
