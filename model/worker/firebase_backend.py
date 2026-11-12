"""Conexión del worker con Firestore y el almacenamiento de videos (PCIT-35, PCIT-226).

Credenciales: nunca en el repositorio. Se usa la cuenta de servicio de
Firebase indicada por la variable de entorno GOOGLE_APPLICATION_CREDENTIALS
(ruta al JSON). Con los emuladores de Firebase no hacen falta credenciales:
basta con FIRESTORE_EMULATOR_HOST y STORAGE_EMULATOR_HOST.

Las librerías de Google Cloud se importan al crear el backend, para que el
resto del modelo (y sus tests) no las necesite.
"""

from __future__ import annotations

import os
from datetime import datetime, timezone

from .processor import VideoNotFoundError, VideoTooLargeError

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
                "analysisStage": "preparing",
                "analysisFrames": firestore.DELETE_FIELD,
                "finishedAt": None,
                "errorMessage": None,
                "statistics": None,
                "processedVideoPath": None,
                "workerVersion": worker_version,
            })
            return snapshot.to_dict()

        return claim(self.db.transaction())

    def mark_stage(self, match_id, stage, frames=None):
        firestore = self._firestore
        reference = self.db.collection(MATCHES).document(match_id)

        @firestore.transactional
        def update_stage(transaction):
            snapshot = reference.get(transaction=transaction)
            if snapshot.exists and snapshot.get("status") == PROCESSING:
                transaction.update(reference, {"analysisStage": stage, "analysisFrames": frames or firestore.DELETE_FIELD})

        update_stage(self.db.transaction())

    def _finish(self, match_id, fields):
        firestore = self._firestore
        reference = self.db.collection(MATCHES).document(match_id)

        @firestore.transactional
        def finish(transaction):
            snapshot = reference.get(transaction=transaction)
            if not snapshot.exists or snapshot.get("status") != PROCESSING:
                return False  # el partido cambió mientras se analizaba: no se pisa su estado
            match = snapshot.to_dict()
            application_ref = None
            if fields["status"] == READY and match.get("applicationId"):
                application_ref = self.db.collection("applications").document(match["applicationId"])
                application = application_ref.get(transaction=transaction).to_dict()
                if (
                    not application or application.get("orgId") != match.get("orgId")
                    or application.get("playerId") != match.get("playerId")
                    or match.get("videoPath") not in (application.get("videoPaths") or [])
                    or application.get("status") not in ("nueva", "en revisión")
                ):
                    application_ref = None
            transaction.update(reference, {**fields, "finishedAt": firestore.SERVER_TIMESTAMP,
                                           "analysisStage": firestore.DELETE_FIELD,
                                           "analysisFrames": firestore.DELETE_FIELD})
            if application_ref is not None:
                transaction.update(application_ref, {"status": "analizada", "updatedAt": firestore.SERVER_TIMESTAMP})
            return True

        return finish(self.db.transaction())

    def mark_ready(self, match_id, statistics, processed_video_path=None):
        return self._finish(match_id, {"status": READY, "statistics": statistics, "errorMessage": None,
                                      "processedVideoPath": processed_video_path})

    def mark_error(self, match_id, error_message):
        return self._finish(match_id, {"status": ERROR, "statistics": None, "errorMessage": error_message,
                                      "processedVideoPath": None})


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

    def upload_processed(self, source, destination):
        blob = self.bucket.blob(destination)
        blob.cache_control = "private, max-age=0"
        blob.upload_from_filename(str(source), content_type="video/mp4")


class AzureBlobVideos:
    """Videos en Azure Blob Storage (PCIT-226, historia PCIT-222).

    Mismos métodos que CloudStorageVideos. Se autentica con la identidad administrada
    de Azure (DefaultAzureCredential; AZURE_CLIENT_ID elige la identidad): ninguna clave.
    Las rutas son las mismas que en Firebase Storage: orgs/{org}/matches/{id}/video.mp4.
    """

    MAX_BYTES = 500 * 1024 * 1024  # el mismo límite que la web (MAX_VIDEO_BYTES)

    def __init__(self, account: str, container: str = "videos", container_client=None, max_bytes: int | None = None):
        if container_client is None:
            from azure.identity import DefaultAzureCredential
            from azure.storage.blob import BlobServiceClient

            credential = DefaultAzureCredential(managed_identity_client_id=os.environ.get("AZURE_CLIENT_ID"))
            service = BlobServiceClient(f"https://{account}.blob.core.windows.net", credential=credential)
            container_client = service.get_container_client(container)
        self.container = container_client
        self.max_bytes = max_bytes or self.MAX_BYTES

    def download(self, video_path, destination):
        from azure.core.exceptions import ResourceNotFoundError

        blob = self.container.get_blob_client(video_path)
        try:
            size = blob.get_blob_properties().size
        except ResourceNotFoundError as exc:
            raise VideoNotFoundError(video_path) from exc
        # Un enlace SAS no limita el tamaño (PCIT-224): se comprueba antes de descargar.
        if not 0 < size <= self.max_bytes:
            raise VideoTooLargeError(size, self.max_bytes)
        with open(destination, "wb") as file:
            blob.download_blob().readinto(file)

    def upload_processed(self, source, destination):
        from azure.storage.blob import ContentSettings

        with open(source, "rb") as file:
            self.container.get_blob_client(destination).upload_blob(
                file, overwrite=True,
                content_settings=ContentSettings(content_type="video/mp4", cache_control="private, max-age=0"),
            )
