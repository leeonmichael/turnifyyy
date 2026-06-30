from django.shortcuts import render, redirect
from django.views.decorators.csrf import csrf_exempt
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework import status
from django.db.models import Count, Avg, F, ExpressionWrapper, DurationField, Sum
from django.db.models.functions import ExtractHour
from .models import Turn, Register, Sede, Sede
from .utils import generate_turn, get_turn_prefix
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
from datetime import timedelta, date
import pandas as pd
from django.contrib.auth.hashers import make_password, check_password
import json


def home(request):
    return render(request, "index.html")


def employee(request):
    return render(request, "index.html")


def screen(request):
    return render(request, "index.html")


def dashboard(request):
    return render(request, "index.html")


def register_page(request):
    return render(request, "index.html")


def login_page(request):
    return render(request, "index.html")


def logout_page(request):
    response = redirect('/login/')
    response.delete_cookie('turnify_token')
    return response


def validate_email(email: str) -> bool:
    pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
    return re.match(pattern, email) is not None


def validate_numeric(value: str, min_length: int) -> tuple[bool, str]:
    if not value.isdigit():
        return False, f"Debe contener solo números"
    if len(value) < min_length:
        return False, f"Debe tener mínimo {min_length} dígitos"
    return True, ""


@csrf_exempt
@api_view(['POST'])
@permission_classes([AllowAny])
def register_user(request):
    username = request.data.get('username', '').strip()
    password = request.data.get('password', '').strip()
    confirm_password = request.data.get('confirm_password', '').strip()
    full_name = request.data.get('full_name', '').strip()
    document_type = request.data.get('document_type', 'CC').strip()
    cedula = request.data.get('cedula', '').strip()
    email = request.data.get('email', '').strip()
    phone = request.data.get('phone', '').strip()
    accept_terms = request.data.get('accept_terms', False)

    if not username:
        return Response({'success': False, 'field': 'username', 'message': 'El nombre de usuario es requerido'}, status=status.HTTP_400_BAD_REQUEST)
    if len(username) < 3:
        return Response({'success': False, 'field': 'username', 'message': 'El usuario debe tener mínimo 3 caracteres'}, status=status.HTTP_400_BAD_REQUEST)
    if Register.objects.filter(username=username).exists():
        return Response({'success': False, 'field': 'username', 'message': 'El nombre de usuario ya está registrado'}, status=status.HTTP_409_CONFLICT)

    if not password:
        return Response({'success': False, 'field': 'password', 'message': 'La contraseña es requerida'}, status=status.HTTP_400_BAD_REQUEST)
    if len(password) < 4:
        return Response({'success': False, 'field': 'password', 'message': 'La contraseña debe tener mínimo 4 caracteres'}, status=status.HTTP_400_BAD_REQUEST)

    if not confirm_password:
        return Response({'success': False, 'field': 'confirm_password', 'message': 'Confirme su contraseña'}, status=status.HTTP_400_BAD_REQUEST)
    if password != confirm_password:
        return Response({'success': False, 'field': 'confirm_password', 'message': 'Las contraseñas no coinciden'}, status=status.HTTP_400_BAD_REQUEST)

    if not full_name:
        return Response({'success': False, 'field': 'full_name', 'message': 'El nombre completo es requerido'}, status=status.HTTP_400_BAD_REQUEST)

    if not cedula:
        return Response({'success': False, 'field': 'cedula', 'message': 'El número de documento es requerido'}, status=status.HTTP_400_BAD_REQUEST)
    valid, msg = validate_numeric(cedula, 10)
    if not valid:
        return Response({'success': False, 'field': 'cedula', 'message': msg}, status=status.HTTP_400_BAD_REQUEST)
    if Register.objects.filter(cedula=cedula).exists():
        return Response({'success': False, 'field': 'cedula', 'message': 'Este documento ya está registrado'}, status=status.HTTP_409_CONFLICT)

    if not email:
        return Response({'success': False, 'field': 'email', 'message': 'El correo electrónico es requerido'}, status=status.HTTP_400_BAD_REQUEST)
    if not validate_email(email):
        return Response({'success': False, 'field': 'email', 'message': 'Ingrese un correo electrónico válido'}, status=status.HTTP_400_BAD_REQUEST)
    if Register.objects.filter(email=email).exists():
        return Response({'success': False, 'field': 'email', 'message': 'Este correo ya está registrado'}, status=status.HTTP_409_CONFLICT)

    if not phone:
        return Response({'success': False, 'field': 'phone', 'message': 'El teléfono es requerido'}, status=status.HTTP_400_BAD_REQUEST)
    valid, msg = validate_numeric(phone, 10)
    if not valid:
        return Response({'success': False, 'field': 'phone', 'message': msg}, status=status.HTTP_400_BAD_REQUEST)

    if not accept_terms:
        return Response({'success': False, 'field': 'accept_terms', 'message': 'Debe aceptar términos y condiciones'}, status=status.HTTP_400_BAD_REQUEST)

    hashed_password = make_password(password)
    user = Register.objects.create(
        username=username,
        password=hashed_password,
        full_name=full_name,
        document_type=document_type,
        cedula=cedula,
        email=email,
        phone=phone,
        role='client'
    )

    if db:
        try:
            db.collection("users").document(username).set({
                'username': username,
                'full_name': full_name,
                'cedula': cedula,
                'email': email,
                'phone': phone,
                'role': 'client',
                'is_active': True,
                'created_at': timezone.now().isoformat(),
                'updated_at': timezone.now().isoformat()
            })
        except Exception:
            pass

    token = create_access_token({
        'username': user.username,
        'role': user.role,
        'cedula': user.cedula,
        'email': user.email,
        'full_name': user.full_name
    })

    return Response({
        'success': True,
        'message': 'Usuario registrado correctamente',
        'token': token,
        'user': {
            'username': user.username,
            'role': user.role,
            'cedula': user.cedula,
            'email': user.email,
            'full_name': user.full_name
        }
    })


@csrf_exempt
@api_view(['POST'])
@permission_classes([AllowAny])
def login_user(request):
    identifier = request.data.get('username', '').strip()
    password = request.data.get('password', '').strip()

    if not identifier:
        return Response({'success': False, 'field': 'username', 'message': 'Ingrese usuario o correo electrónico'}, status=status.HTTP_400_BAD_REQUEST)
    if not password:
        return Response({'success': False, 'field': 'password', 'message': 'Ingrese su contraseña'}, status=status.HTTP_400_BAD_REQUEST)

    register = Register.objects.filter(username=identifier).first()
    if not register:
        register = Register.objects.filter(email=identifier).first()
    if not register:
        return Response({'success': False, 'field': 'username', 'message': 'Credenciales inválidas'}, status=status.HTTP_401_UNAUTHORIZED)

    if not check_password(password, register.password):
        return Response({'success': False, 'field': 'password', 'message': 'Credenciales inválidas'}, status=status.HTTP_401_UNAUTHORIZED)

    if not register.is_active:
        return Response({'success': False, 'field': 'username', 'message': 'Cuenta desactivada. Contacte al administrador'}, status=status.HTTP_401_UNAUTHORIZED)

    token = create_access_token({
        'username': register.username,
        'role': register.role,
        'cedula': register.cedula,
        'email': register.email,
        'full_name': register.full_name
    })

    if db:
        try:
            db.collection("users").document(register.username).update({
                'last_login': timezone.now().isoformat(),
                'role': register.role
            })
        except Exception:
            pass

    if register.role == 'client':
        redirect_url = '/home/'
    elif register.role == 'admin':
        redirect_url = '/dashboard/'
    else:
        redirect_url = '/employee/'

    return Response({
        'success': True,
        'token': token,
        'redirect_url': redirect_url,
        'user': {
            'username': register.username,
            'role': register.role,
            'cedula': register.cedula,
            'email': register.email,
            'full_name': register.full_name
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
    return Response({
        'authenticated': True,
        'role': payload.get('role'),
        'username': payload.get('username')
    })


@csrf_exempt
@api_view(['GET'])
def get_users(request):
    users = Register.objects.all().order_by('-created_at')
    data = [{
        'username': u.username,
        'role': u.role,
        'full_name': u.full_name or u.username,
        'email': u.email,
        'phone': u.phone,
        'cedula': u.cedula,
        'document_type': u.document_type,
        'cargo': u.cargo,
        'entidad': u.entidad,
        'sede': u.sede,
        'is_active': u.is_active,
        'created_at': u.created_at.strftime('%Y-%m-%d %H:%M:%S')
    } for u in users]
    return Response({'users': data})


@csrf_exempt
@api_view(['DELETE'])
def delete_user(request, username):
    register = Register.objects.filter(username=username).first()
    if not register:
        return Response({'success': False, 'message': 'Usuario no encontrado'}, status=status.HTTP_404_NOT_FOUND)

    username_to_delete = register.username
    register.delete()

    if db:
        try:
            db.collection("users").document(username_to_delete).delete()
        except Exception:
            pass

    return Response({'success': True, 'message': f'Usuario {username_to_delete} eliminado correctamente'})


@csrf_exempt
@api_view(['POST'])
@jwt_required
@role_required('admin')
def create_employee(request):
    username = request.data.get('username', '').strip()
    password = request.data.get('password', '').strip()
    full_name = request.data.get('full_name', '').strip()
    document_type = request.data.get('document_type', 'CC').strip()
    cedula = request.data.get('cedula', '').strip()
    email = request.data.get('email', '').strip()
    phone = request.data.get('phone', '').strip()
    cargo = 'Empleado'
    entidad = 'EPS'
    sede = request.data.get('sede', '').strip()

    if not username:
        return Response({'success': False, 'field': 'username', 'message': 'El nombre de usuario es requerido'}, status=status.HTTP_400_BAD_REQUEST)
    if len(username) < 3:
        return Response({'success': False, 'field': 'username', 'message': 'El usuario debe tener mínimo 3 caracteres'}, status=status.HTTP_409_CONFLICT)
    if Register.objects.filter(username=username).exists():
        return Response({'success': False, 'field': 'username', 'message': 'El nombre de usuario ya está registrado'}, status=status.HTTP_409_CONFLICT)

    if not password:
        return Response({'success': False, 'field': 'password', 'message': 'La contraseña es requerida'}, status=status.HTTP_400_BAD_REQUEST)
    if len(password) < 4:
        return Response({'success': False, 'field': 'password', 'message': 'La contraseña debe tener mínimo 4 caracteres'}, status=status.HTTP_400_BAD_REQUEST)

    if not full_name:
        return Response({'success': False, 'field': 'full_name', 'message': 'El nombre completo es requerido'}, status=status.HTTP_400_BAD_REQUEST)

    if document_type not in ['CC', 'CE', 'PA', 'NIT', 'PPT']:
        return Response({'success': False, 'field': 'document_type', 'message': 'Tipo de documento no válido'}, status=status.HTTP_400_BAD_REQUEST)

    if cedula:
        valid, msg = validate_numeric(cedula, 10)
        if not valid:
            return Response({'success': False, 'field': 'cedula', 'message': msg}, status=status.HTTP_400_BAD_REQUEST)
        if Register.objects.filter(cedula=cedula).exclude(username=username).exists():
            return Response({'success': False, 'field': 'cedula', 'message': 'Este documento ya está registrado'}, status=status.HTTP_409_CONFLICT)

    if email:
        if not validate_email(email):
            return Response({'success': False, 'field': 'email', 'message': 'Ingrese un correo electrónico válido'}, status=status.HTTP_400_BAD_REQUEST)
        if Register.objects.filter(email=email).exclude(username=username).exists():
            return Response({'success': False, 'field': 'email', 'message': 'Este correo ya está registrado'}, status=status.HTTP_409_CONFLICT)

    if phone:
        valid, msg = validate_numeric(phone, 10)
        if not valid:
            return Response({'success': False, 'field': 'phone', 'message': msg}, status=status.HTTP_400_BAD_REQUEST)

    hashed_password = make_password(password)
    user = Register.objects.create(
        username=username,
        password=hashed_password,
        full_name=full_name,
        document_type=document_type,
        cedula=cedula,
        email=email,
        phone=phone,
        cargo=cargo,
        entidad=entidad,
        sede=sede,
        role='employee',
        is_active=True
    )

    if db:
        try:
            db.collection("users").document(username).set({
                'username': username,
                'full_name': full_name,
                'cedula': cedula,
                'email': email,
                'phone': phone,
                'cargo': cargo,
                'entidad': entidad,
                'sede': sede,
                'role': 'employee',
                'created_at': timezone.now().isoformat(),
                'updated_at': timezone.now().isoformat()
            })
        except Exception:
            pass

    return Response({
        'success': True,
        'message': 'Empleado creado correctamente',
        'user': {
            'username': user.username,
            'role': user.role,
            'full_name': user.full_name,
            'document_type': user.document_type,
            'cedula': user.cedula,
            'email': user.email,
            'phone': user.phone,
            'cargo': user.cargo,
            'entidad': user.entidad,
            'sede': user.sede,
            'is_active': user.is_active
        }
    })


@csrf_exempt
@api_view(['POST'])
@jwt_required
@role_required('admin')
def update_employee(request, username):
    employee = Register.objects.filter(username=username, role='employee').first()
    if not employee:
        return Response({'success': False, 'message': 'Empleado no encontrado'}, status=status.HTTP_404_NOT_FOUND)

    employee.full_name = request.data.get('full_name', employee.full_name).strip()
    employee.document_type = request.data.get('document_type', employee.document_type).strip()
    employee.cedula = request.data.get('cedula', employee.cedula).strip()
    employee.email = request.data.get('email', employee.email).strip()
    employee.phone = request.data.get('phone', employee.phone).strip()
    employee.cargo = 'Empleado'
    employee.entidad = 'EPS'
    employee.sede = request.data.get('sede', employee.sede).strip()

    if 'password' in request.data and request.data['password']:
        password = request.data['password'].strip()
        if len(password) < 4:
            return Response({'success': False, 'field': 'password', 'message': 'La contraseña debe tener mínimo 4 caracteres'}, status=status.HTTP_400_BAD_REQUEST)
        employee.password = make_password(password)

    if employee.cedula and not employee.cedula.isdigit():
        return Response({'success': False, 'field': 'cedula', 'message': 'El documento debe contener solo números'}, status=status.HTTP_400_BAD_REQUEST)
    if employee.cedula and len(employee.cedula) < 10:
        return Response({'success': False, 'field': 'cedula', 'message': 'El documento debe tener mínimo 10 dígitos'}, status=status.HTTP_400_BAD_REQUEST)
    if employee.cedula and Register.objects.filter(cedula=employee.cedula).exclude(username=username).exists():
        return Response({'success': False, 'field': 'cedula', 'message': 'Este documento ya está registrado'}, status=status.HTTP_409_CONFLICT)

    if employee.email and not validate_email(employee.email):
        return Response({'success': False, 'field': 'email', 'message': 'Ingrese un correo electrónico válido'}, status=status.HTTP_400_BAD_REQUEST)
    if employee.email and Register.objects.filter(email=employee.email).exclude(username=username).exists():
        return Response({'success': False, 'field': 'email', 'message': 'Este correo ya está registrado'}, status=status.HTTP_409_CONFLICT)

    employee.save()

    if db:
        try:
            db.collection("users").document(employee.username).update({
                'full_name': employee.full_name,
                'document_type': employee.document_type,
                'cedula': employee.cedula,
                'email': employee.email,
                'phone': employee.phone,
                'cargo': employee.cargo,
                'entidad': employee.entidad,
                'sede': employee.sede,
                'role': employee.role,
                'is_active': employee.is_active,
                'updated_at': timezone.now().isoformat()
            })
        except Exception:
            pass

    return Response({
        'success': True,
        'message': 'Empleado actualizado correctamente',
        'user': {
            'username': employee.username,
            'full_name': employee.full_name,
            'document_type': employee.document_type,
            'cedula': employee.cedula,
            'email': employee.email,
            'phone': employee.phone,
            'cargo': employee.cargo,
            'entidad': employee.entidad,
            'sede': employee.sede,
            'is_active': employee.is_active
        }
    })


@csrf_exempt
@api_view(['POST'])
@jwt_required
@role_required('admin')
def deactivate_employee(request, username):
    employee = Register.objects.filter(username=username, role='employee').first()
    if not employee:
        return Response({'success': False, 'message': 'Empleado no encontrado'}, status=status.HTTP_404_NOT_FOUND)

    employee.is_active = False
    employee.save()

    if db:
        try:
            db.collection("users").document(username).update({
                'is_active': False,
                'updated_at': timezone.now().isoformat()
            })
        except Exception:
            pass

    return Response({'success': True, 'message': f'Empleado {employee.username} desactivado correctamente'})


@csrf_exempt
@api_view(['GET'])
@jwt_required
@role_required('admin')
def get_employees(request):
    employees = Register.objects.filter(role='employee').order_by('-created_at')
    data = [{
        'username': e.username,
        'full_name': e.full_name or e.username,
        'document_type': e.document_type,
        'cedula': e.cedula,
        'email': e.email,
        'phone': e.phone,
        'cargo': e.cargo,
        'entidad': e.entidad,
        'sede': e.sede,
        'is_active': e.is_active,
        'created_at': e.created_at.strftime('%Y-%m-%d %H:%M:%S') if e.created_at else ''
    } for e in employees]
    return Response({'employees': data})


@csrf_exempt
@api_view(['GET'])
@jwt_required
@role_required('admin')
def get_admin_statistics(request):
    today = date.today()
    now = timezone.now()
    
    total_users = Register.objects.count()
    total_clients = Register.objects.filter(role='client').count()
    total_employees = Register.objects.filter(role='employee').count()

    turns_today = Turn.objects.filter(created_at__date=today)
    turns_active = Turn.objects.filter(status='called').count()
    turns_attended = Turn.objects.filter(status='finished', created_at__date=today).count()
    turns_cancelled = Turn.objects.filter(status='cancelled', created_at__date=today).count()
    
    total_turns = Turn.objects.count()
    waiting_turns = Turn.objects.filter(status='waiting').count()

    turns_presenciales = turns_today.exclude(service_type='virtual').count()
    turns_virtuales = turns_today.filter(service_type='virtual').count()

    finished_turns = Turn.objects.filter(status='finished', finished_at__isnull=False)
    avg_attention_time = finished_turns.aggregate(
        avg=Avg(ExpressionWrapper(F('finished_at') - F('created_at'), output_field=DurationField()))
    )['avg']
    avg_attention_minutes = round(avg_attention_time.total_seconds() / 60, 1) if avg_attention_time else 0

    peak_hours_qs = Turn.objects.filter(created_at__date=today).annotate(
        hour=ExtractHour('created_at')
    ).values('hour').annotate(count=Count('id')).order_by('-count')[:5]
    peak_hours = [{'hour': str(p['hour']).zfill(2) + ':00', 'count': p['count']} for p in peak_hours_qs]

    top_services_qs = Turn.objects.filter(created_at__date=today).values('service_type').annotate(count=Count('id')).order_by('-count')[:5]
    top_services = [{'service_type': s['service_type'], 'count': s['count']} for s in top_services_qs]

    top_entities_qs = Register.objects.filter(role='client', entidad__gt='').values('entidad').annotate(count=Count('id')).order_by('-count')[:5]
    top_entities = [{'entidad': e['entidad'], 'count': e['count']} for e in top_entities_qs]

    total_pending_docs = Turn.objects.filter(documents_pending__gt=0).aggregate(total=Sum('documents_pending'))['total'] or 0
    total_approved_docs = Turn.objects.filter(documents_approved__gt=0).aggregate(total=Sum('documents_approved'))['total'] or 0
    total_rejected_docs = Turn.objects.filter(documents_rejected__gt=0).aggregate(total=Sum('documents_rejected'))['total'] or 0

    return Response({
        'total_users': total_users,
        'total_clients': total_clients,
        'total_employees': total_employees,
        'turns_today': turns_today.count(),
        'turns_active': turns_active,
        'turns_attended': turns_attended,
        'turns_cancelled': turns_cancelled,
        'turns_presenciales': turns_presenciales,
        'turns_virtuales': turns_virtuales,
        'avg_attention_time': avg_attention_minutes,
        'avg_wait_time': 0,
        'peak_hours': peak_hours,
        'top_services': top_services,
        'top_entities': top_entities,
        'pending_documents': total_pending_docs,
        'approved_documents': total_approved_docs,
        'rejected_documents': total_rejected_docs,
        'service_stats': {
            'general': Turn.objects.filter(service_type='general', created_at__date=today).count(),
            'preferential': Turn.objects.filter(service_type='preferential', created_at__date=today).count(),
            'emergency': Turn.objects.filter(service_type='emergency', created_at__date=today).count(),
            'vip': Turn.objects.filter(service_type='vip', created_at__date=today).count(),
            'virtual': Turn.objects.filter(service_type='virtual', created_at__date=today).count(),
        }
    })


@csrf_exempt
@api_view(['POST'])
def create_turn(request):
    service_type = request.data.get('service_type', 'general')
    sede = request.data.get('sede', 'MOSQUERA')
    token = get_token_from_request(request)
    payload = decode_access_token(token) if token else None
    user_name = payload.get('username', '') if payload else ''

    prefix = get_turn_prefix(service_type)
    number = generate_turn(prefix)

    client_data = {}
    created_by = None
    if user_name:
        client = Register.objects.filter(username=user_name).first()
        if client:
            client_data = {
                'username': user_name,
                'full_name': client.full_name,
                'cedula': client.cedula,
                'email': client.email,
                'phone': client.phone,
                'document_type': client.document_type,
                'role': client.role
            }
            created_by = user_name

    Turn.objects.create(number=number, service_type=service_type, sede=sede)

    if db:
        try:
            db.collection("turns").document(number).set({
                "number": number,
                "status": "waiting",
                "service_type": service_type,
                "sede": sede,
                "client_data": client_data,
                "created_by": created_by,
                "created_at": timezone.now().isoformat()
            })
        except Exception:
            pass

    broadcast_turn_update()
    return Response({"number": number})


def broadcast_turn_update():
    turns = Turn.objects.all().order_by('-created_at')
    turns_data = []
    for t in turns:
        called_by_name = getattr(t, 'assigned_employee', None)
        turns_data.append({
            'number': t.number,
            'status': t.status,
            'service_type': t.service_type,
            'sede': t.sede,
            'created_at': t.created_at.strftime('%H:%M') if t.created_at else '',
            'called_by': called_by_name
        })
    channel_layer = get_channel_layer()
    async_to_sync(channel_layer.group_send)('turns', {'type': 'turn_update', 'data': turns_data})


@csrf_exempt
@api_view(['POST'])
def call_next(request):
    service_type = request.data.get('service_type', '')
    token = get_token_from_request(request)
    payload = decode_access_token(token) if token else None
    called_by = payload.get('username', '') if payload else ''

    if service_type:
        turn = Turn.objects.filter(status='waiting', service_type=service_type).order_by('created_at').first()
    else:
        turn = Turn.objects.filter(status='waiting').order_by('created_at').first()
    if turn:
        turn.status = 'called'
        turn.assigned_employee = called_by
        turn.save()
        if db:
            try:
                db.collection('turns').document(turn.number).update({
                    'status': 'called',
                    'called_by': called_by,
                    'called_at': timezone.now().isoformat()
                })
            except Exception:
                pass
        broadcast_turn_update()
        return Response({'number': turn.number})
    return Response({'message': 'No turns waiting'}, status=200)


@csrf_exempt
@api_view(['GET'])
def get_all_turns(request):
    turns = Turn.objects.all().order_by('-created_at')
    turns_data = []
    for t in turns:
        called_by_name = None
        if t.status == 'called' and hasattr(t, 'assigned_employee') and t.assigned_employee:
            called_by_name = t.assigned_employee
        turns_data.append({
            'number': t.number,
            'status': t.status,
            'service_type': t.service_type,
            'sede': t.sede,
            'created_at': t.created_at.strftime('%H:%M') if t.created_at else '',
            'called_by': called_by_name
        })
    return Response({'turns': turns_data})


@csrf_exempt
@api_view(['GET'])
def get_current_turn(request):
    turn = Turn.objects.filter(status='called').order_by('-created_at').first()
    if turn:
        return Response({'number': turn.number, 'service_type': turn.service_type})
    return Response({'number': None})


@csrf_exempt
@api_view(['GET'])
def get_waiting_turns(request):
    service_type = request.GET.get('service_type', 'general')
    turns = Turn.objects.filter(status='waiting', service_type=service_type).order_by('created_at')
    turns_data = []
    for t in turns:
        turns_data.append({
            'number': t.number,
            'service_type': t.service_type
        })
    return Response({'turns': turns_data})


@csrf_exempt
@api_view(['GET'])
def get_next_turn(request):
    service_type = request.GET.get('service_type', 'general')
    turn = Turn.objects.filter(status='waiting', service_type=service_type).order_by('created_at').first()
    if turn:
        return Response({'number': turn.number})
    return Response({'number': None})


@csrf_exempt
@api_view(['POST'])
def finish_current_turn(request):
    token = get_token_from_request(request)
    payload = decode_access_token(token) if token else None
    finished_by = payload.get('username', '') if payload else ''

    turn = Turn.objects.filter(status='called').order_by('-created_at').first()
    if turn:
        turn.status = 'finished'
        turn.finished_at = timezone.now()
        turn.save()
        if db:
            try:
                db.collection('turns').document(turn.number).update({
                    'status': 'finished',
                    'finished_at': timezone.now().isoformat(),
                    'finished_by': finished_by
                })
            except Exception:
                pass
        broadcast_turn_update()
        return Response({'number': turn.number})
    return Response({'message': 'No turn in progress'}, status=200)


@csrf_exempt
@api_view(['POST'])
def call_specific_turn(request):
    turn_number = request.data.get('turn_number', '')
    token = get_token_from_request(request)
    payload = decode_access_token(token) if token else None
    called_by = payload.get('username', '') if payload else ''

    turn = Turn.objects.filter(number=turn_number).first()
    if turn:
        turn.status = 'called'
        turn.assigned_employee = called_by
        turn.save()
        if db:
            try:
                db.collection('turns').document(turn.number).update({
                    'status': 'called',
                    'called_by': called_by,
                    'called_at': timezone.now().isoformat()
                })
            except Exception:
                pass
        broadcast_turn_update()
        return Response({'success': True, 'number': turn.number})
    return Response({'success': False, 'message': 'Turn not found'}, status=404)


@csrf_exempt
@api_view(['POST'])
def reschedule_current(request):
    turn = Turn.objects.filter(status='called').order_by('-created_at').first()
    if not turn:
        return Response({'success': False, 'message': 'No hay turno en progreso'}, status=404)
    turn.status = 'waiting'
    turn.save()
    if db:
        try:
            db.collection('turns').document(turn.number).update({
                'status': 'waiting',
                'rescheduled_at': timezone.now().isoformat()
            })
        except Exception:
            pass
    broadcast_turn_update()
    return Response({'success': True, 'number': turn.number})


@csrf_exempt
@api_view(['POST'])
def cancel_current(request):
    turn = Turn.objects.filter(status='called').order_by('-created_at').first()
    if not turn:
        return Response({'success': False, 'message': 'No hay turno en progreso'}, status=404)
    turn_number = turn.number
    if db:
        try:
            db.collection('turns').document(turn_number).update({
                'status': 'cancelled',
                'cancelled_at': timezone.now().isoformat()
            })
        except Exception:
            pass
    turn.delete()
    broadcast_turn_update()
    return Response({'success': True, 'message': 'Turno cancelado'})


@csrf_exempt
@api_view(['PUT'])
def reschedule_turn(request, turn_number):
    turn = Turn.objects.filter(number=turn_number).first()
    if not turn:
        return Response({'success': False, 'message': 'Turno no encontrado'}, status=404)
    turn.status = 'waiting'
    turn.save()
    if db:
        try:
            db.collection('turns').document(turn_number).update({
                'status': 'waiting',
                'rescheduled_at': timezone.now().isoformat()
            })
        except Exception:
            pass
    broadcast_turn_update()
    return Response({'success': True, 'message': 'Turno reagendado'})


@csrf_exempt
@api_view(['GET'])
def get_user_position(request):
    turn_number = request.GET.get('turn_number', '')
    if not turn_number:
        return Response({'position': None, 'turns_ahead': 0, 'status': None})
    turns = Turn.objects.filter(status='waiting').order_by('created_at')
    position = None
    for i, t in enumerate(turns, 1):
        if t.number == turn_number:
            position = i
            break
    turn = Turn.objects.filter(number=turn_number).first()
    turn_status = turn.status if turn else None
    return Response({'position': position, 'turns_ahead': max(0, position - 1) if position else 0, 'status': turn_status})


@csrf_exempt
@api_view(['POST'])
def complete_turn(request):
    turn_number = request.data.get('turn_number', '')
    token = get_token_from_request(request)
    payload = decode_access_token(token) if token else None
    finished_by = payload.get('username', '') if payload else ''

    turn = Turn.objects.filter(number=turn_number).first()
    if turn:
        turn.status = 'finished'
        turn.finished_at = timezone.now()
        turn.save()
        if db:
            try:
                db.collection('turns').document(turn.number).update({
                    'status': 'finished',
                    'finished_at': timezone.now().isoformat(),
                    'finished_by': finished_by
                })
            except Exception:
                pass
        broadcast_turn_update()
        return Response({'number': turn.number})
    return Response({'message': 'Turn not found'}, status=404)


@csrf_exempt
@api_view(['DELETE'])
def cancel_turn(request, turn_number):
    token = get_token_from_request(request)
    payload = decode_access_token(token) if token else None
    cancelled_by = payload.get('username', '') if payload else ''

    if db:
        try:
            db.collection('turns').document(turn_number).update({
                'status': 'cancelled',
                'cancelled_by': cancelled_by,
                'cancelled_at': timezone.now().isoformat()
            })
        except Exception:
            pass
    Turn.objects.filter(number=turn_number).delete()
    broadcast_turn_update()
    return Response({'success': True})


@csrf_exempt
@api_view(['POST'])
def reset_turns(request):
    Turn.objects.all().delete()
    if db:
        try:
            turns_ref = db.collection('turns')
            for doc in turns_ref.stream():
                doc.reference.delete()
        except Exception:
            pass
    broadcast_turn_update()
    return Response({'success': True, 'message': 'Turnos eliminados'})


@csrf_exempt
@api_view(['GET'])
def get_statistics(request):
    from .statistics import get_turn_statistics
    stats = get_turn_statistics()
    return Response(stats)


@csrf_exempt
@api_view(['GET'])
def get_reports(request):
    today = date.today()
    hourly_turns = Turn.objects.filter(created_at__date=today, status='waiting').values('service_type').annotate(count=Count('id'))
    return Response({'hourly_stats': {str(i): 0 for i in range(24)}})


@csrf_exempt
@api_view(['GET'])
def export_csv(request):
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(['number', 'status', 'service_type', 'created_at'])
    for turn in Turn.objects.all().values_list('number', 'status', 'service_type', 'created_at'):
        writer.writerow(turn)
    response = HttpResponse(output.getvalue(), content_type='text/csv')
    response['Content-Disposition'] = 'attachment; filename="turns.csv"'
    return response


@csrf_exempt
@api_view(['GET'])
def export_excel(request):
    df = pd.DataFrame(list(Turn.objects.values('number', 'status', 'service_type', 'created_at')))
    output = io.BytesIO()
    with pd.ExcelWriter(output, engine='openpyxl') as writer:
        df.to_excel(writer, index=False)
    response = HttpResponse(output.getvalue(), content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    response['Content-Disposition'] = 'attachment; filename="turns.xlsx"'
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
    turn_number = request.data.get('turn_number', '')
    document_url = request.data.get('document_url', '')
    turn = Turn.objects.filter(number=turn_number).first()
    if turn:
        turn.uploaded_documents = document_url
        turn.save()
        return Response({'success': True})
    return Response({'success': False, 'message': 'Turn not found'}, status=404)


@csrf_exempt
@api_view(['GET'])
def my_turns(request):
    token = get_token_from_request(request)
    payload = decode_access_token(token) if token else None
    username = payload.get('username', '') if payload else ''
    
    if not username:
        return Response({'turns': []})
    
    turns = Turn.objects.filter(client_data__icontains=username).order_by('-created_at')
    turns_data = [{
        'number': t.number,
        'status': t.status,
        'service_type': t.service_type,
        'sede': t.sede,
        'created_at': t.created_at.strftime('%Y-%m-%d %H:%M') if t.created_at else '',
        'finished_at': t.finished_at.strftime('%Y-%m-%d %H:%M') if t.finished_at else None
    } for t in turns]
    
    return Response({'turns': turns_data})


@csrf_exempt
@api_view(['GET'])
def get_sedes(request):
    sedes = Sede.objects.filter(is_active=True).order_by('name')
    data = [{'id': s.id, 'name': s.name, 'city': s.city, 'address': s.address, 'is_active': s.is_active} for s in sedes]
    return Response({'sedes': data})

@csrf_exempt
@api_view(['POST'])
@jwt_required
@role_required('admin')
def create_sede(request):
    name = request.data.get('name', '').strip()
    city = request.data.get('city', '').strip()
    address = request.data.get('address', '').strip()
    if not name:
        return Response({'success': False, 'message': 'El nombre de la sede es requerido'}, status=status.HTTP_400_BAD_REQUEST)
    if Sede.objects.filter(name__iexact=name).exists():
        return Response({'success': False, 'message': 'Ya existe una sede con ese nombre'}, status=status.HTTP_409_CONFLICT)
    sede = Sede.objects.create(name=name, city=city, address=address)

    if db:
        try:
            db.collection("sedes").document(str(sede.id)).set({
                'id': sede.id,
                'name': sede.name,
                'city': sede.city,
                'address': sede.address,
                'is_active': True,
                'created_at': timezone.now().isoformat(),
                'updated_at': timezone.now().isoformat()
            })
        except Exception:
            pass

    return Response({'success': True, 'message': 'Sede creada correctamente', 'sede': {'id': sede.id, 'name': sede.name, 'city': sede.city, 'address': sede.address}})

@csrf_exempt
@api_view(['POST'])
@jwt_required
@role_required('admin')
def update_sede(request, sede_id):
    sede = Sede.objects.filter(id=sede_id).first()
    if not sede:
        return Response({'success': False, 'message': 'Sede no encontrada'}, status=status.HTTP_404_NOT_FOUND)
    name = request.data.get('name', sede.name).strip()
    city = request.data.get('city', sede.city).strip()
    address = request.data.get('address', sede.address).strip()
    if Sede.objects.filter(name__iexact=name).exclude(id=sede_id).exists():
        return Response({'success': False, 'message': 'Ya existe una sede con ese nombre'}, status=status.HTTP_409_CONFLICT)
    sede.name = name
    sede.city = city
    sede.address = address
    sede.save()

    if db:
        try:
            db.collection("sedes").document(str(sede.id)).update({
                'name': sede.name,
                'city': sede.city,
                'address': sede.address,
                'updated_at': timezone.now().isoformat()
            })
        except Exception:
            pass

    return Response({'success': True, 'message': 'Sede actualizada correctamente', 'sede': {'id': sede.id, 'name': sede.name, 'city': sede.city, 'address': sede.address}})

@csrf_exempt
@api_view(['DELETE'])
@jwt_required
@role_required('admin')
def delete_sede(request, sede_id):
    sede = Sede.objects.filter(id=sede_id).first()
    if not sede:
        return Response({'success': False, 'message': 'Sede no encontrada'}, status=status.HTTP_404_NOT_FOUND)
    sede.is_active = False
    sede.save()

    if db:
        try:
            db.collection("sedes").document(str(sede.id)).update({
                'is_active': False,
                'updated_at': timezone.now().isoformat()
            })
        except Exception:
            pass

    return Response({'success': True, 'message': f'Sede {sede.name} eliminada correctamente'})


@csrf_exempt
@api_view(['DELETE'])
def cancel_turn(request, turn_number):
    turn = Turn.objects.filter(number=turn_number).first()
    if not turn or turn.status in ['finished', 'completed']:
        return Response({'success': False, 'message': 'Turno no encontrado o no se puede cancelar'}, status=404)
    
    token = get_token_from_request(request)
    payload = decode_access_token(token) if token else None
    cancelled_by = payload.get('username', '') if payload else ''

    if db:
        try:
            db.collection('turns').document(turn_number).update({
                'status': 'cancelled',
                'cancelled_by': cancelled_by,
                'cancelled_at': timezone.now().isoformat()
            })
        except Exception:
            pass
    turn.delete()
    broadcast_turn_update()
    return Response({'success': True, 'message': 'Turno cancelado'})
