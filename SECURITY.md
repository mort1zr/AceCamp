# Política de seguridad

AceCam guarda datos personales de jugadores, incluidos menores de edad, y los
protege según la Ley 29733 de Protección de Datos Personales. Si encuentras una
vulnerabilidad, repórtala de forma privada para que podamos corregirla antes de
que se publique.

## Cómo reportar

1. En GitHub, abre la pestaña **Security** del repositorio y pulsa
   **Report a vulnerability**. El reporte solo lo ve el equipo.
2. Incluye:
   - qué componente está afectado: web, reglas de Firebase, worker del modelo o pipeline;
   - los pasos para reproducirlo;
   - el impacto: qué datos se exponen o qué se puede hacer.
3. **No abras un issue público** ni compartas los detalles hasta que esté corregido.

**No incluyas datos reales de jugadores, contraseñas ni claves en el reporte.**
Si encontraste una clave expuesta, indícanos dónde está, no su valor.

## Qué esperar

| Paso | Plazo |
|---|---|
| Confirmación de recepción | 3 días hábiles |
| Evaluación y severidad | 7 días hábiles |
| Corrección de severidad alta o crítica | Lo antes posible; te avisaremos al publicarla |

## Versiones con soporte

Solo la rama `main`, que es la que se despliega. Las demás ramas son de trabajo.

## Alcance

- **Dentro:**
  - la web (`web/`);
  - las reglas de Firestore y Storage (`firebase/`);
  - el worker y el modelo (`model/`);
  - los workflows de GitHub Actions (`.github/`).
- **Fuera:**
  - los servicios de Google Firebase y GitHub en sí;
  - los ataques de denegación de servicio;
  - la ingeniería social al equipo.

El pipeline de seguridad está descrito en [docs/devsecops.md](docs/devsecops.md).
