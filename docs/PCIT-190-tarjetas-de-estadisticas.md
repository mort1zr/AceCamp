# PCIT-190 · Tarjetas de estadísticas

`TarjetaEstadistica` reutiliza el estilo de `KpiCard`. Recibe una etiqueta, un valor numérico y, opcionalmente, una unidad, una descripción y una comparación. Formatea la cifra con hasta un decimal. Un cero medido se muestra como `0` y una medida ausente como `Sin datos`.

`TarjetasEstadisticas` recibe una lista de tarjetas con un `id` estable para cada grupo. La cuadrícula se muestra en una columna en móvil y añade columnas conforme aumenta el ancho.

Para ver los ejemplos de saque, golpes, desplazamiento y peloteos, ejecuta `npm run dev` desde `web` y abre `/previews/components.html`. PCIT-191 conecta las tarjetas con los datos del jugador y del partido.
