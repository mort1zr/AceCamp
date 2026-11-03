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

PCIT-134 prepara el núcleo de importación HTTPS y validación del archivo en
[server/video-import](server/video-import/README.md), con pruebas locales.
Todavía no hay API ni conexión real con Auth/Storage o YouTube; los enlaces de
la aplicación no se habilitan por este avance.

## Interfaz de Dashboard (PCIT-138)

Vista de desarrollo: `http://localhost:5173/dashboard.html`.
Selector de jugador, tarjetas y estados de carga/vacío/error con ejemplos
identificados. El cálculo real y el gráfico corresponden a PCIT-139 y PCIT-140.
Contrato de integración: [src/lib/services/DASHBOARD_UI.md](src/lib/services/DASHBOARD_UI.md).

## Consulta y cálculos de Dashboard (PCIT-139)

Estructura de consulta por jugador/organización y agregación de KPIs preparada.
La conexión con el JSON de Aaron queda pendiente: no se adivinan campos ni se
presenta el SDK simulado como una integración real.
Contrato propuesto y fórmulas: [src/lib/services/DASHBOARD_DATA.md](src/lib/services/DASHBOARD_DATA.md).
En `/dashboard.html`, el escenario «Sin indicadores» muestra cómo se tratan
resultados todavía no compatibles.

## Evolución con Recharts (PCIT-140)

El Dashboard incluye el gráfico y una tabla de las mediciones por partido.
Los valores ausentes dejan huecos; no se sustituyen por ceros ni se dibujan
tendencias con un único dato. Los ejemplos de `/dashboard.html` son ficticios.
La conexión real con el modelo sigue pendiente.
Detalles: [src/lib/services/DASHBOARD_EVOLUTION.md](src/lib/services/DASHBOARD_EVOLUTION.md).

## Directorios

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
