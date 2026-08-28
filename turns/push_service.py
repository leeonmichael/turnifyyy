"""Envío de notificaciones push (Expo) cuando el turno de un cliente se acerca.

Se dispara desde fs_helpers.broadcast_turn_update(), que ya se llama cada vez
que un turno cambia de estado (creado, llamado, finalizado, cancelado). Cada
turno guarda flags 'push_notified_close' / 'push_notified_called' en su propio
documento de Firestore para no reenviar la misma notificación en cada broadcast.
"""
import requests

EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send'
CLOSE_THRESHOLD = 2  # notifica cuando quedan 2 turnos o menos por delante


def send_push_notification(token: str, title: str, body: str, data: dict | None = None) -> None:
    if not token:
        return
    try:
        requests.post(
            EXPO_PUSH_URL,
            json={'to': token, 'title': title, 'body': body, 'sound': 'default', 'priority': 'high', 'data': data or {}},
            headers={'Content-Type': 'application/json', 'Accept': 'application/json'},
            timeout=5,
        )
    except Exception:
        pass


def notify_upcoming_turns() -> None:
    from .firebase_config import db
    from .fs_helpers import _fs_get_user

    if not db:
        return

    try:
        docs = list(db.collection('turns').stream())
    except Exception:
        return
    entries = [(doc.id, doc.to_dict()) for doc in docs if doc.to_dict()]

    def push_token_for(username: str):
        if not username:
            return None
        u = _fs_get_user(username)
        return (u or {}).get('push_token') or None

    # Notifica a quien acaban de llamar: es su turno YA.
    for doc_id, t in entries:
        if t.get('status') != 'called' or t.get('push_notified_called'):
            continue
        token = push_token_for(t.get('created_by'))
        if not token:
            continue
        send_push_notification(
            token, '¡Es tu turno!',
            f"Turno {t.get('number')} - dirígete al módulo de atención.",
            {'type': 'called', 'number': t.get('number')}
        )
        db.collection('turns').document(doc_id).update({'push_notified_called': True})

    # Notifica a quienes están a punto de ser llamados (por sede, misma cola que usa el front).
    by_sede: dict[str, list[tuple[str, dict]]] = {}
    for doc_id, t in entries:
        if t.get('status') == 'waiting':
            by_sede.setdefault(t.get('sede_id', ''), []).append((doc_id, t))

    for sede, waiting in by_sede.items():
        waiting.sort(key=lambda x: x[1].get('created_at', ''))
        for idx, (doc_id, t) in enumerate(waiting):
            if idx > CLOSE_THRESHOLD or t.get('push_notified_close'):
                continue
            token = push_token_for(t.get('created_by'))
            if not token:
                continue
            body = 'Eres el siguiente en la fila.' if idx == 0 else f"Te quedan {idx} turno(s) antes del tuyo."
            send_push_notification(
                token, 'Tu turno se acerca',
                f"Turno {t.get('number')} - {body}",
                {'type': 'close', 'number': t.get('number'), 'turns_ahead': idx}
            )
            db.collection('turns').document(doc_id).update({'push_notified_close': True})
