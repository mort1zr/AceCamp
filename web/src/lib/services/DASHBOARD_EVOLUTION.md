# PCIT-140 — evolución con Recharts

## Alcance implementado

Gráfico de velocidad media de saque por partido, con Recharts 3.10.1, tabla
alternativa de datos, fechas ordenadas y huecos en mediciones ausentes. Se conecta
al Dashboard mediante `overview.data.evolution`, sin crear otra suscripción a
Firestore ni otro servicio Firebase.

La integración con Aaron continúa diferida por instrucción del usuario. La tarea
permanece En curso hasta contrastar una salida real, verificar reglas/sesión y el
recorrido de PCIT-35 a Dashboard. No se presenta la demostración como ese recorrido.

## Contrato y flujo

`buildDashboardEvolution(matches, context)` utiliza el mismo contexto y decoder
explícito de PCIT-139. La forma normalizada del JSON sigue siendo una propuesta;
no se infiere velocidad de saque desde velocidades de golpes del modelo.

```js
{
  playerId: 'jugador-actual',
  points: [
    { matchId, playerId, date: 'YYYY-MM-DD', opponent, averageServeSpeed }
  ]
}
```

- Los documentos deben ser de la misma organización/jugador y estar `listo`.
- Se deduplican por ID y se usa `matchDate`, nunca fecha de subida ni fecha actual
  como sustituto. Fechas inválidas, ausentes o futuras no producen puntos.
- La velocidad por partido es sumKmh / sampleCount según el contrato de adaptación.
  Cero muestras o estadística incompatible dejan el valor en null.
- Los partidos se ordenan por fecha; si coinciden en el mismo día, se ordenan por
  ID para dar estabilidad. No se supone una hora que no esté registrada.
- Cada posición horizontal representa un partido, no una escala proporcional
  al número de días entre ellos. Las etiquetas de fecha y los rivales permiten
  identificar varios partidos del mismo día.
- Una medición ausente conserva el hueco del partido: `connectNulls=false` y
  línea `linear`, sin crear observaciones intermedias. Un cero real sí se dibuja.
- Con una sola medición se muestra un punto y se indica que no permite inferir
  tendencia. Sin valores se muestra un estado explícito, conservando la tabla
  de partidos cuando hay fechas válidas.

El servicio de PCIT-139 publica resumen y evolución a partir del mismo snapshot.
Cada documento se decodifica como máximo una vez por snapshot, evitando
inconsistencias y trabajo duplicado. La selección y los errores siguen el hook
de Dashboard: no permanecen gráficos de otro jugador/organización.

## Integración de interfaz

`EvolutionPanel` utiliza por defecto `DashboardEvolution` y pasa el playerId
seleccionado, la evolución recibida y el indicador de demostración. El punto de
montaje anterior `renderEvolution` se conserva como opción explícita.

El componente valida de nuevo que la serie y sus puntos pertenezcan al jugador
actual; no convierte cadenas o valores no finitos a cero. Los estados de carga
y error ocultan las observaciones anteriores; el error permite reintentar cuando
se suministra el callback.

El gráfico usa la serie terracota oficial #D0623A en ambos temas. El resto hereda
los tokens del layout. Las fechas de la tabla se formatean sin convertirlas a una
zona horaria; así no retroceden un día al interpretar YYYY-MM-DD.

Recharts incluye navegación por teclado mediante la capa de accesibilidad,
activada explícitamente en este componente. También se ofrece «Ver datos del
gráfico» con fecha completa, rival y valor/unidad o Sin datos.

Referencias primarias: [LineChart](https://recharts.github.io/api/LineChart/),
[accesibilidad de Recharts](https://github.com/recharts/recharts/blob/main/storybook/stories/API/Accessibility.mdx)
y [ejemplo de huecos](https://recharts.github.io/en-US/examples/LineChartConnectNulls/).

## Demostración y validación pendiente

En `/dashboard.html`, Valeria muestra seis mediciones ficticias; Mateo tiene un
hueco intermedio y su KPI agregado queda Sin datos conforme a la política de
PCIT-139. Camila no tiene una serie. Los ejemplos siguen aislados de producción.

Las pruebas usan casos controlados, SDK simulado y el SVG real de Recharts.
Comprueban la separación de segmentos en un hueco, los estados, la tabla, la
selección y los cálculos por partido. No acreditan una descarga de videos, una
salida JSON real ni las reglas de Firestore.

El último avance revisado de ModeloAI (d5904cb, PCIT-34) incorpora configuración
por CLI, controles de calidad, FPS reales y correcciones de detección de golpes.
Su caché JSON guarda detecciones, no el contrato de estadísticas del worker que
falta para conectar datos reales: main.py sigue produciendo un video anotado.

Antes de Listo: conectar el decoder acordado, verificar matches reales o de
emulador con reglas de acceso y contrastar el recorrido del worker. Los gráficos
y filtros avanzados de PCIT-43 permanecen fuera del alcance de Sprint 1.
