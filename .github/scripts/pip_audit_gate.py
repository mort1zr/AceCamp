"""Decide si el resultado de pip-audit bloquea la CI (PCIT-165).

Uso: pip-audit -f json -o audit.json ; python .github/scripts/pip_audit_gate.py audit.json

- Falla (código 1) si hay vulnerabilidades en cualquier paquete que no esté en
  PENDIENTES.
- Los paquetes de PENDIENTES se informan en el resumen del job, pero no bloquean:
  cada uno tiene un ticket para resolverlo.
- Escribe una tabla en $GITHUB_STEP_SUMMARY cuando existe.
"""

from __future__ import annotations

import json
import os
import sys

# Paquete -> ticket que lo resuelve. Quitar la entrada cuando el ticket se cierre.
PENDIENTES = {
    "torch": "PCIT-168",
    "torchvision": "PCIT-168",
}


def main(path: str) -> int:
    with open(path, encoding="utf-8") as fh:
        report = json.load(fh)

    blocking: list[tuple[str, str, str, str]] = []
    pending: list[tuple[str, str, str, str]] = []
    for dep in report.get("dependencies", []):
        for vuln in dep.get("vulns", []):
            row = (
                dep["name"],
                dep.get("version", "?"),
                vuln["id"],
                ", ".join(vuln.get("fix_versions") or []) or "sin corrección",
            )
            (pending if dep["name"].lower() in PENDIENTES else blocking).append(row)

    lines = ["## pip-audit", ""]
    if not blocking and not pending:
        lines.append("Sin vulnerabilidades conocidas.")
    for title, rows in (("Bloquean la CI", blocking), ("Pendientes con ticket (no bloquean)", pending)):
        if not rows:
            continue
        lines += [f"### {title}", "", "| Paquete | Versión | Aviso | Corregido en | Ticket |", "|---|---|---|---|---|"]
        for name, version, vid, fix in rows:
            lines.append(f"| {name} | {version} | {vid} | {fix} | {PENDIENTES.get(name.lower(), '')} |")
        lines.append("")
    text = "\n".join(lines) + "\n"

    print(text)
    summary = os.environ.get("GITHUB_STEP_SUMMARY")
    if summary:
        with open(summary, "a", encoding="utf-8") as fh:
            fh.write(text)
    return 1 if blocking else 0


if __name__ == "__main__":
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    sys.exit(main(sys.argv[1]))
