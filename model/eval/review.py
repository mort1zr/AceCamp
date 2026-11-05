"""Revisión y corrección de etiquetas con una ventana de OpenCV (TA-9).

Uso, desde la carpeta model/:

    python -m eval.review --video clips/clip_01.mp4 --labels eval/labels/clip_01.json

Controles (pulsa h en la ventana para verlos):

    d / a        fotograma siguiente / anterior
    l / j        avanzar / retroceder hasta el siguiente fotograma de pelota a revisar
    L / J        avanzar / retroceder 50 fotogramas
    clic izq.    la pelota está aquí (en este fotograma)
    x            la pelota no se ve en este fotograma
    clic der.    arrastrar un punto clave de la pista a su sitio
    g + 1/2      golpe del jugador 1 (fondo lejano) o 2 (fondo cercano)
    v + 1/2      saque del jugador 1 o 2
    b            bote, en la posición de la pelota de este fotograma
    c            corte de cámara (pulsar otra vez lo quita)
    i            inicio de punto
    o + 1/2      fin de punto y quién lo ganó
    r            borrar los eventos de este fotograma
    y            marcar el clip como revisado (o quitar la marca)
    s            guardar
    q / Esc      guardar y salir
"""

from __future__ import annotations

import argparse
import sys
from dataclasses import dataclass
from pathlib import Path

import cv2

from utils.detection_cache import file_sha256

from .review_session import ReviewSession

WINDOW = "Revision TA-9"
HELP = [line.strip() for line in __doc__.split("Controles")[1].splitlines()[2:] if line.strip()]


@dataclass
class ViewState:
    frame: int = 0
    pending: str | None = None  # 'g', 'v' u 'o' esperando 1 o 2
    message: str = ""
    show_help: bool = False
    quit: bool = False
    dragging: int | None = None  # índice del punto clave que se arrastra


def handle_key(session: ReviewSession, view: ViewState, key: str):
    """Aplica una tecla a la sesión. No toca la ventana: se puede probar sin pantalla."""
    last = max(session.num_frames - 1, 0)
    view.message = ""
    if view.pending:
        action, view.pending = view.pending, None
        if key not in ("1", "2"):
            view.message = "Cancelado: había que pulsar 1 o 2"
            return
        player = int(key)
        if action == "g":
            session.add_shot(view.frame, player)
            view.message = f"Golpe del jugador {player}"
        elif action == "v":
            session.add_serve(view.frame, player)
            view.message = f"Saque del jugador {player}"
        elif action == "o":
            ok = session.end_point(view.frame, player)
            view.message = f"Punto para el jugador {player}" if ok else "Primero marca el inicio del punto (i)"
        return

    step = session.ball_every
    if key == "d":
        view.frame = min(view.frame + 1, last)
    elif key == "a":
        view.frame = max(view.frame - 1, 0)
    elif key == "l":
        view.frame = min((view.frame // step + 1) * step, last)
    elif key == "j":
        view.frame = max(((view.frame - 1) // step) * step, 0)
    elif key == "L":
        view.frame = min(view.frame + 50, last)
    elif key == "J":
        view.frame = max(view.frame - 50, 0)
    elif key == "x":
        session.set_ball_invisible(view.frame)
        view.message = "Pelota no visible"
    elif key in ("g", "v", "o"):
        view.pending = key
        view.message = {"g": "Golpe: ¿jugador 1 o 2?", "v": "Saque: ¿jugador 1 o 2?",
                        "o": "Fin de punto: ¿quién lo ganó, 1 o 2?"}[key]
    elif key == "b":
        labeled, center = session.ball_at(view.frame)
        if center is None:
            view.message = "Para marcar un bote, primero haz clic en la pelota en este fotograma"
        else:
            session.add_bounce(view.frame, *center)
            view.message = "Bote marcado"
    elif key == "c":
        session.toggle_cut(view.frame)
        view.message = "Corte de cámara" if view.frame in session.data["cuts"] else "Corte quitado"
    elif key == "i":
        session.start_point(view.frame)
        view.message = "Inicio de punto: marca el final con o"
    elif key == "r":
        session.remove_events_at(view.frame)
        view.message = "Eventos de este fotograma borrados"
    elif key == "y":
        session.mark_reviewed(not session.data.get("reviewed", False))
        view.message = "Clip marcado como REVISADO" if session.data["reviewed"] else "Quitada la marca de revisado"
    elif key == "s":
        session.save()
        view.message = "Guardado"
    elif key == "h":
        view.show_help = not view.show_help
    elif key in ("q", "\x1b"):
        session.save()
        view.quit = True


def handle_mouse(session: ReviewSession, view: ViewState, event, x, y):
    if event == cv2.EVENT_LBUTTONDOWN:
        session.set_ball(view.frame, x, y)
        view.message = f"Pelota en ({x}, {y})"
    elif event == cv2.EVENT_RBUTTONDOWN:
        view.dragging = session.nearest_keypoint(view.frame, x, y)
        if view.dragging is None:
            view.message = "No hay un punto clave cerca del clic"
    elif event == cv2.EVENT_RBUTTONUP and view.dragging is not None:
        session.move_keypoint(view.frame, view.dragging, x, y)
        view.message = f"Punto clave {view.dragging} movido"
        view.dragging = None


def draw(image, session: ReviewSession, view: ViewState):
    canvas = image.copy()
    keypoints = session.keypoints_at(view.frame)
    for i, (x, y) in enumerate(keypoints or []):
        cv2.circle(canvas, (int(x), int(y)), 6, (0, 0, 255), -1)
        cv2.putText(canvas, str(i), (int(x) + 8, int(y) - 8), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 0, 255), 2)

    labeled, center = session.ball_at(view.frame)
    if center is not None:
        cv2.circle(canvas, (int(center[0]), int(center[1])), 12, (0, 255, 255), 2)
    ball_text = ("no visible" if center is None else "marcada") if labeled else "sin etiquetar"

    events = ", ".join(k for k, _ in session.events_at(view.frame)) or "-"
    reviewed = "REVISADO" if session.data.get("reviewed") else "sin revisar"
    lines = [f"Fotograma {view.frame}/{max(session.num_frames - 1, 0)}  |  pelota: {ball_text}  |  "
             f"eventos: {events}  |  {reviewed}  |  h = ayuda"]
    if session.open_point_start is not None:
        lines.append(f"Punto abierto desde el fotograma {session.open_point_start}")
    if view.message:
        lines.append(view.message)
    if view.show_help:
        lines += HELP
    for n, text in enumerate(lines):
        y = 30 + 28 * n
        cv2.putText(canvas, text, (12, y), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 0, 0), 4)
        cv2.putText(canvas, text, (12, y), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (255, 255, 255), 2)
    return canvas


class FrameReader:
    """Lee fotogramas por índice: en orden cuando se avanza de uno en uno, saltando en lo demás."""

    def __init__(self, path):
        self.cap = cv2.VideoCapture(str(path))
        if not self.cap.isOpened():
            raise SystemExit(f"No se puede abrir el vídeo {path}")
        self.position = -1
        self.last = None

    def get(self, index):
        if index == self.position:
            return self.last
        if index != self.position + 1:
            self.cap.set(cv2.CAP_PROP_POS_FRAMES, index)
        ok, frame = self.cap.read()
        if not ok:
            return self.last
        self.position, self.last = index, frame
        return frame


def main(argv=None):
    parser = argparse.ArgumentParser(description="Revisa y corrige las etiquetas de un clip.")
    parser.add_argument("--video", required=True, type=Path)
    parser.add_argument("--labels", required=True, type=Path)
    args = parser.parse_args(argv)

    session = ReviewSession.load(args.labels)
    expected = session.data["video"].get("sha256")
    if expected and expected != file_sha256(args.video):
        raise SystemExit("El vídeo no es el mismo con el que se crearon estas etiquetas (sha256 distinto).")

    reader = FrameReader(args.video)
    view = ViewState()
    cv2.namedWindow(WINDOW, cv2.WINDOW_NORMAL)
    cv2.setMouseCallback(WINDOW, lambda event, x, y, flags, _: handle_mouse(session, view, event, x, y))
    while not view.quit:
        frame = reader.get(view.frame)
        cv2.imshow(WINDOW, draw(frame, session, view))
        code = cv2.waitKey(30)
        if code != -1:
            handle_key(session, view, chr(code & 0xFF))
        if cv2.getWindowProperty(WINDOW, cv2.WND_PROP_VISIBLE) < 1:  # ventana cerrada con la X
            session.save()
            break
    cv2.destroyAllWindows()
    print(f"Etiquetas guardadas en {session.path}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
