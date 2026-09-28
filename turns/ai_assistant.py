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
            description="Crea un nuevo turno para el usuario autenticado. Para turnos presenciales, primero llama a listar_sedes y usa el id de la sede elegida (no el nombre).",
            parameters=types.Schema(type="OBJECT", properties={
                "service_type": types.Schema(type="STRING", description="general | preferential | emergency | virtual"),
                "sede_id": types.Schema(type="STRING", description="Id de la sede elegida (obtenido de listar_sedes). No requerido para turnos virtuales."),
            }, required=["service_type"]),
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
        data, _ = create_turn_service(username, args.get("service_type", "general"), args.get("sede_id", ""))
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
    items = [h for h in (history or [])[-10:] if h.get('text')]
    # La web manda el mensaje actual también dentro del historial: se quita
    # para no enviarlo dos veces seguidas.
    if items and items[-1].get('role') != 'bot' and items[-1].get('text', '').strip() == message.strip():
        items.pop()
    # Gemini espera que la conversación empiece por el usuario y alterne
    # roles: se descartan los mensajes iniciales del bot (el saludo) y se
    # unen los mensajes consecutivos del mismo rol.
    while items and items[0].get('role') == 'bot':
        items.pop(0)
    contents = []
    for h in items:
        turn_role = 'model' if h.get('role') == 'bot' else 'user'
        if contents and contents[-1].role == turn_role:
            contents[-1].parts.append(types.Part.from_text(text=h['text']))
        else:
            contents.append(types.Content(role=turn_role, parts=[types.Part.from_text(text=h['text'])]))
    if contents and contents[-1].role == 'user':
        contents[-1].parts.append(types.Part.from_text(text=message))
    else:
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

            fcs = None
            fc_content = None
            any_text = False

            for chunk in stream:
                if chunk.function_calls:
                    fcs = chunk.function_calls
                    fc_content = chunk.candidates[0].content
                    break
                piece = chunk.text or ''
                if piece:
                    any_text = True
                    yield {'type': 'chunk', 'text': piece}

            if fcs is None:
                if not any_text:
                    # Gemini a veces termina sin texto (sobre todo justo después
                    # de ejecutar una herramienta): en vez de decir "no te
                    # entendí", se informa lo que se hizo o se ejecuta la orden
                    # con el respaldo por reglas.
                    yield {'type': 'chunk', 'text': _reply_without_model_text(message, actions_taken, username, role)}
                yield {'type': 'done', 'actions_taken': actions_taken}
                return

            # El modelo puede pedir varias herramientas en paralelo: cada
            # function_call necesita su function_response o Gemini rechaza la
            # siguiente ronda.
            responses = []
            for fc in fcs:
                args = dict(fc.args) if fc.args else {}
                result = _execute_tool(fc.name, args, username, role)
                actions_taken.append({"tool": fc.name, "args": args, "result": result})
                responses.append(types.Part.from_function_response(name=fc.name, response={"result": result}))

            contents.append(fc_content)
            contents.append(types.Content(role='user', parts=responses))

        yield {'type': 'chunk', 'text': _summarize_actions(actions_taken)}
        yield {'type': 'done', 'actions_taken': actions_taken}
    except Exception as e:
        if actions_taken:
            # La acción ya se ejecutó: se informa en vez de devolver error
            # (si no, el respaldo de la vista la intentaría ejecutar de nuevo).
            yield {'type': 'chunk', 'text': _summarize_actions(actions_taken)}
            yield {'type': 'done', 'actions_taken': actions_taken}
        else:
            yield {'type': 'error', 'message': str(e)}


def _summarize_actions(actions_taken: list) -> str:
    """Texto para el usuario a partir del resultado de la última acción."""
    if not actions_taken:
        return "Listo."
    last = actions_taken[-1]
    tool, result = last['tool'], last.get('result') or {}
    if result.get('error'):
        extra = f": **{result['existing_number']}**" if result.get('existing_number') else ''
        return f"No se pudo completar la acción. {result['error']}{extra}."
    if tool == 'crear_turno' and result.get('number'):
        reply = f"Listo, tu turno **{result['number']}** fue creado."
        if result.get('meet_link'):
            reply += f"\n\nEnlace de la videollamada: {result['meet_link']}"
        return reply
    if tool == 'cancelar_turno' and result.get('success'):
        return f"Listo, cancelé tu turno **{result.get('number', '')}**."
    if tool == 'llamar_siguiente_turno':
        return f"Listo, llamé al turno **{result['number']}**." if result.get('number') else "No hay turnos en espera."
    if tool == 'completar_turno_actual' and result.get('number'):
        return f"Listo, el turno **{result['number']}** quedó finalizado."
    if tool == 'consultar_mi_turno':
        turn = result.get('turn')
        return (f"Tu turno activo es **{turn['number']}**." if turn
                else "No tienes ningún turno activo en este momento.")
    if tool == 'consultar_posicion' and result.get('position'):
        return (f"Estás en la posición **{result['position']}** "
                f"(faltan {result.get('turns_ahead', 0)} turnos antes del tuyo).")
    return "Listo, ya realicé la acción que pediste."


def _reply_without_model_text(message: str, actions_taken: list, username: str, role: str) -> str:
    if actions_taken:
        return _summarize_actions(actions_taken)
    try:
        reply = get_fallback_reply(message, username, role)
    except Exception:
        reply = None
    return reply or ("¿Me lo puedes decir de otra forma? Por ejemplo: \"pídeme un turno\", "
                     "\"cancela mi turno\", \"¿cuál es mi turno?\" o \"¿cuántos faltan?\".")


def transcribe_audio(audio_bytes: bytes, mime_type: str) -> str:
    """Transcribe una nota de voz a texto con Gemini (chat por voz de la web
    y de la app móvil). Si el modelo principal falla (cuota agotada, modelo
    no disponible...), se prueba con otros modelos, que en el plan gratuito
    tienen cuotas independientes."""
    client = _get_client()
    if not client:
        raise AIUnavailableError("Cliente de Gemini no configurado (falta GEMINI_API_KEY)")

    errors = []
    models = _transcription_models(client)
    # Los 503 "high demand" / 429 de Google son momentáneos: si todos los
    # modelos fallan, se espera un poco y se reintenta (hasta 3 vueltas).
    for attempt, wait in enumerate((0, 1.5, 3)):
        if wait:
            time.sleep(wait)
        errors = []
        for model in models:
            try:
                response = client.models.generate_content(
                    model=model,
                    contents=[
                        types.Part.from_bytes(data=audio_bytes, mime_type=mime_type),
                        types.Part.from_text(
                            text="Transcribe exactamente lo que se dice en este audio, en español. "
                                 "Responde únicamente con la transcripción, sin comentarios, comillas "
                                 "ni texto adicional."
                        ),
                    ],
                )
                return (response.text or '').strip()
            except Exception as e:
                errors.append(f"{model}: {str(e)[:120]}")
                print(f"[chatbot-voz] Intento {attempt + 1}: falló la transcripción con {model} "
                      f"({mime_type}, {len(audio_bytes)} bytes): {e}", flush=True)
        # Solo vale la pena reintentar si todos los fallos fueron momentáneos.
        if not all(re.search(r'\b(503|429|500|UNAVAILABLE|RESOURCE_EXHAUSTED|INTERNAL)\b', err) for err in errors):
            break
    raise AIUnavailableError(' | '.join(errors) or 'Sin modelos disponibles')


_available_flash_models = None


def _transcription_models(client) -> list:
    """Modelo configurado primero y luego los modelos "flash" que la API key
    tiene disponibles de verdad (Google retira modelos con frecuencia, así
    que no se usa una lista fija). La consulta se hace una sola vez."""
    global _available_flash_models
    if _available_flash_models is None:
        found = []
        try:
            for m in client.models.list():
                name = (getattr(m, 'name', '') or '').replace('models/', '')
                actions = getattr(m, 'supported_actions', None) or []
                if ('flash' in name and 'generateContent' in actions
                        and not re.search(r'image|tts|live|audio|embed|thinking|exp|preview', name)):
                    found.append(name)
        except Exception as e:
            print(f"[chatbot-voz] No se pudo listar los modelos: {e}", flush=True)
        # Versiones más nuevas primero; "-lite" después de su versión completa.
        found.sort(key=lambda n: ([-int(x) for x in re.findall(r'\d+', n)], 'lite' in n))
        _available_flash_models = found[:6]
        print(f"[chatbot-voz] Modelos flash disponibles: {_available_flash_models}", flush=True)

    models = []
    for m in [settings.GEMINI_MODEL, 'gemini-flash-latest', 'gemini-2.5-flash', *_available_flash_models]:
        if m and m not in models:
            models.append(m)
    return models[:6]


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


# ─── Respaldo sin IA: detecta la intención y ejecuta la acción real ──────────
# Si Gemini no está disponible (sin API key, cuota agotada, error de red), el
# chatbot igual debe poder ejecutar lo que el usuario pide por texto o por voz
# ("pídeme un turno", "cancela mi turno", "¿cuántos faltan?"). Usa las mismas
# herramientas que el modelo (_execute_tool), así que respeta el rol del JWT.

import re
import time
import unicodedata

_SERVICE_LABELS = {
    'general': 'General', 'preferential': 'Preferencial',
    'emergency': 'Emergencia', 'virtual': 'Virtual',
}
_STATUS_LABELS = {
    'waiting': 'en espera', 'called': 'llamado', 'finished': 'finalizado',
    'cancelled': 'cancelado',
}


def _normalize(text: str) -> str:
    text = unicodedata.normalize('NFD', (text or '').lower())
    return ''.join(c for c in text if unicodedata.category(c) != 'Mn')


def _detect_service_type(t: str) -> str:
    if re.search(r'preferencial|prioridad|tercera edad|adulto mayor|discapacidad|embarazada', t):
        return 'preferential'
    if re.search(r'emergencia|urgencia|urgente', t):
        return 'emergency'
    if re.search(r'virtual|en linea|online|videollamada', t):
        return 'virtual'
    return 'general'


def _detect_sede_id(t: str) -> str:
    sedes, _ = get_sedes_service()
    for s in sedes.get('sedes', []):
        for field in ('name', 'city'):
            value = _normalize(s.get(field, ''))
            if value and value in t:
                return s['id']
    return ''


def _turn_number_in(message: str) -> str:
    m = re.search(r'\b([abewABEW])\s*-?\s*(\d{1,4})\b', message)
    return f"{m.group(1).upper()}{m.group(2).zfill(3)}" if m else ''


def _active_turn(username: str):
    data, _ = get_my_active_turn_service(username)
    return (data or {}).get('turn')


def get_fallback_reply(message: str, username: str, role: str):
    """Devuelve la respuesta tras ejecutar la acción pedida, o None si el
    mensaje no es una orden reconocible (el frontend usa entonces sus
    respuestas locales de preguntas frecuentes)."""
    t = _normalize(message)
    is_how_question = bool(re.search(r'\bcomo\b|\bpuedo\b|\bse puede\b|\bque pasa\b', t))
    mentions_turn = bool(re.search(r'turno|cita|ficha|numero', t))
    staff = role in ('employee', 'admin')

    # ── Acciones de empleado/admin ──
    if staff and not is_how_question:
        if re.search(r'\b(llama|llamar|llame)\b', t) or re.search(r'\bsiguiente\b', t):
            data = _execute_tool('llamar_siguiente_turno', {'service_type': ''}, username, role)
            if data.get('number'):
                return f"Listo, llamé al turno **{data['number']}**."
            return "No hay turnos en espera en este momento."
        if re.search(r'\b(finaliza|finalizar|completa|completar|termina|terminar|atendido)\b', t):
            data = _execute_tool('completar_turno_actual', {}, username, role)
            if data.get('number'):
                return f"Listo, el turno **{data['number']}** quedó finalizado."
            return "No hay ningún turno en atención para finalizar."
        if re.search(r'estadistica|reporte|resumen', t):
            d = _execute_tool('obtener_estadisticas', {}, username, role)
            return (f"Estadísticas de turnos:\n\n• Total: {d.get('total', 0)}\n• En espera: {d.get('waiting', 0)}\n"
                    f"• Llamados: {d.get('called', 0)}\n• Finalizados: {d.get('finished', 0)}\n"
                    f"• Cancelados: {d.get('cancelled', 0)}")

    # ── Cancelar turno ──
    if re.search(r'cancel|anul|elimin|borr|quita', t) and mentions_turn and not is_how_question:
        number = _turn_number_in(message)
        if not number:
            active = _active_turn(username)
            if not active:
                return "No tienes ningún turno activo para cancelar."
            number = active.get('number', '')
        data = _execute_tool('cancelar_turno', {'turn_number': number}, username, role)
        if data.get('success'):
            return f"Listo, cancelé tu turno **{number}**."
        return f"No pude cancelar el turno {number}: {data.get('error', 'intenta de nuevo')}."

    # ── Pedir / crear turno ──
    wants_turn = re.search(
        r'\b(pide|pideme|pedir|pida|saca|sacame|sacar|crea|creame|crear|agenda|agendame|agendar|'
        r'solicita|solicitame|solicitar|dame|quiero|necesito|reserva|reservame|reservar|genera|generame)\b', t)
    if wants_turn and mentions_turn and not is_how_question:
        service_type = _detect_service_type(t)
        sede_id = '' if service_type == 'virtual' else _detect_sede_id(t)
        data = _execute_tool('crear_turno', {'service_type': service_type, 'sede_id': sede_id}, username, role)
        if data.get('number'):
            reply = f"Listo, tu turno **{data['number']}** ({_SERVICE_LABELS[service_type]}) fue creado."
            active = _active_turn(username)
            if active and active.get('sede'):
                reply += f"\n\nSede: {active['sede']}"
            if data.get('meet_link'):
                reply += f"\n\nEnlace de la videollamada: {data['meet_link']}"
            if data.get('fine_notice'):
                reply += f"\n\n{data['fine_notice']}"
            return reply
        if data.get('existing_number'):
            where = f" en {data['existing_sede']}" if data.get('existing_sede') else ''
            return (f"{data.get('error', 'Ya tienes un turno activo')}: **{data['existing_number']}**{where}. "
                    "Si quieres uno nuevo, primero dime \"cancela mi turno\".")
        return f"No pude crear el turno: {data.get('error', 'intenta de nuevo')}."

    # ── Posición en la fila ──
    if re.search(r'posicion|cuantos? (me )?falta|cuantos hay|cuanto (me )?falta|delante|antes que yo|'
                 r'en la fila|cuando me (llaman|toca)', t):
        active = _active_turn(username)
        if not active:
            return "No tienes ningún turno activo. Si quieres, dime \"pídeme un turno\"."
        pos, _ = get_position_service(active.get('number', ''))
        if pos.get('position'):
            return (f"Tu turno **{active['number']}** está en la posición **{pos['position']}** "
                    f"(faltan {pos.get('turns_ahead', 0)} turnos antes del tuyo).")
        status = _STATUS_LABELS.get(active.get('status'), active.get('status', ''))
        return f"Tu turno **{active['number']}** está {status}."

    # ── Historial ──
    if re.search(r'mis turnos|historial', t):
        data, _ = get_my_turns_service(username)
        turns = data.get('turns', [])[:5]
        if not turns:
            return "Aún no tienes turnos registrados."
        lines = [f"• {x['number']} — {_STATUS_LABELS.get(x['status'], x['status'])} ({x.get('sede', '')})" for x in turns]
        return "Tus últimos turnos:\n\n" + "\n".join(lines)

    # ── Turno activo ──
    if re.search(r'mi turno|tengo (un )?turno|estado de mi|cual es mi', t):
        active = _active_turn(username)
        if not active:
            return "No tienes ningún turno activo en este momento."
        return (f"Tu turno activo es **{active['number']}** — "
                f"{_SERVICE_LABELS.get(active.get('service_type'), '')}, "
                f"{_STATUS_LABELS.get(active.get('status'), '')}, sede {active.get('sede', '')}.")

    # ── Sedes ──
    if re.search(r'\bsedes?\b|oficinas', t):
        data, _ = get_sedes_service()
        sedes = data.get('sedes', [])
        if not sedes:
            return "No hay sedes disponibles en este momento."
        return "Sedes disponibles:\n\n" + "\n".join(
            f"• {s['name']} — {s.get('city', '')} {s.get('address', '')}".rstrip() for s in sedes)

    return None
