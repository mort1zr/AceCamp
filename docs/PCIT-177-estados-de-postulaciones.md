# PCIT-177 · Cambiar el estado de una postulación

En **Reclutamiento**, elige un estado disponible en la fila del postulante y
pulsa **Guardar**. Firestore actualiza la bandeja y los filtros con el estado
guardado. Una postulación descartada termina el flujo.

- Nueva → En revisión → Analizada.
- Analizada → Contactada o Descartada.
- Contactada → Descartada.

El guardado usa una transacción que comprueba el estado leído en pantalla
y registra el usuario y la hora. Si otra sesión cambió la postulación,
la bandeja muestra un aviso y conserva el cambio más reciente.

Las pruebas de pantalla cubren un guardado y una edición concurrente.
Las pruebas en el emulador verifican que las reglas rechazan cambios entre
organizaciones, estados inválidos, saltos y retrocesos.
