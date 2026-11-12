# PCIT-203 · Auditoría administrativa

En `/admin/auditoria`, los administradores de plataforma pueden consultar los últimos 100 cambios. Cada registro muestra la fecha, el UID del responsable, la entidad y los valores modificados.

Las operaciones de PCIT-204 y PCIT-205 deberán llamar a `recordPlatformChange` dentro de la transacción de la entidad y guardar el identificador retornado como `platformAuditId`. Sus reglas de escritura deberán exigir ese registro nuevo en la misma transacción. Las reglas de la bitácora verifican que el registro coincida con el actor, el momento y los valores antes y después de la operación.

El alcance de la bitácora incluye nombre, plan y archivo de organizaciones, rol y suspensión de usuarios, y organización, rol y estado de invitaciones. Los clientes no pueden editar ni borrar entradas. Las operaciones administrativas que alimentan la bitácora se incorporan con PCIT-204 y PCIT-205.
