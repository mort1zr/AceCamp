# PCIT-54 · Formulario público de postulación

1. En **Reclutamiento**, el dueño o un administrador de la organización pulsa
   **Crear enlace**. Comparte la URL desde la misma instancia donde se creó.
2. La persona abre la URL sin cuenta y envía sus datos y la autorización
   de tratamiento de datos. Para menores de 18 años se piden los datos y
   la autorización de un apoderado.
3. La bandeja de la organización recibe la postulación en **Nueva**.
4. Usa **Desactivar** para dejar de recibir postulaciones por ese enlace.
   Las postulaciones recibidas se conservan.

## Reglas de acceso

Cada enlace vive en `orgs/{orgId}/applicationForms/{formId}`. El visitante
puede consultar un enlace concreto y crear una postulación con campos
validados. Solo el equipo de la organización puede leer las postulaciones.
El dueño o administrador gestiona los enlaces desde el panel.

El formulario recibe los datos de la postulación. Los requisitos para adjuntar
o enlazar videos se siguen en PCIT-147 y el análisis desde la bandeja en PCIT-148.
