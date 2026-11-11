# AceCam

Panel para gestionar jugadores, analizar videos de tenis y consultar estadísticas
y el video procesado. Desarrollo del equipo en `panel_web/conexiones`; integración
mediante PR hacia `panel_web/base`.

## Encender el programa

**[Guía detallada para Windows: encendido, prueba y apagado](docs/GUIA-ENCENDIDO-WINDOWS.md)**

Para analizar un archivo local deben estar encendidos tres componentes:

| Terminal | Componente | Función |
| --- | --- | --- |
| 1 | Emuladores de Firebase | Sesiones, base de datos y archivos locales |
| 2 | Web | Interfaz que se abre en Edge |
| 3 | Worker Python | Modelo, estadísticas y video anotado |

La guía incluye la configuración actual del PC de Fabián, una alternativa estándar
para otros equipos y cómo conservar los datos antes de apagar. Los pesos y el
entorno Python se descargan en cada PC; no están incluidos en Git.

## Documentación

- [Modelo de análisis: uso, informe, métricas y limitaciones](model/README.md).
- [Frontend e integración con Firebase](web/README.md).
- [Contrato de datos](docs/firestore-schema.md).
- [Permisos por rol](docs/PCIT-39-permisos-por-rol.md).
- [Contador y límites de análisis por plan](docs/PCIT-41-limite-de-analisis.md).
- [Gestión de jugadores](docs/PCIT-42-gestion-completa-jugadores.md).
- [Dashboard](docs/PCIT-43-dashboard-completo.md).
- [Video procesado](docs/PCIT-161-video-procesado.md).
- [Requisitos y límites de los videos](docs/videos-largos-y-fuentes.md).

La ejecución descrita usa emuladores locales y el proyecto `demo-acecam`.
El checkout es una simulación; no realiza cobros ni activa una suscripción real.
