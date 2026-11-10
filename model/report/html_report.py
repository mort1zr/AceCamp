"""Informe HTML del partido (TA-34, TA-36): un solo archivo, sin dependencias, para abrir en el
navegador. Lleva el marcador, el resumen de cada jugador, los mapas de calor con un selector de
jugador y de set (partido completo o cada set) y la tabla de puntos.

Las imágenes van dentro del HTML (base64), así que se puede enviar como un único archivo.
"""

from __future__ import annotations

import base64
import html
import json
from pathlib import Path

PLAYER_NAMES = {"1": "J1 (fondo)", "2": "J2 (cerca)"}


def _image_data(path):
    return "data:image/png;base64," + base64.b64encode(Path(path).read_bytes()).decode("ascii")


def _maps_by_scope(heatmap_files):
    """{"partido": {"1": src, "2": src}, "set1": {...}} a partir de los nombres de los PNG."""
    scopes = {}
    for name, path in heatmap_files.items():
        stem = Path(name).stem.removeprefix("heatmap_")  # J1 | set2_J1
        scope, player = ("partido", stem) if "_" not in stem else stem.split("_")
        scopes.setdefault(scope, {})[player.removeprefix("J")] = _image_data(path)
    return scopes


def _player_rows(report):
    rows = []
    for player, summary in report["players"].items():
        serve = summary.get("serve", {})
        values = [
            PLAYER_NAMES.get(player, player), summary.get("pointsWon", 0), summary.get("shots", 0),
            summary.get("avgShotSpeedKmh") or "-", serve.get("count", 0), serve.get("avgSpeedKmh") or "-",
            f"{serve['firstServePct']} %" if "firstServePct" in serve else "-", serve.get("aces", "-"),
            serve.get("doubleFaults", "-"),
        ]
        rows.append("<tr>" + "".join(f"<td>{html.escape(str(v))}</td>" for v in values) + "</tr>")
    return "\n".join(rows)


def _point_rows(report):
    rows = []
    for p in report["points"]:
        level = p.get("confidence_level") or ""
        values = [p["number"], p["set"], p["game"], f"{p['start_s']}-{p['end_s']} s", p.get("server") or "-",
                  p.get("shots"), p.get("winner") or "-", p.get("win_reason") or "-", level,
                  "sí" if p.get("corrected") else "", p.get("score_after") or ""]
        rows.append(f'<tr class="{html.escape(level)}">'
                    + "".join(f"<td>{html.escape(str(v))}</td>" for v in values) + "</tr>")
    return "\n".join(rows)


RALLY_NAMES = {"short": "Cortos", "medium": "Medios", "long": "Largos"}


def _rally_section(report):
    """Tabla de peloteos (TA-36) que cambia con el mismo selector de periodo que el mapa de calor."""
    rallies = report.get("rallies")
    if not rallies:
        return ""
    cuts = rallies["cuts"]
    limits = {"short": f"0-{cuts['shortMax']}", "medium": f"{cuts['shortMax'] + 1}-{cuts['mediumMax']}",
              "long": f"{cuts['mediumMax'] + 1} o más"}
    tables = []
    for scope, summary in rallies.items():
        if scope == "cuts":
            continue
        rows = "".join(
            f"<tr><td>{RALLY_NAMES[c]} ({limits[c]} golpes)</td><td>{summary[c]['count']}</td>"
            f"<td>{summary[c]['pct']} %</td><td>{summary[c]['won']['1']}</td><td>{summary[c]['won']['2']}</td></tr>"
            for c in ("short", "medium", "long"))
        tables.append(f'<table class="rallies" data-scope="{scope}"><tr><th>Peloteos</th><th>Cuántos</th>'
                      f"<th>%</th><th>Ganó J1</th><th>Ganó J2</th></tr>{rows}</table>")
    return ("<h2>Peloteos</h2>" + "".join(tables) + """
<script>
document.addEventListener('periodo', e => document.querySelectorAll('table.rallies')
  .forEach(t => { t.style.display = t.dataset.scope === e.detail ? '' : 'none'; }));
</script>""")


def build_html(report, heatmap_files, extra_sections=""):
    """HTML del informe. heatmap_files: {nombre del PNG: ruta} de report.heatmap.write_heatmaps."""
    scopes = _maps_by_scope(heatmap_files)
    order = ["partido"] + sorted((s for s in scopes if s != "partido"), key=lambda s: int(s.removeprefix("set")))
    scope_options = "".join(
        f'<option value="{s}">{"Partido completo" if s == "partido" else "Set " + s.removeprefix("set")}</option>'
        for s in order)
    score = (report.get("score") or {}).get("text") or "-"
    review = ", ".join(str(n) for n in report.get("toReview", [])) or "ninguno"
    return f"""<!doctype html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Informe del partido</title>
<style>
body {{ font-family: system-ui, sans-serif; margin: 0 auto; max-width: 980px; padding: 16px; color: #1b1b1b; }}
h1 {{ margin-bottom: 4px; }} .score {{ font-size: 1.6em; font-weight: 700; }}
table {{ border-collapse: collapse; width: 100%; margin: 8px 0 20px; font-size: .92em; }}
th, td {{ border-bottom: 1px solid #ddd; padding: 6px; text-align: left; }} th {{ background: #f3f3f3; }}
tr.baja td {{ background: #fff3cd; }} .controls select {{ font-size: 1em; margin-right: 12px; }}
.maps {{ display: flex; gap: 16px; flex-wrap: wrap; }} .maps img {{ max-width: 100%; height: 520px; }}
.note {{ color: #555; font-size: .9em; }}
</style></head><body>
<h1>Informe del partido</h1>
<p class="note">{html.escape(str((report.get("video") or {}).get("name") or ""))}</p>
<p class="score">Marcador: {html.escape(score)}</p>
<p class="note">Puntos para revisar a mano (confianza baja o sin ganador): {html.escape(review)}.
Corrígelos en corrections.json y vuelve a generar el informe.</p>

<h2>Jugadores</h2>
<table><tr><th>Jugador</th><th>Puntos</th><th>Golpes</th><th>Vel. media golpe</th><th>Saques</th>
<th>Vel. media saque</th><th>1er saque</th><th>Aces</th><th>Dobles faltas</th></tr>
{_player_rows(report)}
</table>

<h2>Mapa de calor</h2>
<div class="controls">
<label>Jugador <select id="player"><option value="1">J1 (fondo)</option><option value="2">J2 (cerca)</option>
<option value="ambos">Ambos</option></select></label>
<label>Periodo <select id="scope">{scope_options}</select></label>
</div>
<p class="note">Escala de color común a todos los mapas: el mismo color es el mismo tiempo.</p>
<div class="maps" id="maps"></div>
{_rally_section(report)}
{extra_sections}
<h2>Puntos</h2>
<table><tr><th>#</th><th>Set</th><th>Juego</th><th>Tiempo</th><th>Saca</th><th>Golpes</th><th>Gana</th>
<th>Motivo</th><th>Confianza</th><th>Corregido</th><th>Marcador</th></tr>
{_point_rows(report)}
</table>
<script>
const maps = {json.dumps(scopes)};
function show() {{
  const player = document.getElementById('player').value, scope = document.getElementById('scope').value;
  const players = player === 'ambos' ? ['1', '2'] : [player];
  document.getElementById('maps').innerHTML = players.filter(p => maps[scope] && maps[scope][p])
    .map(p => `<img alt="Mapa de calor J${{p}}" src="${{maps[scope][p]}}">`).join('');
  document.dispatchEvent(new CustomEvent('periodo', {{ detail: scope }}));
}}
document.getElementById('player').addEventListener('change', show);
document.getElementById('scope').addEventListener('change', show);
show();
</script>
</body></html>
"""


def write_html(report, heatmap_files, out_dir, extra_sections=""):
    path = Path(out_dir) / "informe.html"
    path.write_text(build_html(report, heatmap_files, extra_sections), encoding="utf-8")
    return path
