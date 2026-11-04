# Dashboard v1 — interfaz PCIT-138

## Alcance de esta tarea

PCIT-138 es una Tarea independiente del Sprint 1, relacionada con PCIT-28.
Incluye selector superior, perfil básico, tarjetas KPI, contenedor de evolución,
estados de carga/vacío/error y vistas clara/oscura y móvil.

PCIT-139 implementará la consulta y los cálculos reales. PCIT-140 implementará el
gráfico con Recharts. No se incluyeron sus cambios en el commit de PCIT-138 ni se
instaló una librería de gráficos solo para dibujar ejemplos.

## Vista de desarrollo

Abrir `/dashboard.html` con `npm run dev`. Seleccionar un jugador para revisar las
tarjetas. La barra de escenarios permite comprobar carga, ausencia de datos y
error. Valeria tiene ejemplos completos, Mateo una métrica ausente y Camila no
tiene ejemplos de estadísticas. Todos los valores están identificados como
ficticios; no proceden de Firebase ni del modelo. La entrada normal del build no
importa estas vistas ni los servicios de demostración.

## Integración de la página

`src/panel/pages/Dashboard.jsx` recibe:

```jsx
<Dashboard
  playersService={playersService}
  overviewService={overviewService}
  renderEvolution={renderEvolution}
/>
```

La ruta final `/dashboard` ya está prevista por PCIT-96 en la rama de Rolando.
No se fusionó esa rama ni se reemplazó su layout. La página hereda los tokens y
tipografías compartidos y reutiliza componentes de PCIT-25.

`playersService` es la instancia estable de la sesión de PCIT-26. No tener ese
servicio muestra indisponibilidad, nunca ejemplos por defecto.

`overviewService` es el contrato de presentación para PCIT-139:

```js
{
  scopeKey, // Igual que playersService: proyecto, organización y usuario
  mode,     // 'live' o 'demo'; debe coincidir con playersService
  subscribePlayer(playerId, onData, onError) { /* devolver unsubscribe */ }
}
```

El callback `onData` recibe un modelo de vista, no el JSON crudo del worker:

```js
{
  metrics: {
    analyzedMatches: null,   // Entero >= 0
    averageServeSpeed: null, // Número >= 0, km/h
    firstServeInRate: null,  // Número 0–100, porcentaje (no fracción 0–1)
    doubleFaults: null       // Entero >= 0
  }
}
```

Estos son nombres del contrato de UI propuesto, no un esquema de matches ya
acordado. PCIT-139 debe definir el mapeo, las fórmulas y unidades con PCIT-22/35.
`null`, campos ausentes y números inválidos muestran — y «Sin datos». Un cero
válido sigue siendo cero. No se convierten cadenas, NaN ni valores imposibles a
un cero ficticio. La interfaz solo formatea, no calcula promedios ni tendencias.

Sin overviewService se pueden revisar perfil y tarjetas vacías, con un aviso de
indisponibilidad. No se presenta esta situación como una conexión real completa.
Los cambios de jugador, servicio, organización y reintentos descartan los datos
anteriores y limpian suscripciones; eventos tardíos no repueblan otra selección.

`renderEvolution({ playerId })` es el punto de montaje para PCIT-140. Solo se
invoca con un jugador disponible y un resumen recibido. Debe consumir datos del
mismo scope; no debe cerrar sobre una organización o un jugador anterior.
Sin ese componente, el contenedor presenta un estado explícito de indisponibilidad,
sin inventar una curva de evolución.

## Validación y cierre

La tarea UI se puede cerrar tras pruebas, revisión visual y publicación de su
único commit `PCIT-138 ...` en interfaces_Fabian. PCIT-28 permanece incompleta
hasta entregar PCIT-139/140 y comprobar los datos reales y el flujo del worker.
No se publicó un pull request: requiere instrucción del usuario.
