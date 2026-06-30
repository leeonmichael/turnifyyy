"""
AI Assistant para Turnify - Asistente virtual con herramientas de IA
Este archivo permite al asistente de IA consultar, llamar, completar y eliminar turnos
"""
import requests
import time
import sys
import io

# Configurar UTF-8 para emojis
if sys.platform == 'win32':
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8')

import google.genai
from google.genai import types

# ==================== CONFIGURACIÓN ====================
API_KEY = "TU_API_KEY_DE_GEMINI_AQUI"  # Reemplaza con tu API Key de Gemini
BASE_URL = "http://127.0.0.1:8000"

# La API de Turnify no requiere autenticación (token no usado)
TOKEN = "dummy_token"

# Cliente de Gemini
client = google.genai.Client(api_key=API_KEY)
modelo_id = "gemini-2.5-flash"

# ==================== 1. FUNCIONES DE API ====================

def consultar_turnos(token: str):
    """Consulta todos los turnos disponibles en la base de datos"""
    print("\n🔎 Consultando turnos...")
    
    url = f"{BASE_URL}/api/all/"
    # La API no requiere autenticación

    try:
        res = requests.get(url)
        if res.status_code == 200:
            data = res.json()
            return data
        else:
            return {"error": f"HTTP {res.status_code}"}
    except Exception as e:
        return {"error": str(e)}


def llamar_turno(token: str, turno_id: int = None):
    """Llama a un turno específico o al siguiente turno disponible"""
    print(f"\n📞 Llamando turno...")
    
    url = f"{BASE_URL}/api/call/"
    # La API no requiere autenticación
    
    payload = {"number": turno_id} if turno_id else {}
    
    try:
        res = requests.post(url, json=payload)
        return res.json() if res.status_code == 200 else {"error": f"HTTP {res.status_code}"}
    except Exception as e:
        return {"error": str(e)}


def completar_turno(token: str, turno_id: int = None):
    """Completa un turno específico o el turno actual que está siendo llamado"""
    print(f"\n✅ Completando turno...")
    
    # Si no se proporciona ID, buscar el turno que está "calling"
    if not turno_id:
        url_turns = f"{BASE_URL}/api/all/"
        try:
            res = requests.get(url_turns)
            if res.status_code == 200:
                data = res.json()
                turns = data.get('turns', [])
                for t in turns:
                    if t.get('status') == 'calling':
                        turno_id = t.get('number')
                        print(f"📍 Turno en atención encontrado: {turno_id}")
                        break
        except:
            pass
    
    url = f"{BASE_URL}/api/finish/"
    
    # El API espera el número del turno
    payload = {"number": turno_id} if turno_id else {}
    
    try:
        res = requests.post(url, json=payload)
        return res.json() if res.status_code == 200 else {"error": f"HTTP {res.status_code}", "detail": res.text}
    except Exception as e:
        return {"error": str(e)}


def crear_turno(token: str, nombre_cliente: str = None):
    """Crea un nuevo turno en el sistema"""
    print(f"\n🎫 Creando nuevo turno...")
    
    url = f"{BASE_URL}/api/create/"
    # La API no requiere autenticación
    
    payload = {"cliente": nombre_cliente} if nombre_cliente else {}
    
    try:
        res = requests.post(url, json=payload)
        return res.json() if res.status_code == 200 else {"error": f"HTTP {res.status_code}"}
    except Exception as e:
        return {"error": str(e)}


def eliminar_turno(token: str, turno_id: str = None):
    """Elimina un turno específico del sistema por su número"""
    print(f"\n🗑️ Eliminando turno...")
    
    if not turno_id:
        return {"error": "Se requiere el número del turno a eliminar"}
    
    url = f"{BASE_URL}/api/delete/{turno_id}/"
    
    try:
        res = requests.delete(url)
        if res.status_code == 200:
            return res.json()
        else:
            return {"error": f"HTTP {res.status_code}", "detail": res.text}
    except Exception as e:
        return {"error": str(e)}


def reset_turns(token: str):
    """Elimina todos los turnos del sistema (función de administrador)"""
    print(f"\n⚠️ Reiniciando todos los turnos...")
    
    url = f"{BASE_URL}/api/reset/"
    
    try:
        res = requests.post(url)
        return res.json() if res.status_code == 200 else {"error": f"HTTP {res.status_code}"}
    except Exception as e:
        return {"error": str(e)}


# ==================== 2. HERRAMIENTAS PARA LA IA ====================

def get_herramientas():
    """Define las herramientas disponibles para Gemini"""
    return [
        types.Tool(
            function_declarations=[
                types.FunctionDeclaration(
                    name="consultar_turnos",
                    description="Consulta todos los turnos disponibles en el sistema",
                    parameters=types.Schema(type="OBJECT", properties={}, required=[])
                ),
                types.FunctionDeclaration(
                    name="llamar_turno",
                    description="Llama al siguiente turno en cola o a un turno específico",
                    parameters=types.Schema(
                        type="OBJECT", 
                        properties={"turno_id": types.Schema(type="INTEGER", description="ID opcional del turno")},
                        required=[]
                    )
                ),
                types.FunctionDeclaration(
                    name="completar_turno",
                    description="Completa el turno actual o un turno específico",
                    parameters=types.Schema(
                        type="OBJECT",
                        properties={"turno_id": types.Schema(type="INTEGER", description="ID opcional del turno")},
                        required=[]
                    )
                ),
                types.FunctionDeclaration(
                    name="crear_turno",
                    description="Crea un nuevo turno en el sistema",
                    parameters=types.Schema(
                        type="OBJECT",
                        properties={"nombre_cliente": types.Schema(type="STRING", description="Nombre del cliente")},
                        required=[]
                    )
                ),
                types.FunctionDeclaration(
                    name="eliminar_turno",
                    description="Elimina un turno específico del sistema por su número",
                    parameters=types.Schema(
                        type="OBJECT",
                        properties={"turno_id": types.Schema(type="STRING", description="Número del turno a eliminar (ej: A001)")},
                        required=["turno_id"]
                    )
                ),
                types.FunctionDeclaration(
                    name="reset_turns",
                    description="Elimina todos los turnos del sistema (función de administrador)",
                    parameters=types.Schema(type="OBJECT", properties={}, required=[])
                )
            ]
        )
    ]


# ==================== 3. FLUJO PRINCIPAL ====================

def main():
    token = TOKEN
    
    # Mostrar menú de inicio
    print("\n" + "="*50)
    print("🤖 ASISTENTE DE IA - TURNIFY")
    print("="*50)
    print("📋 COMANDOS DISPONIBLES:")
    print("   • consultar turnos   - Ver todos los turnos")
    print("   • llamar turno      - Llamar el siguiente turno")
    print("   • completar turno   - Completar el turno actual")
    print("   • crear turno       - Crear un nuevo turno")
    print("   • eliminar turno    - Eliminar un turno específico")
    print("   • reset turnos      - Eliminar todos los turnos")
    print("   • cambiar token     - Cambiar el token")
    print("   • ayuda             - Ver comandos")
    print("   • salir             - Salir del programa")
    print("="*50)
    print(f"🔑 Token: {token[:15]}...")
    print("="*50)
    
    while True:
        user_input = input("\n👤 Tú: ").strip()
        
        if not user_input:
            continue
            
        if user_input.lower() in ['salir', 'exit', 'bye', 'quit']:
            print("👋 ¡Hasta luego!")
            break
        
        if user_input.lower() in ['ayuda', 'help']:
            print("""
📖 COMANDOS:
  • consultar turnos    - Ver todos los turnos
  • llamar turno        - Llamar el siguiente turno
  • completar turno     - Completar el turno actual
  • crear turno         - Crear un nuevo turno
  • eliminar turno      - Eliminar un turno específico
  • reset turnos        - Eliminar todos los turnos (admin)
  • cambiar token       - Cambiar el token de autenticación
  • salir              - Salir del programa
            """)
            continue
        
        # Opción para cambiar token
        if user_input.lower() == 'cambiar token':
            nuevo_token = input("Ingresa el nuevo token: ").strip()
            if nuevo_token:
                token = nuevo_token
                print(f"✅ Token actualizado")
            continue
        
        # Comandos directos (sin IA)
        if user_input.lower() == 'consultar turnos':
            resultado = consultar_turnos(token)
            
            # Formatear como lista legible
            if isinstance(resultado, dict) and 'turns' in resultado:
                turns = resultado['turns']
                print(f"\n📋 LISTA DE TURNOS ({len(turns)} turnos):")
                print("-" * 40)
                for t in turns:
                    numero = t.get('number', 'N/A')
                    estado = t.get('status', 'N/A')
                    fecha = t.get('created_at', '')
                    # Traducir estado
                    estado_es = {
                        'waiting': '⏳ Esperando',
                        'calling': '📞 Llamando',
                        'completed': '✅ Completado'
                    }.get(estado, estado)
                    print(f"  Turno {numero}: {estado_es}")
                print("-" * 40)
            else:
                print(f"\n📋 RESULTADO: {resultado}")
            continue
            
        if user_input.lower() == 'llamar turno':
            resultado = llamar_turno(token)
            print(f"\n📞 RESULTADO: {resultado}")
            continue
            
        if user_input.lower() == 'completar turno':
            # Buscar turno en atención
            resultado_turnos = consultar_turnos(token)
            turno_a_completar = None
            
            if isinstance(resultado_turnos, dict) and 'turns' in resultado_turnos:
                for t in resultado_turnos['turns']:
                    if t.get('status') == 'calling':
                        turno_a_completar = t.get('number')
                        break
            
            if turno_a_completar:
                resultado = completar_turno(token, turno_a_completar)
            else:
                resultado = completar_turno(token)
            
            print(f"\n✅ RESULTADO: {resultado}")
            continue
            
        if user_input.lower() == 'crear turno':
            nombre = input("Nombre del cliente (opcional): ").strip()
            resultado = crear_turno(token, nombre if nombre else None)
            print(f"\n🎫 RESULTADO: {resultado}")
            continue
        
        if user_input.lower() == 'eliminar turno':
            numero = input("Número del turno a eliminar (ej: A001): ").strip()
            if numero:
                resultado = eliminar_turno(token, numero)
                print(f"\n🗑️ RESULTADO: {resultado}")
            else:
                print("⚠️ Debes especificar el número del turno")
            continue
        
        if user_input.lower() == 'reset turnos':
            confirmacion = input("⚠️ ¿Estás seguro de eliminar TODOS los turnos? (escribe 'si' para confirmar): ").strip().lower()
            if confirmacion == 'si':
                resultado = reset_turns(token)
                print(f"\n⚠️ RESULTADO: {resultado}")
            else:
                print("✅ Cancelado")
            continue
        
        # Si no es un comando directo, usar IA
        prompt = f"""
Eres un asistente para el sistema de turnos Turnify.
El token es: {token}
BASE_URL: {BASE_URL}

El usuario dice: {user_input}

Si el usuario quiere consultar, llamar, completar, crear o eliminar un turno, dime "COMANDO: [comando]" donde [comando] es:
- "consultar turnos"
- "llamar turno" 
- "completar turno"
- "crear turno [nombre]"
- "eliminar turno [numero]"
- "reset turnos"

Responde de forma breve y amigable en español.
"""
        
        try:
            response = client.models.generate_content(
                model=modelo_id,
                contents=prompt,
                config=types.GenerateContentConfig(
                    tools=get_herramientas()
                )
            )
            
            # Verificar si la IA quiere llamar a una función
            if response.function_calls:
                func_call = response.function_calls[0]
                nombre_func = func_call.name
                args = dict(func_call.args) if func_call.args else {}
                
                print(f"\n🔧 Ejecutando: {nombre_func}")
                
                # Ejecutar la función correspondiente
                if nombre_func == "consultar_turnos":
                    resultado = consultar_turnos(token)
                elif nombre_func == "llamar_turno":
                    resultado = llamar_turno(token)
                elif nombre_func == "completar_turno":
                    # El API espera "number" no "turno_id"
                    args.pop('turno_id', None)  # Eliminar turno_id si existe
                    resultado = completar_turno(token)
                elif nombre_func == "crear_turno":
                    resultado = crear_turno(token, args.get("nombre_cliente"))
                elif nombre_func == "eliminar_turno":
                    resultado = eliminar_turno(token, args.get("turno_id"))
                elif nombre_func == "reset_turns":
                    resultado = reset_turns(token)
                else:
                    resultado = {"error": f"Función desconocida: {nombre_func}"}
                
                print(f"📊 Resultado: {resultado}")
            elif response.text:
                # Respuesta normal de texto
                print(f"\n🤖 IA: {response.text}")
            else:
                print("\n🤖 Escribe 'ayuda' para ver los comandos disponibles.")
                
        except Exception as e:
            error_str = str(e)
            print(f"\n⚠️ Error: {e}")
            
            if "429" in error_str:
                print("⏳ Agotado. Esperando 20 segundos...")
                time.sleep(20)
            else:
                pass


if __name__ == "__main__":
    main()
