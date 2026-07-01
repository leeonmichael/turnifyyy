from .models import Turn

# Genera un nuevo numero de turno con el prefijo indicado
# Busca el numero mas alto con ese prefijo y le suma 1
# Ejemplo: si existen A1, A2, A3 retorna A4
def generate_turn(prefix="A", sede=""):
    # Each sede has its own independent numbering sequence
    qs = Turn.objects.filter(sede=sede) if sede else Turn.objects.all()
    all_turns = qs.values_list('number', flat=True)
    prefix_len = len(prefix)
    prefix_turns = [
        t for t in all_turns
        if t.startswith(prefix) and len(t) > prefix_len and t[prefix_len:].isdigit()
    ]
    if not prefix_turns:
        return f"{prefix}1"
    max_num = max(int(t[prefix_len:]) for t in prefix_turns)
    return f"{prefix}{max_num + 1}"

# Obtiene el prefijo correspondiente al tipo de servicio
# general -> A, preferential -> B, vip -> V, emergency -> E
def get_turn_prefix(service_type="general"):
    prefixes = {
        "general": "A",
        "preferential": "B",
        "vip": "V",
        "emergency": "E"
    }
    return prefixes.get(service_type, "A")