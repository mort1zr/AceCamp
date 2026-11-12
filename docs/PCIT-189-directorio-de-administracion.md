# PCIT-189 · Directorio de administración

En **Administración** (`/admin`), una cuenta con permiso de plataforma puede consultar organizaciones y usuarios. La tabla de organizaciones muestra el plan registrado, la cantidad de fichas de usuario asociadas y los análisis usados en el mes UTC actual. Un contador mensual ausente equivale a cero.

La tabla de usuarios muestra correo, organización, rol de equipo y fecha de alta. Ambas tablas consultan Firestore al abrir la pantalla. Los permisos de lectura provienen de PCIT-188 y el directorio carece de acciones de edición o borrado.
