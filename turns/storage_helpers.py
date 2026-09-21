"""Subida de documentos de turnos virtuales a Firebase Storage.

Antes se usaba Supabase Storage porque el bucket de Firebase no estaba
activado, pero Supabase empezó a fallar en la app web. Ahora se sube directo
al bucket de Firebase Storage del mismo proyecto ya inicializado en
firebase_config.py (usa las mismas credenciales que Firestore, sin config
extra salvo, opcionalmente, FIREBASE_STORAGE_BUCKET en .env).

Mismo patrón que el resto de integraciones externas: cualquier fallo se
devuelve como (url='', error='mensaje') para que el endpoint responda un
error controlado en vez de un 500.
"""
from datetime import timedelta
import uuid

from firebase_admin import storage

from .firebase_config import db

ALLOWED_EXTENSIONS = {'jpg', 'jpeg', 'png', 'pdf'}
MAX_FILE_SIZE_BYTES = 8 * 1024 * 1024  # 8MB

# El bucket es privado, así que se guarda una URL firmada. Google Cloud
# Storage limita las URLs firmadas V4 a 7 días máximo (rechaza cualquier
# valor mayor), así que se usa ese tope en vez del año que duraba con
# Supabase.
SIGNED_URL_TTL = timedelta(days=7)


def upload_virtual_document_file(turn_number: str, document_key: str, django_file):
    """Sube un archivo a Firebase Storage y devuelve (url, error).

    url viene vacía cuando error != ''.
    """
    if not db:
        return '', 'El almacenamiento de documentos no está configurado. Contacta al administrador'

    ext = (django_file.name.rsplit('.', 1)[-1] if '.' in django_file.name else '').lower()
    if ext not in ALLOWED_EXTENSIONS:
        return '', 'Formato no permitido. Usa JPG, PNG o PDF'
    if django_file.size > MAX_FILE_SIZE_BYTES:
        return '', 'El archivo supera el tamaño máximo de 8MB'

    path = f"virtual_turns/{turn_number}/{document_key}/{uuid.uuid4().hex}.{ext}"

    try:
        blob = storage.bucket().blob(path)
        django_file.seek(0)
        blob.upload_from_file(django_file, content_type=django_file.content_type or 'application/octet-stream')
        url = blob.generate_signed_url(expiration=SIGNED_URL_TTL, version='v4')
        return url, ''
    except Exception as e:
        print(f'[storage_helpers] Fallo subiendo a Firebase Storage: {e!r}')
        return '', 'No se pudo subir el documento, intenta de nuevo'
