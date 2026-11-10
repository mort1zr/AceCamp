# PCIT-174 · Bandeja de postulaciones

Primera entrega de PCIT-56. La ruta `/reclutamiento` muestra el nombre, la
ciudad, el año de graduación y el estado de las postulaciones de la organización.
La consulta usa una suscripción a `applications` filtrada por `orgId`, con las
reglas existentes de Firestore. La pantalla usa la disponibilidad del menú
de Reclutamiento, desde Pro.

## Cómo comprobarla

1. Ingresa en el panel con un entrenador o administrador de una organización
   con acceso a Reclutamiento y abre esa sección.
2. Escribe el nombre de un postulante o su ciudad. La búsqueda acepta texto con
   o sin tildes. Combínala con el filtro de estado.
3. Si la consulta falla, usa **Reintentar**. Una organización sin postulaciones
   muestra un mensaje distinto al de una búsqueda sin coincidencias.

La prueba automatizada verifica los filtros, el aislamiento de la consulta por
organización, el cambio de sesión, el reintento y el acceso según el plan.

PCIT-56 sigue abierto para el flujo de estados y la creación de jugadores sin
duplicados. PCIT-54 cubre el formulario público y PCIT-148 el análisis de videos
de postulaciones.
