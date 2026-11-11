# AceCam

[![CI de la web](https://github.com/mort1zr/Proyecto_Carrera_III_Tenis/actions/workflows/web-ci.yml/badge.svg?branch=main)](https://github.com/mort1zr/Proyecto_Carrera_III_Tenis/actions/workflows/web-ci.yml)
[![Despliegue en Firebase Hosting](https://github.com/mort1zr/Proyecto_Carrera_III_Tenis/actions/workflows/deploy-web.yml/badge.svg?branch=main)](https://github.com/mort1zr/Proyecto_Carrera_III_Tenis/actions/workflows/deploy-web.yml)

Panel para gestionar jugadores, analizar videos de tenis y consultar estadísticas
y el video procesado.

## Producción

La web está publicada en **https://acecam-e93a2.web.app** (Firebase Hosting).

| Paso | Qué pasa |
| --- | --- |
| 1. Rama de trabajo | El equipo desarrolla en ramas como `panel_web/conexiones`. |
| 2. Pull request a `main` | La CI de la web corre lint, pruebas, build, CSP y reglas. El despliegue publica una **URL de vista previa** (dura 7 días) y la deja como comentario en la PR. |
| 3. Merge en `main` | Se publica en Hosting, se comprueba que la web en vivo sirve la versión del commit y se publican las reglas e índices de Firestore. |
| 4. Resumen | La página del run en GitHub Actions muestra una tabla con la URL, la versión y el resultado de cada paso. |

Para saber qué versión está publicada, abre la web, mira el código fuente y busca
`<meta name="acecam-version">`: su valor es el commit del build.

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
