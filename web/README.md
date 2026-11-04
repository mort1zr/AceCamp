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
| `npm run emulators` | Emuladores locales de Auth, Firestore y Storage |
| `npm run seed` | Carga datos de ejemplo en los emuladores (con los emuladores ya encendidos) |
| `npm run test:rules` | Pruebas de las reglas de Firestore (PCIT-23) y Storage (PCIT-24) y del registro (PCIT-21); enciende y apaga los emuladores |

## Firebase (PCIT-20)

La web usa un solo proyecto de Firebase con **Auth** (correo y contraseña),
**Firestore** y **Storage**. Todo se inicializa una vez en
[src/lib/firebase.js](src/lib/firebase.js); el resto de la app importa de ahí:

```js
import { auth, db, storage } from '../lib/firebase.js'
```

Ningún otro archivo debe llamar a `initializeApp`.

### Configurar el `.env`

```bash
cp .env.example .env
```

Completa los valores `VITE_FIREBASE_*` (Configuración del proyecto → General →
Tus apps → app web, o pídeselos a Axel). `.env` está en `.gitignore`: **nunca se sube**.
Si falta un valor, la app falla al arrancar con un mensaje que dice cuál.

### Trabajar con los emuladores (recomendado para desarrollar)

Los emuladores corren en tu máquina con el proyecto `demo-acecam`: no tocan
datos reales y no necesitan credenciales ni el `.env` completo.

Requisitos: Java 11 o superior (los emuladores de Firestore y Storage lo usan).

```bash
# Terminal 1
npm run emulators            # UI en http://127.0.0.1:4000

# Terminal 2, con VITE_USE_FIREBASE_EMULATORS=true en .env
npm run dev
```

| Servicio | Puerto |
| --- | --- |
| Auth | 9099 |
| Firestore | 8080 |
| Storage | 9199 |
| Interfaz de los emuladores | 4000 |

Con los emuladores encendidos, `npm run seed` carga dos organizaciones con
jugadores, partidos y postulaciones de ejemplo. Puedes iniciar sesión con
`coach@acecam.test` / `acecam123`.

### Reglas de seguridad (PCIT-23)

[`firestore.rules`](../firestore.rules) deja leer y escribir solo a usuarios con
sesión y solo los documentos de su organización (`orgId`). Antes de subir un
cambio en las reglas, corre `npm run test:rules` (no hace falta tener los
emuladores encendidos; si lo están, apágalos primero porque usan el mismo puerto).

Las reglas se publican en el proyecto real con
`npx firebase deploy --only firestore:rules` (requiere `npx firebase login`).

### Esquema de datos (PCIT-22)

Colecciones, campos y estados: [docs/firestore-schema.md](../docs/firestore-schema.md).
Los nombres de colecciones y estados se importan desde
[src/lib/schema.js](src/lib/schema.js); no los escribas a mano.

La configuración vive en la raíz del repositorio (`firebase.json`, `.firebaserc`,
`firestore.rules`, `storage.rules`), porque la web y el modelo comparten el mismo
proyecto. Por ahora las reglas niegan todo; las reglas por organización llegan
en PCIT-23 (Firestore) y PCIT-24 (Storage).

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
PCIT-141 prepara el contrato de API y su adaptador de navegador, descritos en
[VIDEO_IMPORT_HTTP.md](src/lib/services/VIDEO_IMPORT_HTTP.md). Aún no se despliegan
ni conectan a Auth/Storage o YouTube; los enlaces reales siguen deshabilitados.
El [proveedor YouTube](server/video-import/YOUTUBE.md) está preparado con pruebas
locales. La demostración acepta sus enlaces de ejemplo sin descargar videos.

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
    ├── lib/           Utilidades y clientes de servicios (firebase.js)
    ├── pages/         Una carpeta o archivo por pantalla
    └── styles/        Variables de tema y estilos globales
```

## Stack

React 19 · Vite · React Router · Tailwind CSS v4 · Firebase (Auth, Firestore, Storage)
