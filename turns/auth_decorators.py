from django.http import JsonResponse
from functools import wraps
from .jwt_utils import decode_access_token, get_token_from_request


def jwt_required(view_func):
    @wraps(view_func)
    def _wrapped_view(request, *args, **kwargs):
        token = get_token_from_request(request)
        if not token:
            return JsonResponse({'success': False, 'message': 'Token de autenticación requerido'}, status=401)
        payload = decode_access_token(token)
        if not payload:
            return JsonResponse({'success': False, 'message': 'Token inválido o expirado'}, status=401)
        request.jwt_payload = payload
        return view_func(request, *args, **kwargs)
    return _wrapped_view


def role_required(*allowed_roles):
    def decorator(view_func):
        @wraps(view_func)
        def _wrapped_view(request, *args, **kwargs):
            if not hasattr(request, 'jwt_payload'):
                return JsonResponse({'success': False, 'message': 'No autenticado'}, status=401)
            role = request.jwt_payload.get('role')
            if role not in allowed_roles:
                return JsonResponse({'success': False, 'message': 'No tiene permisos para esta acción'}, status=403)
            return view_func(request, *args, **kwargs)
        return _wrapped_view
    return decorator
