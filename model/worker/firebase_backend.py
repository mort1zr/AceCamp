"""Conexión del worker con Firestore y Cloud Storage (PCIT-35).

Credenciales: nunca en el repositorio. Se usa la cuenta de servicio de
Firebase indicada por la variable de entorno GOOGLE_APPLICATION_CREDENTIALS
(ruta al JSON). Con los emuladores de Firebase no hacen falta credenciales:
basta con FIRESTORE_EMULATOR_HOST y STORAGE_EMULATOR_HOST.

Las librerías de Google Cloud se importan al crear el backend, para que el
resto del modelo (y sus tests) no las necesite.
"""

from __future__ import annotations

from datetime import datetime, timezone

from .processor import VideoNotFoundError

MATCHES = "matches"
QUEUED, PROCESSING, READY, ERROR = "en cola", "procesando", "listo", "error"
CLAIM_CANDIDATES = 10


def _sort_key(snapshot):
    """Más antiguo primero; los que no tienen createdAt, al final."""
    created = (snapshot.to_dict() or {}).get("createdAt")
    return created or datetime.max.replace(tzinfo=timezone.utc)


class FirestoreMatchStore:
    def __init__(self, project_id: str):
        from google.cloud import firestore

        self._firestore = firestore
        self.db = firestore.Client(project=project_id)

    def claim_next(self, worker_version: str):
        from google.cloud.firestore_v1.base_query import FieldFilter

        # Solo filtro de igualdad: no necesita índice compuesto. El más antiguo se elige aquí.
        query = self.db.collection(MATCHES).where(filter=FieldFilter("status", "==", QUEUED)).limit(CLAIM_CANDIDATES)
        for snapshot in sorted(query.stream(), key=_sort_key):
            claimed = self._claim(snapshot.reference, worker_version)
            if claimed is not None:
                return snapshot.id, claimed
        return None

    def _claim(self, reference, worker_version):
        firestore = self._firestore

        @firestore.transactional
        def claim(transaction):
            snapshot = reference.get(transaction=transaction)
            if not snapshot.exists or snapshot.get("status") != QUEUED:
                return None  # otro worker lo tomó, o el usuario lo canceló
            transaction.update(reference, {
                "status": PROCESSING,
                "startedAt": firestore.SERVER_TIMESTAMP,
                "finishedAt": None,
                "errorMessage": None,
                "statistics": None,
                "workerVersion": worker_version,
            })
            return snapshot.to_dict()

        return claim(self.db.transaction())

    def _finish(self, match_id, fields):
        firestore = self._firestore
        reference = self.db.collection(MATCHES).document(match_id)

        @firestore.transactional
        def finish(transaction):
            snapshot = reference.get(transaction=transaction)
            if not snapshot.exists or snapshot.get("status") != PROCESSING:
                return False  # el partido cambió mientras se analizaba: no se pisa su estado
            transaction.update(reference, {**fields, "finishedAt": firestore.SERVER_TIMESTAMP})
            return True

        return finish(self.db.transaction())

    def mark_ready(self, match_id, statistics):
        return self._finish(match_id, {"status": READY, "statistics": statistics, "errorMessage": None})

    def mark_error(self, match_id, error_message):
        return self._finish(match_id, {"status": ERROR, "statistics": None, "errorMessage": error_message})


class CloudStorageVideos:
    def __init__(self, project_id: str, bucket_name: str):
        from google.cloud import storage

        self.bucket = storage.Client(project=project_id).bucket(bucket_name)

    def download(self, video_path, destination):
        from google.api_core.exceptions import NotFound

        try:
            self.bucket.blob(video_path).download_to_filename(str(destination))
        except NotFound as exc:
            raise VideoNotFoundError(video_path) from exc
