# Componentes compartidos · PCIT-25

Importación: `import { KpiCard, StatusBadge, DataTable, SegmentedControl, LoadingState, EmptyState, ErrorState } from './components/ui'` (ajustar la ruta desde cada pantalla).

## Vista de ejemplos

Ejecutar `npm run dev` y abrir `/components.html`. Permite probar ambos temas,
estados de tabla y acciones de reintento. Todos los valores están identificados
como ejemplos. Esta entrada es de desarrollo; `npm run build` mantiene la entrada
normal `index.html` y no publica la galería.

## Contratos

- `KpiCard`: `label` y `value` (texto o número). `null`/`undefined` muestra —;
  cero sigue siendo cero. Opcionales: `unit`, `description`, `trend` y
  `trendTone` (`positive`, `negative`, `neutral`). El llamador calcula y describe
  la tendencia: menos dobles faltas puede ser positivo.
- `StatusBadge`: `status` usa los textos de dominio: `en cola`, `procesando`,
  `listo`, `error`, `nueva`, `en revisión`, `analizada`, `contactada`, `descartada`.
  Acepta mayúsculas/espacios exteriores. Un estado desconocido conserva su texto
  con estilo neutro; uno ausente muestra Sin estado. `label` permite un texto
  explícito. El significado siempre es legible sin depender del color.
- `SegmentedControl`: `label` visible, `options: [{ value, label, disabled? }]`,
  `value` y `onChange(value)`. Los valores deben ser strings únicos. Radios
  nativos: Tab entra al grupo y las flechas cambian de opción; `disabled` bloquea
  todo el grupo. `name` opcional; por defecto cada instancia tiene nombre único.
  El estado es controlado por la página.
- `DataTable`: `caption` obligatorio y descriptivo, `columns: [{ key, label,
  align?, render? }]`, `rows` y `rowKey` (nombre del campo ID o función).
  Cada fila debe tener clave única y estable. `render(value, row)` permite badges
  o acciones. `align: 'right'` para números. Los valores ausentes muestran —.
  Prioridad: `loading`, `error`, vacío y finalmente tabla. `error` puede ser un
  mensaje seguro o un booleano; `onRetry` es opcional. `emptyTitle` y
  `emptyDescription` personalizan el vacío. La tabla permite scroll horizontal
  con teclado en pantallas estrechas. No incluye ordenación ni paginación.
- `LoadingState`: `title`, `description` opcionales; mensaje anunciado como
  estado y animación reducida según preferencias del usuario.
- `EmptyState`: `title`, `description`, `actionLabel`, `onAction` opcionales.
- `ErrorState`: `title`, `description`, `onRetry` y `retryLabel` opcionales.
  Solo el texto es alerta; el botón de reintento queda fuera de ella.

## Tema y estilos

Los estilos se importan con cada componente y usan clases `ac-*`, sin cambiar
el layout de la aplicación. Defaults oscuros; un ancestro `[data-theme='light']`
activa los colores claros oficiales. Para integrar PCIT-90/92 se pueden definir
en un ancestro `--ace-ui-text`, `--ace-ui-card`, `--ace-ui-field`,
`--ace-ui-border`, `--ace-ui-muted`, `--ace-ui-accent` (texto/foco),
`--ace-ui-positive` y `--ace-ui-negative`. Los botones y la opción seleccionada
usan acento #D7F25C con texto #12110F en ambos temas. Se hereda la tipografía
del layout; Barlow y el selector global pertenecen a las historias de Rolando.

## Separación de responsabilidades

Los componentes son presentacionales y no acceden a servicios externos.
La capa de datos para los próximos módulos se documenta en
`src/panel/lib/services/README.md`. La página administra carga/error/datos, y pasa
props y callbacks. Ninguna métrica de demostración se conecta al Dashboard.
