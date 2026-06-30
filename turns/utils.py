from .models import Turn

# Genera un nuevo numero de turno con el prefijo indicado
# Busca el numero mas alto con ese prefijo y le suma 1
# Ejemplo: si existen A1, A2, A3 retorna A4
def generate_turn(prefix="A"):
    all_turns = Turn.objects.all().values_list('number', flat=True)
    prefix_turns = [t for t in all_turns if t.startswith(prefix) and len(t) > 1 and t[1:].isdigit()]
    
    if not prefix_turns:
        return f"{prefix}1"
    
    max_num = max(int(t[len(prefix):]) for t in prefix_turns)
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