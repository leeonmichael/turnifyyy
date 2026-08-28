"""Subida de documentos de turnos virtuales a Supabase Storage.

Mismo patrón try/except -> None que firebase_config.py / ai_assistant.py,
para que la ausencia de Storage (bucket no creado, credenciales sin
permiso, etc) nunca tumbe el servidor: los endpoints que lo usan devuelven
un error controlado en vez de un 500.
"""
import uuid

from .firebase_config import db
from .supabase_config import supabase, SUPABASE_BUCKET

ALLOWED_EXTENSIONS = {'jpg', 'jpeg', 'png', 'pdf'}
MAX_FILE_SIZE_BYTES = 8 * 1024 * 1024  # 8MB
CONTENT_TYPES = {
    'jpg':  'image/jpeg',
    'jpeg': 'image/jpeg',
    'png':  'image/png',
    'pdf':  'application/pdf',
}
# El bucket es privado: se sirve por URL firmada de larga duración en vez de
# una URL pública, para no exponer documentos personales sin control.
SIGNED_URL_EXPIRES_IN = 60 * 60 * 24 * 365 * 10  # 10 años


def upload_virtual_document_file(turn_number: str, document_key: str, django_file):
    """Sube un archivo a Supabase Storage y devuelve (url, error). url es '' si error != ''."""
    if not db or not supabase:
        return '', 'El almacenamiento de documentos no está disponible en este momento'

    ext = (django_file.name.rsplit('.', 1)[-1] if '.' in django_file.name else '').lower()
    if ext not in ALLOWED_EXTENSIONS:
        return '', 'Formato no permitido. Usa JPG, PNG o PDF'
    if django_file.size > MAX_FILE_SIZE_BYTES:
        return '', 'El archivo supera el tamaño máximo de 8MB'

    path = f"virtual_turns/{turn_number}/{document_key}/{uuid.uuid4().hex}.{ext}"
    content_type = django_file.content_type or CONTENT_TYPES.get(ext, 'application/octet-stream')

    try:
        file_bytes = django_file.read()
        supabase.storage.from_(SUPABASE_BUCKET).upload(
            path,
            file_bytes,
            {'content-type': content_type, 'upsert': 'false'},
        )
    except Exception as e:
        print(f'[storage_helpers] Fallo al subir a Supabase Storage (bucket={SUPABASE_BUCKET}): {e!r}')
        if 'bucket not found' in str(e).lower():
            return '', 'El almacenamiento de documentos no está activado todavía. Contacta al administrador'
        return '', 'No se pudo subir el documento, intenta de nuevo'

    try:
        signed = supabase.storage.from_(SUPABASE_BUCKET).create_signed_url(path, SIGNED_URL_EXPIRES_IN)
        url = signed.get('signedURL') or signed.get('signedUrl')
        if not url:
            raise ValueError(f'respuesta sin signedURL: {signed!r}')
        return url, ''
    except Exception as e:
        print(f'[storage_helpers] Fallo al generar URL firmada (bucket={SUPABASE_BUCKET}): {e!r}')
        return '', 'El documento se subió pero no se pudo generar el enlace, intenta de nuevo'
