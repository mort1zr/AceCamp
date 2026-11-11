# PCIT-55 · Publicación en Firebase Hosting

La web de AceCam se publica sola desde GitHub Actions en
**https://acecam-e93a2.web.app**. Nadie ejecuta `firebase deploy` a mano.

## Flujo completo

| # | Paso | Dónde | Qué comprueba o hace |
| --- | --- | --- | --- |
| 1 | PR a `main` | GitHub | Se abre desde una rama del repositorio, por ejemplo `panel_web/conexiones`. |
| 2 | CI de la web | `web-ci.yml` | Lint, pruebas, build, `check:csp` y pruebas de reglas. Si falla, no se despliega nada. |
| 3 | Vista previa | `deploy-web.yml` | Publica la PR en `acecam-e93a2--pr…web.app` (7 días) y deja la URL como comentario en la PR. |
| 4 | Merge en `main` | GitHub | Revisión aprobada por @mort1zr cuando toca `.github/` o `firebase/`. |
| 5 | Build de producción | `deploy-web.yml` | Inyecta la versión (`ACECAM_VERSION` = commit) en `<meta name="acecam-version">` (PCIT-198). |
| 6 | Publicar en Hosting | `deploy-web.yml` | Sube `web/dist` al canal `live`. |
| 7 | Reglas e índices | `deploy-web.yml` | Publica `firestore.rules` y los índices. Storage solo con `DEPLOY_STORAGE_RULES=true`. |
| 8 | Comprobar la web en vivo | `scripts/checkDeploy.mjs` | Descarga la web publicada hasta 6 veces y exige que su versión sea el commit desplegado (PCIT-199). Va después de las reglas para que un fallo aquí no deje la web nueva con las reglas viejas. |
| 9 | Resumen | `scripts/deploySummary.mjs` | Tabla en la página del run con la URL, la versión y el resultado de cada paso, también si algo falla (PCIT-200). |

## Qué versión está publicada

- En el navegador: abre la web, **Ver código fuente** y busca `acecam-version`.
- Desde la terminal:

  ```bash
  cd web
  node scripts/checkDeploy.mjs https://acecam-e93a2.web.app/ <commit esperado>
  ```

  Termina con código 0 si la versión coincide y con 1 si no.
- En GitHub: **Actions → Deploy web →** el último run en `main` → **Summary**.

Un build local sin `ACECAM_VERSION` ni `GITHUB_SHA` lleva la versión `local`.

## Qué hacer si falla un paso

| Paso que falla | Causa habitual | Qué hacer |
| --- | --- | --- |
| CI de la web | Lint, una prueba o el hash de la CSP | Ejecuta `npm test`, `npm run lint`, `npm run build` y `npm run check:csp` en `web/` y corrige antes del merge. |
| Deploy omitido con aviso | Falta el secreto `FIREBASE_SERVICE_ACCOUNT_ACECAM` o las variables `VITE_FIREBASE_*` | Configúralos según [devsecops.md §3.1–3.2](devsecops.md#31-cuenta-de-servicio-de-despliegue). |
| Publicar en Hosting | Clave de la cuenta de servicio revocada o sin rol de Hosting | Crea una clave nueva y actualiza el secreto. |
| Comprobar la web en vivo | La caché de Hosting aún sirve la versión anterior, o se publicó otro build | Vuelve a ejecutar el run (**Re-run failed jobs**). Si persiste, compara la versión publicada con el commit del run. |
| Reglas e índices | Las reglas no compilan o falta el rol *Administrador de Firebase Rules* | Ejecuta `npm run test:rules` y revisa los roles de la cuenta de servicio. |
| Reglas de Storage | El proyecto está en plan Spark | Es lo esperado: se omiten. Ver [Reglas de Storage y plan Blaze](devsecops.md#33-qué-pasa-en-cada-despliegue). |

Para volver a una versión anterior: **Firebase Console → Hosting → Historial de
versiones → Restaurar**, o revierte el commit en `main` para que el pipeline
publique de nuevo.

## Relación con otras tareas

- **PCIT-169 (Aaron):** creó el workflow de despliegue y la vista previa por PR.
- **PR #21:** el deploy deja de fallar por Storage en el plan Spark y publica las reglas de Firestore.
- **PCIT-198 a PCIT-202:** versión en el build, comprobación en vivo, resumen del run,
  README con la URL e insignias, y este documento.

Configuración de cuentas, variables y CSP: [devsecops.md §3](devsecops.md#3-despliegue-en-firebase-hosting).
