# Servicios de datos

Las páginas y hooks de cada módulo consumen los servicios de esta carpeta.
Los componentes de `src/components/ui` reciben datos y callbacks mediante props:
no inicializan Firebase, no consultan Firestore y no calculan métricas del modelo.

Al implementar PCIT-26/27/28, añadir aquí servicios para jugadores y partidos
que usen la configuración Firebase compartida de Axel (PCIT-20/22/24).
Filtrar por organización y conservar los estados de carga, error y vacío en la página
o su hook. Pasar a DataTable `rows`, `loading`, un mensaje de error apto para el
usuario y `onRetry`. No exponer errores técnicos ni credenciales en la interfaz.

PCIT-25 no incorpora un backend ni datos ficticios a la aplicación. Los únicos
datos de ejemplo están aislados en `src/previews`, fuera de la entrada del build
normal. Los KPIs de producción deben proceder de estadísticas reales (PCIT-28).
