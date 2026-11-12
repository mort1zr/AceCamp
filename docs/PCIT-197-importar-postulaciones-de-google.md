# PCIT-197 · Importar respuestas de Google Forms

AceCam valida las respuestas de la pestaña registrada con los mismos requisitos de contacto, fecha y apoderado del formulario propio. Solo se importan filas con autorización afirmativa. Las filas con problemas se indican por número para que puedan corregirse y volver a sincronizarse.

La organización, el ID de la hoja, la pestaña, la marca temporal y el correo identifican una respuesta. La importación usa una transacción de Firestore. Si la postulación existe, conserva sus datos y estado. Los documentos importados se muestran en la bandeja como postulaciones nuevas y registran quién hizo la importación.

Las reglas permiten al dueño o administrador registrar la hoja e importar respuestas de su organización. Las postulaciones son visibles para el equipo de esa organización. La configuración de la hoja es privada.

Desde `web`, ejecuta `npm test -- src/panel/lib/googleFormsApplications.test.js` y `npm run test:rules` para verificar validación, permisos y sincronizaciones repetidas.
