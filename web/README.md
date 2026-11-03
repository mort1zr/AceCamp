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

## Estructura

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
