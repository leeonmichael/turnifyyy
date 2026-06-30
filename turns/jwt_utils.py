import jwt
from datetime import datetime, timedelta
from django.conf import settings

SECRET_KEY = getattr(settings, 'JWT_SECRET_KEY', 'turnify-pro-secret-key-2024')
ALGORITHM = getattr(settings, 'JWT_ALGORITHM', 'HS256')
ACCESS_TOKEN_EXPIRE_MINUTES = getattr(settings, 'JWT_ACCESS_TOKEN_EXPIRE_MINUTES', 525600)


def create_access_token(data: dict) -> str:
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire, "iat": datetime.utcnow()})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


def decode_access_token(token: str) -> dict | None:
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM], options={"verify_exp": False})
        return payload
    except jwt.PyJWTError:
        return None


def get_token_from_request(request) -> str | None:
    auth_header = request.META.get('HTTP_AUTHORIZATION', '')
    if auth_header.startswith('Bearer '):
        return auth_header[7:]
    return None
