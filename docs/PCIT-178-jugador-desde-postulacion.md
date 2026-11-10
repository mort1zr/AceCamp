# PCIT-178 · Crear o vincular jugador desde una postulación

1. En **Reclutamiento**, pulsa **Crear o vincular** en la fila del postulante.
2. Selecciona una ficha activa de tu plantilla y pulsa **Vincular jugador**.
   Si todavía no hay ficha, usa **Crear jugador nuevo**, revisa los datos
   precargados y confirma la autorización de registro del jugador.
3. Una vez guardado el vínculo, pulsa **Ver ficha**. El entrenador puede abrir
   sus fichas y el administrador las fichas de su organización.

Si hay una coincidencia de nombre y fecha de nacimiento en la plantilla
visible, se ofrece vincular la ficha existente. Los reintentos y las
operaciones simultáneas sobre una misma postulación conservan el primer
vínculo. Para un alta nueva, la ficha y el vínculo se escriben en una sola
transacción.

Las pruebas de pantalla cubren la autorización, el alta, la ficha existente y
la reapertura de la ficha vinculada. El emulador comprueba dos sesiones sobre
la misma postulación y rechaza vínculos ajenos, inexistentes o que reemplacen
uno ya guardado.

El envío del video a la cola de análisis se sigue en PCIT-148.
