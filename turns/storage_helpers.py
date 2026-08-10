"""Subida de documentos de turnos virtuales a Firebase Storage.

Mismo patrón try/except -> None que firebase_config.py / ai_assistant.py,
para que la ausencia de Storage (bucket no activado, credenciales sin
permiso, etc) nunca tumbe el servidor: los endpoints que lo usan devuelven
un error controlado en vez de un 500.
"""
import os
import uuid
import urllib.parse
from .firebase_config import db

try:
    from firebase_admin import storage
except Exception:
    storage = None

ALLOWED_EXTENSIONS = {'jpg', 'jpeg', 'png', 'pdf'}
MAX_FILE_SIZE_BYTES = 8 * 1024 * 1024  # 8MB


def upload_virtual_document_file(turn_number: str, document_key: str, django_file):
    """Sube un archivo a Storage y devuelve (url, error). url es '' si error != ''."""
    if not db or not storage:
        return '', 'El almacenamiento de documentos no está disponible en este momento'

    ext = (django_file.name.rsplit('.', 1)[-1] if '.' in django_file.name else '').lower()
    if ext not in ALLOWED_EXTENSIONS:
        return '', 'Formato no permitido. Usa JPG, PNG o PDF'
    if django_file.size > MAX_FILE_SIZE_BYTES:
        return '', 'El archivo supera el tamaño máximo de 8MB'

    try:
        bucket = storage.bucket()
    except Exception:
        print('[storage_helpers] No se pudo obtener el bucket de Firebase Storage')
        return '', 'El almacenamiento de documentos no está disponible en este momento'

    try:
        path = f"virtual_turns/{turn_number}/{document_key}/{uuid.uuid4().hex}.{ext}"
        blob = bucket.blob(path)
        token = str(uuid.uuid4())
        blob.metadata = {'firebaseStorageDownloadTokens': token}
        blob.upload_from_file(django_file, content_type=django_file.content_type)
        encoded_path = urllib.parse.quote(path, safe='')
        return f"https://firebasestorage.googleapis.com/v0/b/{bucket.name}/o/{encoded_path}?alt=media&token={token}", ''
    except Exception as e:
        print(f'[storage_helpers] Fallo al subir a Storage (bucket={bucket.name}): {e!r}')
        if 'bucket does not exist' in str(e).lower() or 'notfound' in type(e).__name__.lower():
            return '', 'El almacenamiento de documentos no está activado todavía. Contacta al administrador'
        return '', 'No se pudo subir el documento, intenta de nuevo'
