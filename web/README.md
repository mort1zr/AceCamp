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

## Jugadores v1 (PCIT-26)

Vista de desarrollo: `http://localhost:5173/jugadores.html`.
Permite probar lista y alta sin recargar, con datos ficticios en memoria.
La conexión real depende de Firebase/Auth y el esquema compartido de Axel;
no se usa el modo demo como respaldo en producción.
Contrato de servicio y pasos de integración: [src/lib/services/PLAYERS.md](src/lib/services/PLAYERS.md).

## Analizar video v1 (PCIT-27)

Vista de desarrollo: `http://localhost:5173/analizar.html`.
Permite seleccionar archivo o enlace, vincular/crear jugador, completar el partido
y probar una cola en memoria. No transfiere ni procesa videos reales.
La integración pendiente con Storage, Firestore y el worker se detalla en
[src/lib/services/ANALYSIS.md](src/lib/services/ANALYSIS.md).

## Carpetas

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
