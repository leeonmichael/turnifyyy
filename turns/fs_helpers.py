"""Helpers de acceso a Firestore, sin dependencia de HttpRequest.

Movidos desde turns/views.py para que puedan ser reutilizados tanto por las
vistas HTTP como por el asistente de IA (turns/ai_assistant.py) sin generar
un import circular con views.py.
"""
from datetime import datetime
from django.utils import timezone
from channels.layers import get_channel_layer
from asgiref.sync import async_to_sync
from .firebase_config import db


def get_turn_prefix(service_type: str) -> str:
    return {'general': 'A', 'preferential': 'B', 'emergency': 'E', 'vip': 'V', 'virtual': 'W'}.get(service_type, 'A')


def _fmt_time(iso_str: str) -> str:
    if not iso_str:
        return ''
    try:
        return datetime.fromisoformat(str(iso_str)).strftime('%H:%M')
    except Exception:
        return str(iso_str)[:5]


def _fmt_datetime(iso_str: str) -> str:
    if not iso_str:
        return ''
    try:
        return datetime.fromisoformat(str(iso_str)).strftime('%d/%m/%Y %H:%M')
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


def _get_employee_sede(username: str, role: str) -> str:
    if role == 'employee' and username:
        u = _fs_get_user(username)
        return (u or {}).get('sede', '')
    return ''


def generate_turn_fb(prefix: str, sede: str) -> str:
    """Generate next turn number for a given prefix and sede."""
    if not db:
        return f"{prefix}1"
    try:
        docs = db.collection('turns').where('sede', '==', sede).stream() if sede else db.collection('turns').stream()
        pl = len(prefix)
        nums = [
            int(t[pl:])
            for doc in docs
            for t in [doc.to_dict().get('number', '') if doc.to_dict() else '']
            if t.startswith(prefix) and len(t) > pl and t[pl:].isdigit()
        ]
        return f"{prefix}{max(nums) + 1}" if nums else f"{prefix}1"
    except Exception:
        return f"{prefix}1"


def broadcast_turn_update():
    """Read all turns from Firestore and push via WebSocket to all clients."""
    if not db:
        return
    try:
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
                'sede':         t.get('sede', ''),
                'created_at':   _fmt_time(t.get('created_at', '')),
                'called_by':    t.get('called_by', ''),
                'created_by':   t.get('created_by', ''),
                'scheduled_for':_fmt_datetime(t.get('scheduled_for', ''))
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
