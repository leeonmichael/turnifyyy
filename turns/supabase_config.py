"""Cliente de Supabase Storage para documentos e imágenes de turnos virtuales.

Mismo patrón try/except -> None que firebase_config.py: la ausencia de
credenciales (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY sin configurar) nunca
tumba el servidor, solo deshabilita la subida de documentos con un error
controlado.
"""
import os

from supabase import create_client

SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_SERVICE_ROLE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
SUPABASE_BUCKET = os.environ.get("SUPABASE_BUCKET", "turnos-documentos")

try:
    supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
except Exception:
    supabase = None
