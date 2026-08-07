from django.shortcuts import render, redirect
from django.views.decorators.csrf import csrf_exempt
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework import status
from .firebase_config import db
from .jwt_utils import create_access_token, decode_access_token, get_token_from_request
from .auth_decorators import jwt_required, role_required
from channels.layers import get_channel_layer
from asgiref.sync import async_to_sync
import csv
import io
import re
from django.http import HttpResponse
from django.utils import timezone
from datetime import date, datetime
from django.contrib.auth.hashers import make_password, check_password
from collections import Counter


# ─── Page views ──────────────────────────────────────────────────────────────

def home(request):         return render(request, "index.html")
def employee(request):     return render(request, "index.html")
def screen(request):       return render(request, "index.html")
def dashboard(request):    return render(request, "index.html")
def register_page(request):return render(request, "index.html")
def login_page(request):   return render(request, "index.html")

def logout_page(request):
    response = redirect('/login/')
    response.delete_cookie('turnify_token')
    return response


# ─── Helpers ─────────────────────────────────────────────────────────────────

def validate_email(email: str) -> bool:
    return bool(re.match(r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$', email))


def validate_numeric(value: str, min_length: int):
    if not value.isdigit():
        return False, "Debe contener solo números"
    if len(value) < min_length:
        return False, f"Debe tener mínimo {min_length} dígitos"
    return True, ""


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


# ─── Auth ────────────────────────────────────────────────────────────────────

@csrf_exempt
@api_view(['POST'])
@permission_classes([AllowAny])
def register_user(request):
    username         = request.data.get('username', '').strip()
    password         = request.data.get('password', '').strip()
    confirm_password = request.data.get('confirm_password', '').strip()
    full_name        = request.data.get('full_name', '').strip()
    document_type    = request.data.get('document_type', 'CC').strip()
    cedula           = request.data.get('cedula', '').strip()
    email            = request.data.get('email', '').strip()
    phone            = request.data.get('phone', '').strip()
    accept_terms     = request.data.get('accept_terms', False)

    if not db:
        return Response({'success': False, 'message': 'Servicio no disponible'}, status=503)

    if not username:
        return Response({'success': False, 'field': 'username', 'message': 'El nombre de usuario es requerido'}, status=400)
    if len(username) < 3:
        return Response({'success': False, 'field': 'username', 'message': 'El usuario debe tener mínimo 3 caracteres'}, status=400)
    if _fs_get_user(username):
        return Response({'success': False, 'field': 'username', 'message': 'El nombre de usuario ya está registrado'}, status=409)

    if not password:
        return Response({'success': False, 'field': 'password', 'message': 'La contraseña es requerida'}, status=400)
    if len(password) < 4:
        return Response({'success': False, 'field': 'password', 'message': 'La contraseña debe tener mínimo 4 caracteres'}, status=400)
    if not confirm_password:
        return Response({'success': False, 'field': 'confirm_password', 'message': 'Confirme su contraseña'}, status=400)
    if password != confirm_password:
        return Response({'success': False, 'field': 'confirm_password', 'message': 'Las contraseñas no coinciden'}, status=400)

    if not full_name:
        return Response({'success': False, 'field': 'full_name', 'message': 'El nombre completo es requerido'}, status=400)

    if not cedula:
        return Response({'success': False, 'field': 'cedula', 'message': 'El número de documento es requerido'}, status=400)
    valid, msg = validate_numeric(cedula, 10)
    if not valid:
        return Response({'success': False, 'field': 'cedula', 'message': msg}, status=400)
    if any(u.get('cedula') == cedula for u in _fs_all_users()):
        return Response({'success': False, 'field': 'cedula', 'message': 'Este documento ya está registrado'}, status=409)

    if not email:
        return Response({'success': False, 'field': 'email', 'message': 'El correo electrónico es requerido'}, status=400)
    if not validate_email(email):
        return Response({'success': False, 'field': 'email', 'message': 'Ingrese un correo electrónico válido'}, status=400)
    if any(u.get('email') == email for u in _fs_all_users()):
        return Response({'success': False, 'field': 'email', 'message': 'Este correo ya está registrado'}, status=409)

    if not phone:
        return Response({'success': False, 'field': 'phone', 'message': 'El teléfono es requerido'}, status=400)
    valid, msg = validate_numeric(phone, 10)
    if not valid:
        return Response({'success': False, 'field': 'phone', 'message': msg}, status=400)

    if not accept_terms:
        return Response({'success': False, 'field': 'accept_terms', 'message': 'Debe aceptar términos y condiciones'}, status=400)

    now_iso = timezone.now().isoformat()
    user_doc = {
        'username':      username,
        'password':      make_password(password),
        'full_name':     full_name,
        'document_type': document_type,
        'cedula':        cedula,
        'email':         email,
        'phone':         phone,
        'cargo':         '',
        'entidad':       '',
        'sede':          '',
        'role':          'client',
        'is_active':     True,
        'created_at':    now_iso,
        'updated_at':    now_iso,
    }
    db.collection('users').document(username).set(user_doc)

    token = create_access_token({
        'username':  username,
        'role':      'client',
        'cedula':    cedula,
        'email':     email,
        'full_name': full_name
    })

    return Response({
        'success': True,
        'message': 'Usuario registrado correctamente',
        'token':   token,
        'user':    {'username': username, 'role': 'client', 'cedula': cedula, 'email': email, 'full_name': full_name}
    }, status=201)


@csrf_exempt
@api_view(['POST'])
@permission_classes([AllowAny])
def login_user(request):
    identifier = request.data.get('username', '').strip()
    password   = request.data.get('password', '').strip()

    if not identifier:
        return Response({'success': False, 'field': 'username', 'message': 'Ingrese usuario o correo electrónico'}, status=400)
    if not password:
        return Response({'success': False, 'field': 'password', 'message': 'Ingrese su contraseña'}, status=400)
    if not db:
        return Response({'success': False, 'message': 'Servicio no disponible'}, status=503)

    user_doc = _fs_get_user(identifier)
    if not user_doc:
        all_users = _fs_all_users()
        matches = [u for u in all_users if u.get('email') == identifier]
        user_doc = matches[0] if matches else None

    if not user_doc:
        return Response({'success': False, 'field': 'username', 'message': 'Credenciales inválidas'}, status=401)
    if not check_password(password, user_doc.get('password', '')):
        return Response({'success': False, 'field': 'password', 'message': 'Credenciales inválidas'}, status=401)
    if not user_doc.get('is_active', True):
        return Response({'success': False, 'field': 'username', 'message': 'Cuenta desactivada. Contacte al administrador'}, status=401)

    username = user_doc.get('username', identifier)
    role     = user_doc.get('role', 'client')

    token = create_access_token({
        'username':  username,
        'role':      role,
        'cedula':    user_doc.get('cedula', ''),
        'email':     user_doc.get('email', ''),
        'full_name': user_doc.get('full_name', '')
    })

    try:
        db.collection('users').document(username).update({'last_login': timezone.now().isoformat()})
    except Exception:
        pass

    redirect_map = {'client': '/home/', 'admin': '/dashboard/'}
    return Response({
        'success':      True,
        'token':        token,
        'redirect_url': redirect_map.get(role, '/employee/'),
        'user': {
            'username':  username,
            'role':      role,
            'cedula':    user_doc.get('cedula', ''),
            'email':     user_doc.get('email', ''),
            'full_name': user_doc.get('full_name', ''),
            'sede':      user_doc.get('sede', ''),
            'phone':     user_doc.get('phone', ''),
            'cargo':     user_doc.get('cargo', '')
        }
    })


@csrf_exempt
@api_view(['POST'])
def logout_user(request):
    response = Response({'success': True, 'message': 'Sesión cerrada correctamente'})
    response.delete_cookie('turnify_token')
    return response


@csrf_exempt
@api_view(['GET'])
def verify_session(request):
    token = get_token_from_request(request)
    if not token:
        return Response({'authenticated': False, 'role': None})
    payload = decode_access_token(token)
    if not payload:
        return Response({'authenticated': False, 'role': None})

    username  = payload.get('username')
    user_data = None
    if username:
        u = _fs_get_user(username)
        if u:
            user_data = {
                'username':  u.get('username'),
                'full_name': u.get('full_name'),
                'email':     u.get('email'),
                'phone':     u.get('phone'),
                'cedula':    u.get('cedula'),
                'role':      u.get('role'),
            }

    return Response({
        'authenticated': True,
        'role':          payload.get('role'),
        'username':      payload.get('username'),
        'user':          user_data
    })


@csrf_exempt
@api_view(['PUT'])
def update_profile(request):
    token    = get_token_from_request(request)
    payload  = decode_access_token(token) if token else None
    username = payload.get('username', '') if payload else ''

    if not username:
        return Response({'success': False, 'message': 'No autenticado'}, status=401)

    u = _fs_get_user(username)
    if not u:
        return Response({'success': False, 'message': 'Usuario no encontrado'}, status=404)

    full_name = request.data.get('full_name', u.get('full_name', '')).strip()
    email     = request.data.get('email',     u.get('email',     '')).strip()
    phone     = request.data.get('phone',     u.get('phone',     '')).strip()

    updates = {'full_name': full_name, 'email': email, 'phone': phone, 'updated_at': timezone.now().isoformat()}

    if 'password' in request.data and request.data['password']:
        pw = request.data['password'].strip()
        if len(pw) < 4:
            return Response({'success': False, 'field': 'password', 'message': 'La contraseña debe tener mínimo 4 caracteres'}, status=400)
        updates['password'] = make_password(pw)

    if email and not validate_email(email):
        return Response({'success': False, 'field': 'email', 'message': 'Ingrese un correo electrónico válido'}, status=400)
    if email:
        dup = [usr for usr in _fs_all_users() if usr.get('email') == email and usr.get('username') != username]
        if dup:
            return Response({'success': False, 'field': 'email', 'message': 'Este correo ya está registrado'}, status=409)

    db.collection('users').document(username).update(updates)

    return Response({
        'success': True,
        'message': 'Perfil actualizado correctamente',
        'user': {
            'username':  username,
            'full_name': full_name,
            'email':     email,
            'phone':     phone,
            'cedula':    u.get('cedula', ''),
            'role':      u.get('role', '')
        }
    })


# ─── User Management ─────────────────────────────────────────────────────────

@csrf_exempt
@api_view(['GET'])
@jwt_required
@role_required('admin', 'employee')
def get_users(request):
    token    = get_token_from_request(request)
    payload  = decode_access_token(token) if token else None
    c_role   = (payload.get('role') or '') if payload else ''

    all_users = _fs_all_users()
    if c_role == 'employee':
        all_users = [u for u in all_users if u.get('role') == 'client']
    all_users.sort(key=lambda u: u.get('created_at', ''), reverse=True)

    data = [{
        'username':      u.get('username', ''),
        'role':          u.get('role', ''),
        'full_name':     u.get('full_name') or u.get('username', ''),
        'email':         u.get('email', ''),
        'phone':         u.get('phone', ''),
        'cedula':        u.get('cedula', ''),
        'document_type': u.get('document_type', ''),
        'cargo':         u.get('cargo', ''),
        'entidad':       u.get('entidad', ''),
        'sede':          u.get('sede', ''),
        'is_active':     u.get('is_active', True),
        'created_at':    u.get('created_at', '')
    } for u in all_users]
    return Response({'users': data})


@csrf_exempt
@api_view(['DELETE'])
@jwt_required
@role_required('admin', 'employee')
def delete_user(request, username):
    token   = get_token_from_request(request)
    payload = decode_access_token(token) if token else None
    c_role  = (payload.get('role') or '') if payload else ''

    u = _fs_get_user(username)
    if not u:
        return Response({'success': False, 'message': 'Usuario no encontrado'}, status=404)
    if c_role == 'employee' and u.get('role') != 'client':
        return Response({'success': False, 'message': 'Solo puedes eliminar clientes'}, status=403)

    db.collection('users').document(username).delete()
    return Response({'success': True, 'message': f'Usuario {username} eliminado correctamente'})


@csrf_exempt
@api_view(['POST'])
@jwt_required
@role_required('admin')
def create_employee(request):
    username      = request.data.get('username', '').strip()
    password      = request.data.get('password', '').strip()
    full_name     = request.data.get('full_name', '').strip()
    document_type = request.data.get('document_type', 'CC').strip()
    cedula        = request.data.get('cedula', '').strip()
    email         = request.data.get('email', '').strip()
    phone         = request.data.get('phone', '').strip()
    sede          = request.data.get('sede', '').strip()

    if not username:
        return Response({'success': False, 'field': 'username', 'message': 'El nombre de usuario es requerido'}, status=400)
    if len(username) < 3:
        return Response({'success': False, 'field': 'username', 'message': 'El usuario debe tener mínimo 3 caracteres'}, status=409)
    if _fs_get_user(username):
        return Response({'success': False, 'field': 'username', 'message': 'El nombre de usuario ya está registrado'}, status=409)
    if not password:
        return Response({'success': False, 'field': 'password', 'message': 'La contraseña es requerida'}, status=400)
    if len(password) < 4:
        return Response({'success': False, 'field': 'password', 'message': 'La contraseña debe tener mínimo 4 caracteres'}, status=400)
    if not full_name:
        return Response({'success': False, 'field': 'full_name', 'message': 'El nombre completo es requerido'}, status=400)
    if document_type not in ['CC', 'CE', 'PA', 'NIT', 'PPT']:
        return Response({'success': False, 'field': 'document_type', 'message': 'Tipo de documento no válido'}, status=400)

    all_users = _fs_all_users()

    if cedula:
        valid, msg = validate_numeric(cedula, 10)
        if not valid:
            return Response({'success': False, 'field': 'cedula', 'message': msg}, status=400)
        if any(u.get('cedula') == cedula for u in all_users if u.get('username') != username):
            return Response({'success': False, 'field': 'cedula', 'message': 'Este documento ya está registrado'}, status=409)

    if email:
        if not validate_email(email):
            return Response({'success': False, 'field': 'email', 'message': 'Ingrese un correo electrónico válido'}, status=400)
        if any(u.get('email') == email for u in all_users if u.get('username') != username):
            return Response({'success': False, 'field': 'email', 'message': 'Este correo ya está registrado'}, status=409)

    if phone:
        valid, msg = validate_numeric(phone, 10)
        if not valid:
            return Response({'success': False, 'field': 'phone', 'message': msg}, status=400)

    now_iso = timezone.now().isoformat()
    db.collection('users').document(username).set({
        'username':      username,
        'password':      make_password(password),
        'full_name':     full_name,
        'document_type': document_type,
        'cedula':        cedula,
        'email':         email,
        'phone':         phone,
        'cargo':         'Empleado',
        'entidad':       'EPS',
        'sede':          sede,
        'role':          'employee',
        'is_active':     True,
        'created_at':    now_iso,
        'updated_at':    now_iso,
    })

    return Response({
        'success': True,
        'message': 'Empleado creado correctamente',
        'user': {
            'username':      username,
            'role':          'employee',
            'full_name':     full_name,
            'document_type': document_type,
            'cedula':        cedula,
            'email':         email,
            'phone':         phone,
            'cargo':         'Empleado',
            'entidad':       'EPS',
            'sede':          sede,
            'is_active':     True
        }
    })


@csrf_exempt
@api_view(['POST'])
@jwt_required
@role_required('admin')
def update_employee(request, username):
    emp = _fs_get_user(username)
    if not emp or emp.get('role') != 'employee':
        return Response({'success': False, 'message': 'Empleado no encontrado'}, status=404)

    full_name     = request.data.get('full_name',     emp.get('full_name', '')).strip()
    document_type = request.data.get('document_type', emp.get('document_type', 'CC')).strip()
    cedula        = request.data.get('cedula',        emp.get('cedula', '')).strip()
    email         = request.data.get('email',         emp.get('email', '')).strip()
    phone         = request.data.get('phone',         emp.get('phone', '')).strip()
    sede          = request.data.get('sede',          emp.get('sede', '')).strip()

    all_users = _fs_all_users()

    if cedula:
        if not cedula.isdigit():
            return Response({'success': False, 'field': 'cedula', 'message': 'El documento debe contener solo números'}, status=400)
        if len(cedula) < 10:
            return Response({'success': False, 'field': 'cedula', 'message': 'El documento debe tener mínimo 10 dígitos'}, status=400)
        if any(u.get('cedula') == cedula for u in all_users if u.get('username') != username):
            return Response({'success': False, 'field': 'cedula', 'message': 'Este documento ya está registrado'}, status=409)

    if email:
        if not validate_email(email):
            return Response({'success': False, 'field': 'email', 'message': 'Ingrese un correo electrónico válido'}, status=400)
        if any(u.get('email') == email for u in all_users if u.get('username') != username):
            return Response({'success': False, 'field': 'email', 'message': 'Este correo ya está registrado'}, status=409)

    updates = {
        'full_name':     full_name,
        'document_type': document_type,
        'cedula':        cedula,
        'email':         email,
        'phone':         phone,
        'cargo':         'Empleado',
        'entidad':       'EPS',
        'sede':          sede,
        'updated_at':    timezone.now().isoformat(),
    }

    if 'password' in request.data and request.data['password']:
        pw = request.data['password'].strip()
        if len(pw) < 4:
            return Response({'success': False, 'field': 'password', 'message': 'La contraseña debe tener mínimo 4 caracteres'}, status=400)
        updates['password'] = make_password(pw)

    db.collection('users').document(username).update(updates)

    return Response({
        'success': True,
        'message': 'Empleado actualizado correctamente',
        'user': {
            'username':      username,
            'full_name':     full_name,
            'document_type': document_type,
            'cedula':        cedula,
            'email':         email,
            'phone':         phone,
            'cargo':         'Empleado',
            'entidad':       'EPS',
            'sede':          sede,
            'is_active':     emp.get('is_active', True)
        }
    })


@csrf_exempt
@api_view(['POST'])
@jwt_required
@role_required('admin')
def deactivate_employee(request, username):
    emp = _fs_get_user(username)
    if not emp or emp.get('role') != 'employee':
        return Response({'success': False, 'message': 'Empleado no encontrado'}, status=404)
    db.collection('users').document(username).update({'is_active': False, 'updated_at': timezone.now().isoformat()})
    return Response({'success': True, 'message': f'Empleado {username} desactivado correctamente'})


@csrf_exempt
@api_view(['POST'])
@jwt_required
@role_required('admin', 'employee')
def toggle_user_active(request, username):
    token   = get_token_from_request(request)
    payload = decode_access_token(token) if token else None
    c_role  = (payload.get('role') or '') if payload else ''

    u = _fs_get_user(username)
    if not u:
        return Response({'success': False, 'message': 'Usuario no encontrado'}, status=404)
    if c_role == 'employee' and u.get('role') != 'client':
        return Response({'success': False, 'message': 'Sin permiso'}, status=403)

    new_active = not u.get('is_active', True)
    db.collection('users').document(username).update({'is_active': new_active, 'updated_at': timezone.now().isoformat()})
    state = 'activado' if new_active else 'desactivado'
    return Response({'success': True, 'message': f'Usuario {username} {state} correctamente', 'is_active': new_active})


@csrf_exempt
@api_view(['GET'])
@jwt_required
@role_required('admin')
def get_employees(request):
    all_users = _fs_all_users()
    emps = sorted([u for u in all_users if u.get('role') == 'employee'], key=lambda u: u.get('created_at', ''))
    data = [{
        'username':      e.get('username', ''),
        'full_name':     e.get('full_name', ''),
        'email':         e.get('email', ''),
        'phone':         e.get('phone', ''),
        'cedula':        e.get('cedula', ''),
        'document_type': e.get('document_type', ''),
        'cargo':         e.get('cargo', ''),
        'entidad':       e.get('entidad', ''),
        'sede':          e.get('sede', ''),
        'is_active':     e.get('is_active', True),
    } for e in emps]
    return Response({'employees': data})


@csrf_exempt
@api_view(['GET'])
@jwt_required
@role_required('admin')
def get_admin_statistics(request):
    today_str = date.today().isoformat()
    all_users = _fs_all_users()
    all_turns = _fs_all_turns()

    today_turns  = [t for t in all_turns if t.get('created_at', '').startswith(today_str)]
    service_types = ['general', 'preferential', 'emergency', 'vip', 'virtual']

    # Avg attention time (Python-side)
    finished = [
        t for t in all_turns
        if t.get('status') == 'finished' and t.get('created_at') and t.get('finished_at')
    ]
    avg_mins = 0
    if finished:
        try:
            total_secs = sum(
                (datetime.fromisoformat(t['finished_at']) - datetime.fromisoformat(t['created_at'])).total_seconds()
                for t in finished
            )
            avg_mins = round(total_secs / len(finished) / 60, 1)
        except Exception:
            pass

    # Peak hours today
    hour_counter = Counter()
    for t in today_turns:
        try:
            hour_counter[datetime.fromisoformat(t['created_at']).hour] += 1
        except Exception:
            pass
    peak_hours = [{'hour': str(h).zfill(2) + ':00', 'count': c} for h, c in hour_counter.most_common(5)]

    svc_counter = Counter(t.get('service_type', '') for t in today_turns)
    top_services = [{'service_type': s, 'count': c} for s, c in svc_counter.most_common(5)]

    ent_counter = Counter(u.get('entidad', '') for u in all_users if u.get('role') == 'client' and u.get('entidad'))
    top_entities = [{'entidad': e, 'count': c} for e, c in ent_counter.most_common(5)]

    return Response({
        'total_users':       len(all_users),
        'total_clients':     sum(1 for u in all_users if u.get('role') == 'client'),
        'total_employees':   sum(1 for u in all_users if u.get('role') == 'employee'),
        'turns_today':       len(today_turns),
        'turns_active':      sum(1 for t in all_turns if t.get('status') == 'called'),
        'turns_attended':    sum(1 for t in today_turns if t.get('status') == 'finished'),
        'turns_cancelled':   sum(1 for t in today_turns if t.get('status') == 'cancelled'),
        'turns_presenciales':sum(1 for t in today_turns if t.get('service_type') != 'virtual'),
        'turns_virtuales':   sum(1 for t in today_turns if t.get('service_type') == 'virtual'),
        'avg_attention_time':avg_mins,
        'avg_wait_time':     0,
        'peak_hours':        peak_hours,
        'top_services':      top_services,
        'top_entities':      top_entities,
        'pending_documents': 0,
        'approved_documents':0,
        'rejected_documents':0,
        'service_stats':     {st: sum(1 for t in today_turns if t.get('service_type') == st) for st in service_types}
    })


# ─── Turns ───────────────────────────────────────────────────────────────────

@csrf_exempt
@api_view(['GET'])
def get_my_active_turn(request):
    token    = get_token_from_request(request)
    payload  = decode_access_token(token) if token else None
    username = (payload.get('username') or '') if payload else ''
    if not username or not db:
        return Response({'turn': None})

    all_turns = _fs_all_turns()
    active = [t for t in all_turns if t.get('created_by') == username and t.get('status') in ('waiting', 'called')]
    if not active:
        return Response({'turn': None})
    active.sort(key=lambda t: t.get('created_at', ''), reverse=True)
    t = active[0]
    return Response({'turn': {
        'id':           t.get('_doc_id', ''),
        'number':       t.get('number', ''),
        'status':       t.get('status', ''),
        'service_type': t.get('service_type', ''),
        'sede':         t.get('sede', ''),
        'created_at':   _fmt_datetime(t.get('created_at', '')),
    }})


@csrf_exempt
@api_view(['POST'])
def create_turn(request):
    if not db:
        return Response({'error': 'Servicio no disponible'}, status=503)

    service_type = request.data.get('service_type', 'general')
    sede         = request.data.get('sede', 'MOSQUERA')
    token        = get_token_from_request(request)
    payload      = decode_access_token(token) if token else None
    user_name    = (payload.get('username') or '') if payload else ''

    # Prevent duplicate active turns
    if user_name:
        all_turns = _fs_all_turns()
        existing = next(
            (t for t in all_turns if t.get('created_by') == user_name and t.get('status') in ('waiting', 'called')),
            None
        )
        if existing:
            return Response({
                'error':           'Ya tienes un turno activo',
                'existing_number': existing.get('number', ''),
                'existing_sede':   existing.get('sede', '')
            }, status=400)

    prefix = get_turn_prefix(service_type)
    number = generate_turn_fb(prefix, sede)

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

    db.collection('turns').add({
        'number':        number,
        'status':        'waiting',
        'service_type':  service_type,
        'sede':          sede,
        'client_data':   client_data,
        'created_by':    user_name,
        'called_by':     '',
        'created_at':    timezone.now().isoformat(),
        'finished_at':   '',
        'scheduled_for': '',
    })
    broadcast_turn_update()
    return Response({'number': number})


@csrf_exempt
@api_view(['POST'])
@jwt_required
@role_required('admin', 'employee')
def call_next(request):
    if not db:
        return Response({'message': 'Servicio no disponible'}, status=503)

    service_type  = request.data.get('service_type', '')
    token         = get_token_from_request(request)
    payload       = decode_access_token(token) if token else None
    called_by     = (payload.get('username') or '') if payload else ''
    calling_role  = (payload.get('role')     or '') if payload else ''
    employee_sede = _get_employee_sede(called_by, calling_role)

    all_turns = _fs_all_turns()
    waiting = [t for t in all_turns if t.get('status') == 'waiting']
    if employee_sede:
        waiting = [t for t in waiting if t.get('sede') == employee_sede]
    if service_type:
        waiting = [t for t in waiting if t.get('service_type') == service_type]
    waiting.sort(key=lambda t: t.get('created_at', ''))

    if not waiting:
        return Response({'message': 'No turns waiting'}, status=200)

    turn = waiting[0]
    db.collection('turns').document(turn['_doc_id']).update({
        'status':    'called',
        'called_by': called_by,
        'called_at': timezone.now().isoformat()
    })
    broadcast_turn_update()
    return Response({'number': turn.get('number')})


@csrf_exempt
@api_view(['GET'])
@jwt_required
@role_required('admin', 'employee')
def get_all_turns(request):
    token    = get_token_from_request(request)
    payload  = decode_access_token(token) if token else None
    username = (payload.get('username') or '') if payload else ''
    role     = (payload.get('role')     or '') if payload else ''
    sede     = _get_employee_sede(username, role)

    all_turns = _fs_all_turns()
    if sede:
        all_turns = [t for t in all_turns if t.get('sede') == sede]
    all_turns.sort(key=lambda t: t.get('created_at', ''), reverse=True)

    return Response({'turns': [{
        'id':           t.get('_doc_id', ''),
        'number':       t.get('number', ''),
        'status':       t.get('status', ''),
        'service_type': t.get('service_type', ''),
        'sede':         t.get('sede', ''),
        'created_at':   _fmt_time(t.get('created_at', '')),
        'called_by':    t.get('called_by', ''),
        'created_by':   t.get('created_by', ''),
        'scheduled_for':_fmt_datetime(t.get('scheduled_for', ''))
    } for t in all_turns]})


@csrf_exempt
@api_view(['GET'])
def get_current_turn(request):
    if not db:
        return Response({'number': None})
    all_turns = _fs_all_turns()
    called = sorted([t for t in all_turns if t.get('status') == 'called'], key=lambda t: t.get('created_at', ''), reverse=True)
    if called:
        return Response({'number': called[0].get('number'), 'service_type': called[0].get('service_type')})
    return Response({'number': None})


@csrf_exempt
@api_view(['GET'])
@jwt_required
@role_required('admin', 'employee')
def get_waiting_turns(request):
    service_type = request.GET.get('service_type', 'general')
    if not db:
        return Response({'turns': []})
    all_turns = _fs_all_turns()
    waiting = sorted(
        [t for t in all_turns if t.get('status') == 'waiting' and t.get('service_type') == service_type],
        key=lambda t: t.get('created_at', '')
    )
    return Response({'turns': [{'number': t.get('number'), 'service_type': t.get('service_type')} for t in waiting]})


@csrf_exempt
@api_view(['GET'])
def get_next_turn(request):
    service_type = request.GET.get('service_type', 'general')
    if not db:
        return Response({'number': None})
    all_turns = _fs_all_turns()
    waiting = sorted(
        [t for t in all_turns if t.get('status') == 'waiting' and t.get('service_type') == service_type],
        key=lambda t: t.get('created_at', '')
    )
    return Response({'number': waiting[0].get('number') if waiting else None})


@csrf_exempt
@api_view(['POST'])
def finish_current_turn(request):
    token    = get_token_from_request(request)
    payload  = decode_access_token(token) if token else None
    done_by  = (payload.get('username') or '') if payload else ''
    role     = (payload.get('role')     or '') if payload else ''
    sede     = _get_employee_sede(done_by, role)

    if not db:
        return Response({'message': 'Servicio no disponible'}, status=503)

    all_turns = _fs_all_turns()
    called = [t for t in all_turns if t.get('status') == 'called']
    if sede:
        called = [t for t in called if t.get('sede') == sede]
    called.sort(key=lambda t: t.get('created_at', ''), reverse=True)
    if not called:
        return Response({'message': 'No turn in progress'}, status=200)

    turn = called[0]
    db.collection('turns').document(turn['_doc_id']).update({
        'status':      'finished',
        'finished_at': timezone.now().isoformat(),
        'finished_by': done_by
    })
    broadcast_turn_update()
    return Response({'number': turn.get('number')})


@csrf_exempt
@api_view(['POST'])
@jwt_required
@role_required('admin', 'employee')
def call_specific_turn(request):
    turn_number   = request.data.get('turn_number', '')
    token         = get_token_from_request(request)
    payload       = decode_access_token(token) if token else None
    called_by     = (payload.get('username') or '') if payload else ''
    calling_role  = (payload.get('role')     or '') if payload else ''
    employee_sede = _get_employee_sede(called_by, calling_role)

    if not db:
        return Response({'success': False, 'message': 'Servicio no disponible'}, status=503)

    all_turns = _fs_all_turns()
    candidates = [t for t in all_turns if t.get('number') == turn_number and t.get('status') == 'waiting']
    if employee_sede:
        candidates = [t for t in candidates if t.get('sede') == employee_sede]
    if not candidates:
        return Response({'success': False, 'message': 'Turn not found'}, status=404)

    turn = candidates[0]
    db.collection('turns').document(turn['_doc_id']).update({
        'status':    'called',
        'called_by': called_by,
        'called_at': timezone.now().isoformat()
    })
    broadcast_turn_update()
    return Response({'success': True, 'number': turn.get('number')})


@csrf_exempt
@api_view(['POST'])
def reschedule_current(request):
    token    = get_token_from_request(request)
    payload  = decode_access_token(token) if token else None
    username = (payload.get('username') or '') if payload else ''
    role     = (payload.get('role')     or '') if payload else ''
    sede     = _get_employee_sede(username, role)

    if not db:
        return Response({'success': False, 'message': 'Servicio no disponible'}, status=503)

    all_turns = _fs_all_turns()
    called = [t for t in all_turns if t.get('status') == 'called']
    if sede:
        called = [t for t in called if t.get('sede') == sede]
    called.sort(key=lambda t: t.get('created_at', ''), reverse=True)
    if not called:
        return Response({'success': False, 'message': 'No hay turno en progreso'}, status=404)

    turn = called[0]
    db.collection('turns').document(turn['_doc_id']).update({
        'status':         'waiting',
        'called_by':      '',
        'rescheduled_at': timezone.now().isoformat()
    })
    broadcast_turn_update()
    return Response({'success': True, 'number': turn.get('number')})


@csrf_exempt
@api_view(['POST'])
@jwt_required
@role_required('admin', 'employee')
def cancel_current(request):
    token    = get_token_from_request(request)
    payload  = decode_access_token(token) if token else None
    username = (payload.get('username') or '') if payload else ''
    role     = (payload.get('role')     or '') if payload else ''
    sede     = _get_employee_sede(username, role)

    if not db:
        return Response({'success': False, 'message': 'Servicio no disponible'}, status=503)

    all_turns = _fs_all_turns()
    called = [t for t in all_turns if t.get('status') == 'called']
    if sede:
        called = [t for t in called if t.get('sede') == sede]
    called.sort(key=lambda t: t.get('created_at', ''), reverse=True)
    if not called:
        return Response({'success': False, 'message': 'No hay turno en progreso'}, status=404)

    turn = called[0]
    db.collection('turns').document(turn['_doc_id']).update({
        'status':       'cancelled',
        'cancelled_at': timezone.now().isoformat(),
        'cancelled_by': username
    })
    broadcast_turn_update()
    return Response({'success': True, 'message': 'Turno cancelado'})


@csrf_exempt
@api_view(['PUT'])
@jwt_required
@role_required('admin', 'employee')
def reschedule_turn(request, turn_number):
    if not db:
        return Response({'success': False, 'message': 'Servicio no disponible'}, status=503)

    all_turns = _fs_all_turns()
    matches = [t for t in all_turns if t.get('number') == turn_number]
    if not matches:
        return Response({'success': False, 'message': 'Turno no encontrado'}, status=404)

    scheduled_date_str = request.data.get('scheduled_date', '')
    db.collection('turns').document(matches[0]['_doc_id']).update({
        'status':          'waiting',
        'called_by':       '',
        'scheduled_for':   scheduled_date_str,
        'rescheduled_at':  timezone.now().isoformat()
    })
    broadcast_turn_update()
    return Response({'success': True, 'message': 'Turno reagendado', 'scheduled_for': scheduled_date_str})


@csrf_exempt
@api_view(['GET'])
def get_user_position(request):
    turn_number = request.GET.get('turn_number', '')
    if not turn_number or not db:
        return Response({'position': None, 'turns_ahead': 0, 'status': None})

    all_turns = _fs_all_turns()
    waiting   = sorted([t for t in all_turns if t.get('status') == 'waiting'], key=lambda t: t.get('created_at', ''))
    position  = next((i + 1 for i, t in enumerate(waiting) if t.get('number') == turn_number), None)
    turn_doc  = next((t for t in all_turns if t.get('number') == turn_number), None)
    return Response({
        'position':    position,
        'turns_ahead': max(0, position - 1) if position else 0,
        'status':      turn_doc.get('status') if turn_doc else None
    })


@csrf_exempt
@api_view(['POST'])
def complete_turn(request):
    turn_number = request.data.get('turn_number', '')
    token       = get_token_from_request(request)
    payload     = decode_access_token(token) if token else None
    done_by     = payload.get('username', '') if payload else ''

    if not db or not turn_number:
        return Response({'message': 'Turn not found'}, status=404)

    all_turns = _fs_all_turns()
    matches   = [t for t in all_turns if t.get('number') == turn_number]
    if not matches:
        return Response({'message': 'Turn not found'}, status=404)

    db.collection('turns').document(matches[0]['_doc_id']).update({
        'status':      'finished',
        'finished_at': timezone.now().isoformat(),
        'finished_by': done_by
    })
    broadcast_turn_update()
    return Response({'number': matches[0].get('number')})


@csrf_exempt
@api_view(['DELETE'])
def cancel_turn(request, turn_number):
    token     = get_token_from_request(request)
    payload   = decode_access_token(token) if token else None
    c_by      = payload.get('username', '') if payload else ''

    if db:
        all_turns = _fs_all_turns()
        for t in [x for x in all_turns if x.get('number') == turn_number]:
            db.collection('turns').document(t['_doc_id']).update({
                'status':       'cancelled',
                'cancelled_by': c_by,
                'cancelled_at': timezone.now().isoformat()
            })
        broadcast_turn_update()
    return Response({'success': True})


@csrf_exempt
@api_view(['DELETE'])
def cancel_turn_by_id(request, turn_id):
    token    = get_token_from_request(request)
    payload  = decode_access_token(token) if token else None
    username = (payload.get('username') or '') if payload else ''

    if not db:
        return Response({'error': 'Servicio no disponible'}, status=503)

    doc = db.collection('turns').document(str(turn_id)).get()
    if not doc.exists:
        return Response({'error': 'Turno no encontrado o no se puede cancelar'}, status=404)

    t = doc.to_dict() or {}
    if t.get('created_by') != username or t.get('status') != 'waiting':
        return Response({'error': 'Turno no encontrado o no se puede cancelar'}, status=404)

    db.collection('turns').document(str(turn_id)).update({
        'status':       'cancelled',
        'finished_at':  timezone.now().isoformat(),
        'cancelled_by': username
    })
    broadcast_turn_update()
    return Response({'success': True})


@csrf_exempt
@api_view(['POST'])
def reset_turns(request):
    if db:
        for doc in db.collection('turns').stream():
            doc.reference.delete()
        broadcast_turn_update()
    return Response({'success': True, 'message': 'Turnos eliminados'})


@csrf_exempt
@api_view(['GET'])
def get_statistics(request):
    if not db:
        return Response({'total': 0, 'waiting': 0, 'called': 0, 'finished': 0, 'cancelled': 0})
    all_turns = _fs_all_turns()
    return Response({
        'total':     len(all_turns),
        'waiting':   sum(1 for t in all_turns if t.get('status') == 'waiting'),
        'called':    sum(1 for t in all_turns if t.get('status') == 'called'),
        'finished':  sum(1 for t in all_turns if t.get('status') == 'finished'),
        'cancelled': sum(1 for t in all_turns if t.get('status') == 'cancelled'),
    })


@csrf_exempt
@api_view(['GET'])
def get_reports(request):
    return Response({'hourly_stats': {str(i): 0 for i in range(24)}})


@csrf_exempt
@api_view(['GET'])
def export_csv(request):
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(['number', 'status', 'service_type', 'created_at'])
    if db:
        for doc in db.collection('turns').stream():
            t = doc.to_dict()
            if t:
                writer.writerow([t.get('number'), t.get('status'), t.get('service_type'), t.get('created_at')])
    response = HttpResponse(output.getvalue(), content_type='text/csv')
    response['Content-Disposition'] = 'attachment; filename="turns.csv"'
    return response


@csrf_exempt
@api_view(['GET'])
def export_excel(request):
    # Return CSV (avoids pandas/openpyxl dependency)
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(['number', 'status', 'service_type', 'created_at'])
    if db:
        for doc in db.collection('turns').stream():
            t = doc.to_dict()
            if t:
                writer.writerow([t.get('number'), t.get('status'), t.get('service_type'), t.get('created_at')])
    response = HttpResponse(output.getvalue(), content_type='text/csv')
    response['Content-Disposition'] = 'attachment; filename="turns.csv"'
    return response


@csrf_exempt
@api_view(['POST'])
def set_required_documents(request):
    required = request.data.get('required_documents', [])
    if db:
        db.collection('config').document('documents').set({'required': required}, merge=True)
    return Response({'success': True})


@csrf_exempt
@api_view(['POST'])
def upload_document(request):
    turn_number  = request.data.get('turn_number', '')
    document_url = request.data.get('document_url', '')
    if not db or not turn_number:
        return Response({'success': False, 'message': 'Turn not found'}, status=404)
    all_turns = _fs_all_turns()
    matches = [t for t in all_turns if t.get('number') == turn_number]
    if not matches:
        return Response({'success': False, 'message': 'Turn not found'}, status=404)
    db.collection('turns').document(matches[0]['_doc_id']).update({'uploaded_documents': document_url})
    return Response({'success': True})


@csrf_exempt
@api_view(['GET'])
def my_turns(request):
    token    = get_token_from_request(request)
    payload  = decode_access_token(token) if token else None
    username = payload.get('username', '') if payload else ''

    if not username or not db:
        return Response({'turns': []})

    all_turns  = _fs_all_turns()
    user_turns = sorted(
        [t for t in all_turns if t.get('created_by') == username],
        key=lambda t: t.get('created_at', ''),
        reverse=True
    )

    return Response({'turns': [{
        'id':           t.get('_doc_id', ''),
        'number':       t.get('number', ''),
        'status':       t.get('status', ''),
        'service_type': t.get('service_type', ''),
        'sede':         t.get('sede', '') or 'N/A',
        'created_at':   _fmt_datetime(t.get('created_at', '')),
        'finished_at':  _fmt_datetime(t.get('finished_at', '')) or None,
        'scheduled_for':_fmt_datetime(t.get('scheduled_for', '')) or None,
    } for t in user_turns]})


# ─── Sedes ───────────────────────────────────────────────────────────────────

@csrf_exempt
@api_view(['GET'])
def get_sedes(request):
    if not db:
        return Response({'sedes': []})
    sedes = []
    for doc in db.collection('sedes').stream():
        d = doc.to_dict()
        if d and d.get('is_active', True):
            sedes.append({'id': doc.id, 'name': d.get('name', ''), 'city': d.get('city', ''), 'address': d.get('address', ''), 'is_active': True})
    sedes.sort(key=lambda s: s.get('name', ''))
    return Response({'sedes': sedes})


@csrf_exempt
@api_view(['POST'])
@jwt_required
@role_required('admin')
def create_sede(request):
    name    = request.data.get('name',    '').strip()
    city    = request.data.get('city',    '').strip()
    address = request.data.get('address', '').strip()

    if not name:
        return Response({'success': False, 'message': 'El nombre de la sede es requerido'}, status=400)
    if not db:
        return Response({'success': False, 'message': 'Servicio no disponible'}, status=503)

    for doc in db.collection('sedes').stream():
        d = doc.to_dict() or {}
        if d.get('name', '').lower() == name.lower() and d.get('is_active', True):
            return Response({'success': False, 'message': 'Ya existe una sede con ese nombre'}, status=409)

    now_iso = timezone.now().isoformat()
    _, doc_ref = db.collection('sedes').add({'name': name, 'city': city, 'address': address, 'is_active': True, 'created_at': now_iso, 'updated_at': now_iso})
    return Response({'success': True, 'message': 'Sede creada correctamente', 'sede': {'id': doc_ref.id, 'name': name, 'city': city, 'address': address}})


@csrf_exempt
@api_view(['POST'])
@jwt_required
@role_required('admin')
def update_sede(request, sede_id):
    if not db:
        return Response({'success': False, 'message': 'Servicio no disponible'}, status=503)

    doc = db.collection('sedes').document(str(sede_id)).get()
    if not doc.exists:
        return Response({'success': False, 'message': 'Sede no encontrada'}, status=404)

    current = doc.to_dict() or {}
    name    = request.data.get('name',    current.get('name', '')).strip()
    city    = request.data.get('city',    current.get('city', '')).strip()
    address = request.data.get('address', current.get('address', '')).strip()

    for d in db.collection('sedes').stream():
        dd = d.to_dict() or {}
        if d.id != str(sede_id) and dd.get('name', '').lower() == name.lower() and dd.get('is_active', True):
            return Response({'success': False, 'message': 'Ya existe una sede con ese nombre'}, status=409)

    db.collection('sedes').document(str(sede_id)).update({'name': name, 'city': city, 'address': address, 'updated_at': timezone.now().isoformat()})
    return Response({'success': True, 'message': 'Sede actualizada correctamente', 'sede': {'id': sede_id, 'name': name, 'city': city, 'address': address}})


@csrf_exempt
@api_view(['DELETE'])
@jwt_required
@role_required('admin')
def delete_sede(request, sede_id):
    if not db:
        return Response({'success': False, 'message': 'Servicio no disponible'}, status=503)

    doc = db.collection('sedes').document(str(sede_id)).get()
    if not doc.exists:
        return Response({'success': False, 'message': 'Sede no encontrada'}, status=404)

    name = (doc.to_dict() or {}).get('name', str(sede_id))
    db.collection('sedes').document(str(sede_id)).update({'is_active': False, 'updated_at': timezone.now().isoformat()})
    return Response({'success': True, 'message': f'Sede {name} eliminada correctamente'})
