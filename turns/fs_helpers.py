"""Helpers de acceso a Firestore, sin dependencia de HttpRequest.

Movidos desde turns/views.py para que puedan ser reutilizados tanto por las
vistas HTTP como por el asistente de IA (turns/ai_assistant.py) sin generar
un import circular con views.py.
"""
import uuid
from datetime import datetime
from django.utils import timezone
from channels.layers import get_channel_layer
from asgiref.sync import async_to_sync
from .firebase_config import db


def get_turn_prefix(service_type: str) -> str:
    return {'general': 'A', 'preferential': 'B', 'emergency': 'E', 'vip': 'V', 'virtual': 'W'}.get(service_type, 'A')


def generate_meet_link(turn_number: str) -> str:
    """Sala de Jitsi Meet única por turno — no requiere cuenta ni credenciales."""
    room = f"Turnify-{turn_number}-{uuid.uuid4().hex[:8]}"
    return f"https://meet.jit.si/{room}"


def _fmt_time(iso_str: str) -> str:
    if not iso_str:
        return ''
    try:
        return datetime.fromisoformat(str(iso_str)).strftime('%H:%M')
    except Exception:
        return str(iso_str)[:5]


def is_scheduled_for_later(turn: dict) -> bool:
    """¿El turno fue reagendado para un día posterior a hoy?

    Un turno reagendado se guarda con status 'waiting' y una fecha en
    'scheduled_for'. Mientras esa fecha no llegue no pertenece a la cola de
    hoy: no debe contarse en la espera, ni poder llamarse, ni ocupar posición.
    El día de la cita (y en adelante) vuelve a entrar en la cola con normalidad.
    """
    raw = str((turn or {}).get('scheduled_for') or '').strip()
    if not raw:
        return False
    try:
        return datetime.fromisoformat(raw).date() > datetime.now().date()
    except Exception:
        return False


def is_in_todays_queue(turn: dict) -> bool:
    """Turno en espera que sí corresponde atender hoy."""
    return (turn or {}).get('status') == 'waiting' and not is_scheduled_for_later(turn)


def _fmt_datetime(iso_str: str) -> str:
    if not iso_str:
        return ''
    try:
        value = str(iso_str)
        dt = datetime.fromisoformat(value)
        # Los reagendamientos guardan solo el día ("2026-09-16"): mostrar
        # "00:00" en esos casos confunde, así que se omite la hora.
        if 'T' not in value and ' ' not in value:
            return dt.strftime('%d/%m/%Y')
        return dt.strftime('%d/%m/%Y %H:%M')
    except Exception:
        return str(iso_str)


def _fs_all_turns():
    """Fetch all turns from Firestore as list of dicts (with _doc_id)."""
    if not db:
        return []
    result = []
    for doc in db.collection('turns').stream():
        d = doc.to_dict()
        if d:
            d['_doc_id'] = doc.id
            result.append(d)
    return result


def _fs_all_users():
    """Fetch all users from Firestore as list of dicts."""
    if not db:
        return []
    result = []
    for doc in db.collection('users').stream():
        d = doc.to_dict()
        if d:
            result.append(d)
    return result


def _fs_get_user(username: str):
    """Get a single user document by username."""
    if not db or not username:
        return None
    doc = db.collection('users').document(username).get()
    return doc.to_dict() if doc.exists else None


def _get_employee_sede_id(username: str, role: str) -> str:
    if role == 'employee' and username:
        u = _fs_get_user(username)
        return (u or {}).get('sede_id', '')
    return ''


def _sedes_map() -> dict:
    """{sede_id: name} de todas las sedes (activas e inactivas)."""
    if not db:
        return {}
    return {doc.id: (doc.to_dict() or {}).get('name', '') for doc in db.collection('sedes').stream()}


def _resolve_sede_name(sede_id: str, sedes_map: dict | None = None) -> str:
    """Resuelve el nombre de una sede en vivo a partir de su id, para que un
    rename se refleje al instante en turnos/empleados sin tener que tocarlos."""
    if sede_id == 'VIRTUAL':
        return 'Virtual'
    if not sede_id:
        return ''
    m = sedes_map if sedes_map is not None else _sedes_map()
    return m.get(sede_id, '')


def generate_turn_fb(prefix: str, sede_id: str) -> str:
    """Generate next turn number for a given prefix and sede_id.

    También cuenta turnos "viejos" que aún no fueron migrados a sede_id (solo
    tienen el campo de texto 'sede' de antes) y coinciden por nombre/valor,
    para no reutilizar un número ya usado por esa sede antes de la migración."""
    if not db:
        return f"{prefix}1"
    try:
        legacy_value = 'VIRTUAL' if sede_id == 'VIRTUAL' else _sedes_map().get(sede_id, '')
        pl = len(prefix)
        nums = []
        for doc in db.collection('turns').stream():
            d = doc.to_dict() or {}
            if sede_id and d.get('sede_id') != sede_id and (not legacy_value or d.get('sede') != legacy_value):
                continue
            t = d.get('number', '')
            if t.startswith(prefix) and len(t) > pl and t[pl:].isdigit():
                nums.append(int(t[pl:]))
        return f"{prefix}{max(nums) + 1}" if nums else f"{prefix}1"
    except Exception:
        return f"{prefix}1"


def broadcast_turn_update():
    """Read all turns from Firestore and push via WebSocket to all clients."""
    if not db:
        return
    try:
        sedes_map = _sedes_map()
        turns_data = []
        for doc in db.collection('turns').stream():
            t = doc.to_dict()
            if not t:
                continue
            turns_data.append({
                'id':           doc.id,
                'number':       t.get('number', ''),
                'status':       t.get('status', 'waiting'),
                'service_type': t.get('service_type', 'general'),
                'sede_id':      t.get('sede_id', ''),
                'sede':         _resolve_sede_name(t.get('sede_id', ''), sedes_map),
                'created_at':   _fmt_time(t.get('created_at', '')),
                'called_by':    t.get('called_by', ''),
                'created_by':   t.get('created_by', ''),
                'scheduled_for':_fmt_datetime(t.get('scheduled_for', '')),
                'scheduled_for_later': is_scheduled_for_later(t),
                'meet_link':          t.get('meet_link', ''),
                'required_documents': t.get('required_documents', []),
                'uploaded_documents': t.get('uploaded_documents', []),
                'chat_messages':      t.get('chat_messages', []),
            })
        turns_data.sort(key=lambda x: x.get('created_at', ''), reverse=True)
        channel_layer = get_channel_layer()
        if channel_layer:
            async_to_sync(channel_layer.group_send)(
                'turns',
                {'type': 'turn_update', 'data': turns_data}
            )
    except Exception:
        pass

    try:
        from .push_service import notify_upcoming_turns
        notify_upcoming_turns()
    except Exception:
        pass
