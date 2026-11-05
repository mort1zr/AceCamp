"""Estado de una sesión de revisión de etiquetas (TA-9), sin ventana.

La ventana (eval/review.py) solo traduce teclas y clics a estas operaciones,
así la lógica se puede probar sin pantalla.
"""

from __future__ import annotations

import json
from pathlib import Path

from court import CourtHomography

from .labels import validate

KEYPOINT_GRAB_RADIUS_PX = 20


class ReviewSession:
    def __init__(self, data: dict, path: Path | None = None):
        validate(data)  # falla pronto si el archivo está mal
        self.data = data
        self.path = Path(path) if path else None
        self.data.setdefault("ball", {})
        for key in ("shots", "bounces", "serves", "cuts", "points"):
            self.data.setdefault(key, [])
        self.data.setdefault("court_keypoints", {})
        self.open_point_start: int | None = None
        self.dirty = False

    @classmethod
    def load(cls, path):
        path = Path(path)
        return cls(json.loads(path.read_text()), path)

    # ---------------------------------------------------------- consultas

    @property
    def num_frames(self) -> int:
        return int(self.data["video"].get("frames") or 0)

    @property
    def ball_every(self) -> int:
        return int(self.data.get("review", {}).get("ball_every", 1))

    def ball_at(self, frame):
        """(etiquetado, centro): etiquetado=False si ese fotograma no está en la lista."""
        key = str(frame)
        if key not in self.data["ball"]:
            return False, None
        return True, self.data["ball"][key]

    def events_at(self, frame):
        found = []
        for kind in ("shots", "bounces", "serves"):
            found += [(kind, e) for e in self.data[kind] if e["frame"] == frame]
        if frame in self.data["cuts"]:
            found.append(("cuts", frame))
        for p in self.data["points"]:
            if p["start"] == frame:
                found.append(("point_start", p))
            if p["end"] == frame:
                found.append(("point_end", p))
        return found

    def keypoints_frame_for(self, frame):
        """Fotograma etiquetado con puntos clave más cercano por detrás (o el primero)."""
        frames = sorted(int(f) for f in self.data["court_keypoints"])
        if not frames:
            return None
        earlier = [f for f in frames if f <= frame]
        return earlier[-1] if earlier else frames[0]

    def keypoints_at(self, frame):
        kf = self.keypoints_frame_for(frame)
        return None if kf is None else self.data["court_keypoints"][str(kf)]

    # ------------------------------------------------------------- pelota

    def set_ball(self, frame, x, y):
        self.data["ball"][str(frame)] = [round(float(x), 1), round(float(y), 1)]
        self.dirty = True

    def set_ball_invisible(self, frame):
        self.data["ball"][str(frame)] = None
        self.dirty = True

    # ------------------------------------------------------------ eventos

    def add_shot(self, frame, player):
        self._replace_event("shots", frame, {"frame": frame, "player": player})

    def add_serve(self, frame, player):
        self._replace_event("serves", frame, {"frame": frame, "player": player})

    def add_bounce(self, frame, x, y):
        """Bote en el píxel (x, y): se guarda también su posición en metros con la homografía."""
        bounce = {"frame": frame, "x_px": round(float(x), 1), "y_px": round(float(y), 1)}
        keypoints = self.keypoints_at(frame)
        if keypoints is not None:
            try:
                x_m, y_m = CourtHomography.from_keypoints(keypoints).image_to_court((x, y))
                bounce.update(x_m=round(float(x_m), 2), y_m=round(float(y_m), 2))
            except ValueError:
                pass  # puntos clave insuficientes: el bote queda solo en píxeles
        self._replace_event("bounces", frame, bounce)

    def toggle_cut(self, frame):
        cuts = self.data["cuts"]
        if frame in cuts:
            cuts.remove(frame)
        else:
            cuts.append(frame)
            cuts.sort()
        self.dirty = True

    def start_point(self, frame):
        self.open_point_start = frame

    def end_point(self, frame, winner):
        if self.open_point_start is None or frame <= self.open_point_start:
            return False
        self.data["points"].append({"start": self.open_point_start, "end": frame, "winner": winner})
        self.data["points"].sort(key=lambda p: p["start"])
        self.open_point_start = None
        self.dirty = True
        return True

    def remove_events_at(self, frame):
        """Borra golpes, botes, saques, cortes y puntos que empiezan o terminan en este fotograma."""
        before = json.dumps([self.data[k] for k in ("shots", "bounces", "serves", "cuts", "points")])
        for kind in ("shots", "bounces", "serves"):
            self.data[kind] = [e for e in self.data[kind] if e["frame"] != frame]
        self.data["cuts"] = [c for c in self.data["cuts"] if c != frame]
        self.data["points"] = [p for p in self.data["points"] if frame not in (p["start"], p["end"])]
        if before != json.dumps([self.data[k] for k in ("shots", "bounces", "serves", "cuts", "points")]):
            self.dirty = True

    def _replace_event(self, kind, frame, event):
        self.data[kind] = [e for e in self.data[kind] if e["frame"] != frame] + [event]
        self.data[kind].sort(key=lambda e: e["frame"])
        self.dirty = True

    # ------------------------------------------------------ puntos clave

    def nearest_keypoint(self, frame, x, y, radius=KEYPOINT_GRAB_RADIUS_PX):
        keypoints = self.keypoints_at(frame)
        if keypoints is None:
            return None
        distances = [((px - x) ** 2 + (py - y) ** 2) ** 0.5 for px, py in keypoints]
        best = min(range(len(distances)), key=distances.__getitem__)
        return best if distances[best] <= radius else None

    def move_keypoint(self, frame, index, x, y):
        kf = self.keypoints_frame_for(frame)
        if kf is None:
            return
        self.data["court_keypoints"][str(kf)][index] = [round(float(x), 1), round(float(y), 1)]
        self.dirty = True

    # ------------------------------------------------------------ guardar

    def mark_reviewed(self, reviewed=True):
        self.data["reviewed"] = reviewed
        self.dirty = True

    def save(self, path=None):
        path = Path(path) if path else self.path
        validate(self.data)
        tmp = path.with_suffix(".tmp")
        tmp.write_text(json.dumps(self.data, indent=1, ensure_ascii=False))
        tmp.replace(path)
        self.dirty = False
        return path
