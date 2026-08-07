def get_turn_prefix(service_type: str = "general") -> str:
    return {'general': 'A', 'preferential': 'B', 'vip': 'V', 'emergency': 'E', 'virtual': 'W'}.get(service_type, 'A')


def generate_turn(prefix: str = "A", sede: str = "") -> str:
    """Generate next turn number using Firestore (legacy-compatible signature)."""
    from .firebase_config import db
    if not db:
        return f"{prefix}1"
    try:
        docs = db.collection('turns').where('sede', '==', sede).stream() if sede else db.collection('turns').stream()
        pl   = len(prefix)
        nums = [
            int(t[pl:])
            for doc in docs
            for t in [(doc.to_dict() or {}).get('number', '')]
            if t.startswith(prefix) and len(t) > pl and t[pl:].isdigit()
        ]
        return f"{prefix}{max(nums) + 1}" if nums else f"{prefix}1"
    except Exception:
        return f"{prefix}1"
