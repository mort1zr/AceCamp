# AceCam · web

Frontend de AceCam: plataforma que analiza videos de partidos de tenis con IA y muestra
estadísticas por jugador para entrenadores y reclutadores universitarios.

## Requisitos

- Node.js 20 o superior
- npm 10 o superior

## Instalación

```bash
cd web
npm install
```

## Arrancar en desarrollo

```bash
npm run dev
```

Vite levanta el servidor en http://localhost:5173 con recarga en caliente.

## Otros comandos

| Comando | Qué hace |
| --- | --- |
| `npm run dev` | Servidor de desarrollo |
| `npm run build` | Compila a producción en `dist/` |
| `npm run preview` | Sirve el build de producción |
| `npm run lint` | Revisa el código con oxlint |
| `npm test` | Pruebas de los componentes compartidos |

## Componentes compartidos (PCIT-25)

Con el servidor de desarrollo activo, abre `http://localhost:5173/components.html`
para revisar tarjetas KPI, badges, tabla, selector y estados de carga/vacío/error
en claro y oscuro. Los valores de esa página son ejemplos y no se publican en
el build habitual. Contratos y uso: [src/components/ui/README.md](src/components/ui/README.md).
La separación de acceso a datos se describe en
[src/lib/services/README.md](src/lib/services/README.md).

## Estructura

```
web/
├── public/            Archivos estáticos servidos tal cual
└── src/
    ├── assets/        Imágenes, íconos y capturas
    ├── components/    Componentes reutilizables
    ├── hooks/         Hooks propios
    ├── lib/           Utilidades y clientes de servicios
    ├── pages/         Una carpeta o archivo por pantalla
    └── styles/        Variables de tema y estilos globales
```

## Stack

React 19 · Vite · React Router · Tailwind CSS v4
