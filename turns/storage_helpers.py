"""Subida de documentos de turnos virtuales a Supabase Storage.

Se usa Supabase (y no Firebase Storage) porque el proyecto de Firebase no
tiene el bucket activado. Las credenciales viven en .env:
SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY y SUPABASE_BUCKET.

Mismo patrón que el resto de integraciones externas: cualquier fallo se
devuelve como (url='', error='mensaje') para que el endpoint responda un
error controlado en vez de un 500.
"""
import os
import uuid

import requests

ALLOWED_EXTENSIONS = {'jpg', 'jpeg', 'png', 'pdf'}
MAX_FILE_SIZE_BYTES = 8 * 1024 * 1024  # 8MB

# El bucket es privado, así que se guarda una URL firmada. Dura un año para
# que el enlace almacenado en el turno siga sirviendo mientras el turno
# tenga vigencia.
SIGNED_URL_TTL_SECONDS = 365 * 24 * 60 * 60
REQUEST_TIMEOUT = 30


def _config():
    return (
        (os.environ.get('SUPABASE_URL') or '').rstrip('/'),
        os.environ.get('SUPABASE_SERVICE_ROLE_KEY') or '',
        os.environ.get('SUPABASE_BUCKET') or '',
    )


def upload_virtual_document_file(turn_number: str, document_key: str, django_file):
    """Sube un archivo a Supabase Storage y devuelve (url, error).

    url viene vacía cuando error != ''.
    """
    base_url, service_key, bucket = _config()
    if not base_url or not service_key or not bucket:
        return '', 'El almacenamiento de documentos no está configurado. Contacta al administrador'

    ext = (django_file.name.rsplit('.', 1)[-1] if '.' in django_file.name else '').lower()
    if ext not in ALLOWED_EXTENSIONS:
        return '', 'Formato no permitido. Usa JPG, PNG o PDF'
    if django_file.size > MAX_FILE_SIZE_BYTES:
        return '', 'El archivo supera el tamaño máximo de 8MB'

    path = f"virtual_turns/{turn_number}/{document_key}/{uuid.uuid4().hex}.{ext}"
    auth = {'Authorization': f'Bearer {service_key}', 'apikey': service_key}

    try:
        django_file.seek(0)
        upload = requests.post(
            f'{base_url}/storage/v1/object/{bucket}/{path}',
            headers={
                **auth,
                'Content-Type': django_file.content_type or 'application/octet-stream',
                'x-upsert': 'true',
            },
            data=django_file.read(),
            timeout=REQUEST_TIMEOUT,
        )
        if upload.status_code >= 400:
            print(f'[storage_helpers] Supabase rechazó la subida ({upload.status_code}): {upload.text[:300]}')
            return '', 'No se pudo subir el documento, intenta de nuevo'

        signed = requests.post(
            f'{base_url}/storage/v1/object/sign/{bucket}/{path}',
            headers={**auth, 'Content-Type': 'application/json'},
            json={'expiresIn': SIGNED_URL_TTL_SECONDS},
            timeout=REQUEST_TIMEOUT,
        )
        if signed.status_code >= 400:
            print(f'[storage_helpers] No se pudo firmar la URL ({signed.status_code}): {signed.text[:300]}')
            return '', 'No se pudo generar el enlace del documento, intenta de nuevo'

        # signedURL llega como ruta relativa: "/object/sign/<bucket>/<path>?token=..."
        relative = (signed.json() or {}).get('signedURL', '')
        if not relative:
            return '', 'No se pudo generar el enlace del documento, intenta de nuevo'
        return f"{base_url}/storage/v1{relative if relative.startswith('/') else '/' + relative}", ''

    except requests.Timeout:
        return '', 'El servidor de archivos tardó demasiado. Intenta de nuevo'
    except Exception as e:
        print(f'[storage_helpers] Fallo inesperado subiendo a Supabase: {e!r}')
        return '', 'No se pudo subir el documento, intenta de nuevo'
