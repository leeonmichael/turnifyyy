"""Lógica de negocio de turnos, sin envoltorio HTTP/DRF.

Cada función devuelve (data: dict, status: int) — exactamente lo que la vista
HTTP correspondiente respondía antes de este refactor. Este módulo es la
única fuente de verdad para crear/cancelar/consultar turnos, usada tanto por
las vistas de turns/views.py como por el asistente de IA
(turns/ai_assistant.py), evitando que ambos caminos diverjan.
"""
from django.utils import timezone
from .firebase_config import db
from .fs_helpers import (
    _fs_all_turns, _fs_get_user, _get_employee_sede_id, _sedes_map, _resolve_sede_name,
    generate_turn_fb, get_turn_prefix, broadcast_turn_update,
    generate_meet_link, _fmt_time, _fmt_datetime,
)

# Documentos requeridos para turnos virtuales — fuente única de verdad,
# el frontend la consulta por API (GET /api/virtual/document-requirements/)
# en vez de tener su propia copia hardcodeada.
VIRTUAL_REQUIRED_DOCUMENTS = [
    {'key': 'doc_identidad',  'label': 'Documento de identidad (CC, CE o Pasaporte)',   'required': True},
    {'key': 'doc_afiliacion', 'label': 'Carné o certificado de afiliación EPS',          'required': True},
    {'key': 'doc_orden',      'label': 'Orden médica o autorización (si aplica)',        'required': False},
]


def create_turn_service(user_name: str, service_type: str = 'general', sede_id: str = '') -> tuple[dict, int]:
    if not db:
        return {'error': 'Servicio no disponible'}, 503

    if service_type == 'virtual':
        sede_id = 'VIRTUAL'
    elif not sede_id:
        sedes, _ = get_sedes_service()
        first = next(iter(sedes.get('sedes', [])), None)
        sede_id = first['id'] if first else ''

    if user_name:
        all_turns = _fs_all_turns()
        existing = next(
            (t for t in all_turns if t.get('created_by') == user_name and t.get('status') in ('waiting', 'called')),
            None
        )
        if existing:
            is_rescheduled = bool(existing.get('scheduled_for'))
            error_msg = (
                'Ya tienes un turno reagendado pendiente. Debes esperar a que sea atendido o cancelarlo antes de pedir uno nuevo.'
                if is_rescheduled else 'Ya tienes un turno activo'
            )
            return {
                'error':           error_msg,
                'existing_number': existing.get('number', ''),
                'existing_sede':   _resolve_sede_name(existing.get('sede_id', ''))
            }, 400

    prefix = get_turn_prefix(service_type)
    number = generate_turn_fb(prefix, sede_id)

    client_data = {}
    if user_name:
        u = _fs_get_user(user_name)
        if u:
            client_data = {
                'username':      user_name,
                'full_name':     u.get('full_name', ''),
                'cedula':        u.get('cedula', ''),
                'email':         u.get('email', ''),
                'phone':         u.get('phone', ''),
                'document_type': u.get('document_type', ''),
                'role':          u.get('role', '')
            }

    is_virtual = service_type == 'virtual'
    meet_link = generate_meet_link(number) if is_virtual else ''
    required_documents = VIRTUAL_REQUIRED_DOCUMENTS if is_virtual else []

    # Si el usuario canceló un turno reagendado anteriormente, se le aplica
    # la multa pendiente sobre este nuevo turno (ver cancel_turn/cancel_turn_by_id).
    fine_notice = ''
    if user_name:
        u = _fs_get_user(user_name)
        if u and u.get('fine_pending'):
            fine_notice = 'Se aplicó una multa a este turno por la cancelación de tu cita reagendada anterior.'
            db.collection('users').document(user_name).update({
                'fine_pending':    False,
                'fine_cleared_at': timezone.now().isoformat(),
            })

    db.collection('turns').add({
        'number':        number,
        'status':        'waiting',
        'service_type':  service_type,
        'sede_id':       sede_id,
        'client_data':   client_data,
        'created_by':    user_name,
        'called_by':     '',
        'created_at':    timezone.now().isoformat(),
        'finished_at':   '',
        'scheduled_for': '',
        'meet_link':          meet_link,
        'required_documents': required_documents,
        'uploaded_documents': [],
        'chat_messages':      [],
        'has_fine':           bool(fine_notice),
    })
    broadcast_turn_update()
    return {
        'number': number,
        'meet_link': meet_link,
        'required_documents': required_documents,
        'fine_notice': fine_notice,
    }, 200


def cancel_own_turn_service(username: str, turn_number: str) -> tuple[dict, int]:
    """Cancela un turno propio, verificando dueño y estado.

    A diferencia de views.cancel_turn (que cancela por número sin validar
    dueño), esta función solo cancela si created_by == username y el turno
    sigue en 'waiting' — misma regla que ya aplica cancel_turn_by_id, pero
    indexada por número de turno en vez del id interno de Firestore.
    """
    if not db:
        return {'error': 'Servicio no disponible'}, 503
    if not turn_number:
        return {'error': 'Debes indicar el número de turno'}, 400

    all_turns = _fs_all_turns()
    match = next(
        (t for t in all_turns if t.get('number') == turn_number and t.get('created_by') == username),
        None
    )
    if not match:
        return {'error': 'Turno no encontrado o no te pertenece'}, 404
    if match.get('status') != 'waiting':
        return {'error': 'Solo puedes cancelar un turno mientras está en espera'}, 400

    db.collection('turns').document(match['_doc_id']).update({
        'status':       'cancelled',
        'finished_at':  timezone.now().isoformat(),
        'cancelled_by': username,
    })
    broadcast_turn_update()
    return {'success': True, 'number': turn_number}, 200


def get_my_active_turn_service(username: str) -> tuple[dict, int]:
    if not username or not db:
        return {'turn': None}, 200

    all_turns = _fs_all_turns()
    active = [t for t in all_turns if t.get('created_by') == username and t.get('status') in ('waiting', 'called')]
    if not active:
        return {'turn': None}, 200
    active.sort(key=lambda t: t.get('created_at', ''), reverse=True)
    t = active[0]
    return {'turn': {
        'id':           t.get('_doc_id', ''),
        'number':       t.get('number', ''),
        'status':       t.get('status', ''),
        'service_type': t.get('service_type', ''),
        'sede_id':      t.get('sede_id', ''),
        'sede':         _resolve_sede_name(t.get('sede_id', '')),
        'created_at':   _fmt_datetime(t.get('created_at', '')),
        'scheduled_for':      _fmt_datetime(t.get('scheduled_for', '')) or None,
        'meet_link':          t.get('meet_link', ''),
        'required_documents': t.get('required_documents', []),
        'uploaded_documents': t.get('uploaded_documents', []),
        'chat_messages':      t.get('chat_messages', []),
    }}, 200


def get_my_turns_service(username: str) -> tuple[dict, int]:
    if not username or not db:
        return {'turns': []}, 200

    all_turns  = _fs_all_turns()
    user_turns = sorted(
        [t for t in all_turns if t.get('created_by') == username],
        key=lambda t: t.get('created_at', ''),
        reverse=True
    )
    sedes_map = _sedes_map()

    return {'turns': [{
        'id':           t.get('_doc_id', ''),
        'number':       t.get('number', ''),
        'status':       t.get('status', ''),
        'service_type': t.get('service_type', ''),
        'sede_id':      t.get('sede_id', ''),
        'sede':         _resolve_sede_name(t.get('sede_id', ''), sedes_map) or 'N/A',
        'created_at':   _fmt_datetime(t.get('created_at', '')),
        'finished_at':  _fmt_datetime(t.get('finished_at', '')) or None,
        'scheduled_for':_fmt_datetime(t.get('scheduled_for', '')) or None,
        'meet_link':    t.get('meet_link', ''),
    } for t in user_turns]}, 200


def get_position_service(turn_number: str) -> tuple[dict, int]:
    if not turn_number or not db:
        return {'position': None, 'turns_ahead': 0, 'status': None}, 200

    all_turns = _fs_all_turns()
    waiting   = sorted([t for t in all_turns if t.get('status') == 'waiting'], key=lambda t: t.get('created_at', ''))
    position  = next((i + 1 for i, t in enumerate(waiting) if t.get('number') == turn_number), None)
    turn_doc  = next((t for t in all_turns if t.get('number') == turn_number), None)
    return {
        'position':    position,
        'turns_ahead': max(0, position - 1) if position else 0,
        'status':      turn_doc.get('status') if turn_doc else None
    }, 200


def get_sedes_service() -> tuple[dict, int]:
    if not db:
        return {'sedes': []}, 200
    sedes = []
    for doc in db.collection('sedes').stream():
        d = doc.to_dict()
        if d and d.get('is_active', True):
            sedes.append({'id': doc.id, 'name': d.get('name', ''), 'city': d.get('city', ''), 'address': d.get('address', ''), 'is_active': True})
    sedes.sort(key=lambda s: s.get('name', ''))
    return {'sedes': sedes}, 200


def call_next_service(called_by: str, calling_role: str, service_type: str = '') -> tuple[dict, int]:
    if not db:
        return {'message': 'Servicio no disponible'}, 503

    employee_sede_id = _get_employee_sede_id(called_by, calling_role)

    all_turns = _fs_all_turns()
    waiting = [t for t in all_turns if t.get('status') == 'waiting']
    if employee_sede_id:
        # Cada empleado (incluido el especialista virtual, sede_id='VIRTUAL')
        # solo atiende turnos de su propia sede/cola.
        waiting = [t for t in waiting if t.get('sede_id') == employee_sede_id]
    if service_type:
        waiting = [t for t in waiting if t.get('service_type') == service_type]
    waiting.sort(key=lambda t: t.get('created_at', ''))

    if not waiting:
        return {'message': 'No turns waiting'}, 200

    turn = waiting[0]
    db.collection('turns').document(turn['_doc_id']).update({
        'status':    'called',
        'called_by': called_by,
        'called_at': timezone.now().isoformat()
    })
    broadcast_turn_update()
    return {'number': turn.get('number')}, 200


def cancel_current_service(username: str, role: str) -> tuple[dict, int]:
    if not db:
        return {'success': False, 'message': 'Servicio no disponible'}, 503

    sede_id = _get_employee_sede_id(username, role)
    all_turns = _fs_all_turns()
    called = [t for t in all_turns if t.get('status') == 'called']
    if sede_id:
        called = [t for t in called if t.get('sede_id') == sede_id]
    called.sort(key=lambda t: t.get('created_at', ''), reverse=True)
    if not called:
        return {'success': False, 'message': 'No hay turno en progreso'}, 404

    turn = called[0]
    db.collection('turns').document(turn['_doc_id']).update({
        'status':       'cancelled',
        'cancelled_at': timezone.now().isoformat(),
        'cancelled_by': username
    })
    broadcast_turn_update()
    return {'success': True, 'message': 'Turno cancelado'}, 200


def finish_current_service(done_by: str, role: str) -> tuple[dict, int]:
    if not db:
        return {'message': 'Servicio no disponible'}, 503

    sede_id = _get_employee_sede_id(done_by, role)
    all_turns = _fs_all_turns()
    called = [t for t in all_turns if t.get('status') == 'called']
    if sede_id:
        called = [t for t in called if t.get('sede_id') == sede_id]
    called.sort(key=lambda t: t.get('created_at', ''), reverse=True)
    if not called:
        return {'message': 'No turn in progress'}, 200

    turn = called[0]
    db.collection('turns').document(turn['_doc_id']).update({
        'status':      'finished',
        'finished_at': timezone.now().isoformat(),
        'finished_by': done_by
    })
    broadcast_turn_update()
    return {'number': turn.get('number')}, 200


def get_all_turns_service(username: str, role: str) -> tuple[dict, int]:
    sede_id = _get_employee_sede_id(username, role)
    all_turns = _fs_all_turns()
    if sede_id:
        # Cada empleado ve solo los turnos de su propia sede. Los turnos
        # virtuales (sede_id='VIRTUAL') solo los ve el empleado especialista
        # asignado a esa "sede" virtual, no el resto del personal.
        all_turns = [t for t in all_turns if t.get('sede_id') == sede_id]
    all_turns.sort(key=lambda t: t.get('created_at', ''), reverse=True)
    sedes_map = _sedes_map()

    return {'turns': [{
        'id':           t.get('_doc_id', ''),
        'number':       t.get('number', ''),
        'status':       t.get('status', ''),
        'service_type': t.get('service_type', ''),
        'sede_id':      t.get('sede_id', ''),
        'sede':         _resolve_sede_name(t.get('sede_id', ''), sedes_map),
        'created_at':   _fmt_time(t.get('created_at', '')),
        'called_by':    t.get('called_by', ''),
        'created_by':   t.get('created_by', ''),
        'scheduled_for':_fmt_datetime(t.get('scheduled_for', '')),
        'meet_link':          t.get('meet_link', ''),
        'required_documents': t.get('required_documents', []),
        'uploaded_documents': t.get('uploaded_documents', []),
        'chat_messages':      t.get('chat_messages', []),
    } for t in all_turns]}, 200


def get_statistics_service() -> tuple[dict, int]:
    if not db:
        return {'total': 0, 'waiting': 0, 'called': 0, 'finished': 0, 'cancelled': 0}, 200
    all_turns = _fs_all_turns()
    return {
        'total':     len(all_turns),
        'waiting':   sum(1 for t in all_turns if t.get('status') == 'waiting'),
        'called':    sum(1 for t in all_turns if t.get('status') == 'called'),
        'finished':  sum(1 for t in all_turns if t.get('status') == 'finished'),
        'cancelled': sum(1 for t in all_turns if t.get('status') == 'cancelled'),
    }, 200
