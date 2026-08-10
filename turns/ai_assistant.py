"""Asistente virtual de Turnify Pro (Gemini + function-calling).

Inicializa el cliente de google-genai de forma perezosa y segura (mismo
patrón try/except -> None que turns/firebase_config.py usa para Firebase),
para que la ausencia o invalidez de GEMINI_API_KEY nunca tumbe el servidor.

Las herramientas del modelo llaman a turns/turn_services.py — la misma capa
que usan los endpoints HTTP — para que el chatbot y el resto de la app nunca
diverjan en cómo se crea, cancela o consulta un turno.
"""
from django.conf import settings
from .turn_services import (
    create_turn_service, cancel_own_turn_service, get_my_active_turn_service,
    get_my_turns_service, get_position_service, get_sedes_service,
    call_next_service, cancel_current_service, finish_current_service,
    get_all_turns_service, get_statistics_service,
)

try:
    import google.genai
    from google.genai import types
except Exception:
    google = None
    types = None


class AIUnavailableError(Exception):
    """El asistente no pudo generar una respuesta (sin API key, key inválida,
    cuota agotada, SDK ausente, error de red, etc). La vista atrapa esto y
    responde 503 para que el frontend use su respaldo local."""


_client = None
_client_init_done = False


def _get_client():
    global _client, _client_init_done
    if _client_init_done:
        return _client
    _client_init_done = True
    api_key = getattr(settings, 'GEMINI_API_KEY', '')
    if not types or not api_key:
        _client = None
        return None
    try:
        _client = google.genai.Client(api_key=api_key)
    except Exception:
        _client = None
    return _client


SYSTEM_PROMPT = """Te llamas TURNITY, el asistente virtual de Turnify Pro, un sistema
de gestión de turnos (tipo banco/hospital/oficina de atención al público). Si te
preguntan tu nombre, respondes que eres TURNITY. Respondes siempre
íntegramente en español (nunca mezcles palabras en inglés como "Option", usa
"Opción"), con un tono cercano, claro y profesional, apto también para personas de
la tercera edad que no dominan la tecnología.

ESTILO DE RESPUESTA: nunca uses emojis ni íconos (nada de 🤖, 📌, 🔔, etc.). Usa
formato Markdown sobrio (negritas, listas, encabezados) sin adornos visuales
adicionales. Mantén un tono profesional y directo, evitando exclamaciones
excesivas.

CÓMO FUNCIONA LA APP:
- Para pedir un turno: Inicio → elegir tipo de atención (General, Preferencial B,
  Emergencia) → elegir modalidad (Presencial o Virtual) → elegir sede → botón
  "Pedir mi Turno".
- Tipos de turno: General (prefijo A), Preferencial (B), Emergencia (E), Virtual (W).
- Atención preferencial (tipo B): adultos mayores (+60 años), personas con
  discapacidad, mujeres embarazadas, madres con bebés.
- Documentos: documento de identidad (CC, CE, Pasaporte) y los específicos del
  trámite; se recomienda llevar copias.
- Posición y tiempo de espera: se puede consultar en tiempo real; suena una alarma
  cuando quedan 2 turnos antes del propio.
- Cancelar turno: solo es posible mientras está "en espera" (waiting); una vez que
  el turno es llamado ya no se puede cancelar.
- Horarios: Lunes a Viernes 7:00am-5:00pm, Sábados 8:00am-12:00pm, Domingos y
  festivos cerrado.
- Modalidad virtual: atención por videollamada/chat, requiere buena conexión a
  internet.

Tienes herramientas para EJECUTAR acciones reales en nombre del usuario autenticado
que te está escribiendo. Úsalas siempre que el usuario pida una acción o un dato real
(no inventes números de turno, posiciones ni estados — consúltalos con la
herramienta correspondiente). Nunca pidas ni reveles contraseñas, tokens, ni datos
de otros usuarios. Si una herramienta devuelve un error, explícaselo al usuario de
forma amable y, si aplica, sugiere una alternativa (por ejemplo, si ya tiene un
turno activo, dile cuál es en vez de intentar crear otro)."""


def _client_tool_declarations():
    return [
        types.FunctionDeclaration(
            name="crear_turno",
            description="Crea un nuevo turno para el usuario autenticado.",
            parameters=types.Schema(type="OBJECT", properties={
                "service_type": types.Schema(type="STRING", description="general | preferential | emergency | virtual"),
                "sede": types.Schema(type="STRING", description="Nombre de la sede elegida"),
            }, required=["service_type", "sede"]),
        ),
        types.FunctionDeclaration(
            name="cancelar_turno",
            description="Cancela un turno del usuario autenticado, solo si está en espera.",
            parameters=types.Schema(type="OBJECT", properties={
                "turn_number": types.Schema(type="STRING", description="Número del turno, ej: A003"),
            }, required=["turn_number"]),
        ),
        types.FunctionDeclaration(
            name="consultar_mi_turno",
            description="Consulta el turno activo actual del usuario autenticado.",
            parameters=types.Schema(type="OBJECT", properties={}, required=[]),
        ),
        types.FunctionDeclaration(
            name="consultar_mis_turnos",
            description="Consulta el historial de turnos del usuario autenticado.",
            parameters=types.Schema(type="OBJECT", properties={}, required=[]),
        ),
        types.FunctionDeclaration(
            name="consultar_posicion",
            description="Consulta la posición en la fila de un turno. Si no se da turn_number, usa el turno activo del usuario.",
            parameters=types.Schema(type="OBJECT", properties={
                "turn_number": types.Schema(type="STRING", description="Número del turno (opcional)"),
            }, required=[]),
        ),
        types.FunctionDeclaration(
            name="listar_sedes",
            description="Lista las sedes disponibles.",
            parameters=types.Schema(type="OBJECT", properties={}, required=[]),
        ),
    ]


def _staff_tool_declarations():
    return [
        types.FunctionDeclaration(
            name="llamar_siguiente_turno",
            description="Llama al siguiente turno en espera de la sede del empleado (o de todas si es admin).",
            parameters=types.Schema(type="OBJECT", properties={
                "service_type": types.Schema(type="STRING", description="Filtro opcional: general|preferential|emergency|virtual"),
            }, required=[]),
        ),
        types.FunctionDeclaration(
            name="cancelar_turno_actual",
            description="Cancela el turno que está siendo atendido actualmente.",
            parameters=types.Schema(type="OBJECT", properties={}, required=[]),
        ),
        types.FunctionDeclaration(
            name="completar_turno_actual",
            description="Marca como finalizado el turno que está siendo atendido actualmente.",
            parameters=types.Schema(type="OBJECT", properties={}, required=[]),
        ),
        types.FunctionDeclaration(
            name="consultar_todos_los_turnos",
            description="Lista todos los turnos de la sede del empleado (o de todas si es admin).",
            parameters=types.Schema(type="OBJECT", properties={}, required=[]),
        ),
        types.FunctionDeclaration(
            name="obtener_estadisticas",
            description="Obtiene estadísticas generales de turnos (totales, en espera, atendidos, cancelados).",
            parameters=types.Schema(type="OBJECT", properties={}, required=[]),
        ),
    ]


def _tools_for_role(role: str):
    decls = _client_tool_declarations()
    if role in ('employee', 'admin'):
        decls = decls + _staff_tool_declarations()
    return [types.Tool(function_declarations=decls)]


def _execute_tool(name: str, args: dict, username: str, role: str) -> dict:
    """Despacho server-side. username/role vienen del JWT ya decodificado por
    la vista, nunca de argumentos del modelo, así la IA jamás puede actuar
    como otro usuario ni ejecutar herramientas fuera de su rol."""
    if name == "crear_turno":
        data, _ = create_turn_service(username, args.get("service_type", "general"), args.get("sede", "MOSQUERA"))
        return data
    if name == "cancelar_turno":
        data, _ = cancel_own_turn_service(username, args.get("turn_number", ""))
        return data
    if name == "consultar_mi_turno":
        data, _ = get_my_active_turn_service(username)
        return data
    if name == "consultar_mis_turnos":
        data, _ = get_my_turns_service(username)
        return data
    if name == "consultar_posicion":
        turn_number = args.get("turn_number")
        if not turn_number:
            active, _ = get_my_active_turn_service(username)
            turn_number = (active.get("turn") or {}).get("number")
            if not turn_number:
                return {"error": "No tienes un turno activo"}
        data, _ = get_position_service(turn_number)
        return data
    if name == "listar_sedes":
        data, _ = get_sedes_service()
        return data

    if role in ('employee', 'admin'):
        if name == "llamar_siguiente_turno":
            data, _ = call_next_service(username, role, args.get("service_type", ""))
            return data
        if name == "cancelar_turno_actual":
            data, _ = cancel_current_service(username, role)
            return data
        if name == "completar_turno_actual":
            data, _ = finish_current_service(username, role)
            return data
        if name == "consultar_todos_los_turnos":
            data, _ = get_all_turns_service(username, role)
            return data
        if name == "obtener_estadisticas":
            data, _ = get_statistics_service()
            return data

    return {"error": f"Esa acción no está disponible para tu rol"}


MAX_TOOL_ROUNDS = 3


def _build_context_note(username: str) -> str:
    """Consulta el turno activo del usuario (y su posición) una vez por
    request y lo devuelve como texto para inyectar en el system_instruction,
    para que el modelo pueda responder preguntas de estado sin tener que
    invocar una herramienta primero."""
    active, _ = get_my_active_turn_service(username)
    turn = (active or {}).get('turn')
    if not turn:
        return ("\n\nCONTEXTO ACTUAL DEL USUARIO: no tiene ningún turno activo "
                "en este momento.")

    lines = [
        f"- Número de turno: {turn.get('number', '')}",
        f"- Estado: {turn.get('status', '')}",
        f"- Tipo de atención: {turn.get('service_type', '')}",
        f"- Sede: {turn.get('sede', '')}",
    ]
    position_data, _ = get_position_service(turn.get('number', ''))
    position = position_data.get('position')
    if position is not None:
        lines.append(
            f"- Posición en la fila: {position} "
            f"(le faltan {position_data.get('turns_ahead', 0)} turnos antes del suyo)"
        )

    return (
        "\n\nCONTEXTO ACTUAL DEL USUARIO (ya lo tienes, úsalo para responder "
        "preguntas sobre su propio turno sin llamar ninguna herramienta, salvo "
        "que necesites un dato más reciente o vaya a realizar una acción):\n"
        + "\n".join(lines)
    )


def _build_request(message: str, history: list, username: str, role: str):
    """Arma la lista de `contents` (historial + mensaje nuevo) y el
    `GenerateContentConfig` (system prompt + contexto + herramientas del
    rol) — compartido entre la variante normal y la de streaming."""
    contents = []
    for h in (history or [])[-10:]:
        turn_role = 'model' if h.get('role') == 'bot' else 'user'
        text = h.get('text', '')
        if text:
            contents.append(types.Content(role=turn_role, parts=[types.Part.from_text(text=text)]))
    contents.append(types.Content(role='user', parts=[types.Part.from_text(text=message)]))

    config = types.GenerateContentConfig(
        system_instruction=SYSTEM_PROMPT + _build_context_note(username),
        tools=_tools_for_role(role),
    )
    return contents, config


def get_chatbot_reply_stream(message: str, history: list, username: str, role: str):
    """Generador: entrega eventos a medida que llegan de Gemini.

    {'type': 'chunk', 'text': '...'}          — fragmento de la respuesta final
    {'type': 'done', 'actions_taken': [...]}   — fin exitoso
    {'type': 'error', 'message': '...'}        — falla a mitad de stream

    Las rondas de function-calling se resuelven con la MISMA llamada en
    streaming (no se duplica el gasto de cuota haciendo una llamada normal
    y luego otra en streaming): se leen los chunks a medida que llegan y, si
    alguno trae function_calls, se corta ahí y se ejecuta la herramienta —
    en la práctica Gemini entrega el function_call completo en un solo
    chunk, nunca texto parcial. Solo la ronda final (sin más herramientas
    que llamar) se transmite como texto progresivo al usuario.
    """
    client = _get_client()
    if not client:
        raise AIUnavailableError("Cliente de Gemini no configurado")

    contents, config = _build_request(message, history, username, role)
    actions_taken = []

    try:
        for _ in range(MAX_TOOL_ROUNDS):
            stream = client.models.generate_content_stream(
                model=settings.GEMINI_MODEL, contents=contents, config=config,
            )

            fc = None
            fc_content = None
            any_text = False

            for chunk in stream:
                if chunk.function_calls:
                    fc = chunk.function_calls[0]
                    fc_content = chunk.candidates[0].content
                    break
                piece = chunk.text or ''
                if piece:
                    any_text = True
                    yield {'type': 'chunk', 'text': piece}

            if fc is None:
                if not any_text:
                    yield {'type': 'chunk', 'text': "No logré entender tu mensaje, ¿puedes reformularlo?"}
                yield {'type': 'done', 'actions_taken': actions_taken}
                return

            args = dict(fc.args) if fc.args else {}
            result = _execute_tool(fc.name, args, username, role)
            actions_taken.append({"tool": fc.name, "args": args, "result": result})

            contents.append(fc_content)
            contents.append(types.Content(role='user', parts=[
                types.Part.from_function_response(name=fc.name, response={"result": result})
            ]))

        yield {'type': 'chunk', 'text': "Hice varias acciones, pero necesito que me confirmes cuál es el siguiente paso."}
        yield {'type': 'done', 'actions_taken': actions_taken}
    except Exception as e:
        yield {'type': 'error', 'message': str(e)}


def get_proactive_message(turn_number: str, position: int) -> str:
    """Genera un aviso breve y cálido cuando el turno del usuario está por
    ser llamado (llamado desde home.ts cuando turns_ahead <= 2). Sin
    herramientas: es solo un mensaje de texto, no ejecuta ninguna acción."""
    client = _get_client()
    if not client:
        raise AIUnavailableError("Cliente de Gemini no configurado")

    prompt = (
        f"El turno {turn_number} del usuario está por ser llamado muy pronto "
        f"(le quedan aproximadamente {position} turno(s) por delante). "
        "Escribe un mensaje breve (1-2 frases), cálido y proactivo avisándole "
        "de esto, en español, y ofrécele ayuda con cualquier duda de último "
        "momento (documentos, cómo llegar al módulo, etc). No uses saludos "
        "genéricos tipo 'Hola', ve directo al aviso."
    )

    try:
        response = client.models.generate_content(
            model=settings.GEMINI_MODEL,
            contents=prompt,
            config=types.GenerateContentConfig(system_instruction=SYSTEM_PROMPT),
        )
        return response.text or "Tu turno está por ser llamado, prepárate."
    except Exception as e:
        raise AIUnavailableError(str(e))
