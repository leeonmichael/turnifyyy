"""
Crea una cuenta de ADMINISTRADOR de pruebas para tomar las capturas de los
casos de prueba de la web. No modifica ninguna cuenta existente.

Ejecutar desde la carpeta del proyecto (donde esta manage.py):
    python crear_admin_prueba.py

Usuario:    qa_admin_web
Contrasena: AdminPruebaWeb2026!

Cuando termines las pruebas puedes borrar este archivo y desactivar la cuenta.
"""
import os
import django

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
django.setup()

from django.utils import timezone
from django.contrib.auth.hashers import make_password
from turns.firebase_config import db

USERNAME = "qa_admin_web"
PASSWORD = "AdminPruebaWeb2026!"

ref = db.collection("users").document(USERNAME)
if ref.get().exists:
    ref.update({"password": make_password(PASSWORD), "is_active": True, "role": "admin"})
    print("Cuenta existente actualizada:", USERNAME)
else:
    ref.set({
        "username": USERNAME,
        "password": make_password(PASSWORD),
        "role": "admin",
        "full_name": "Administrador QA Web",
        "cedula": "1000000001",
        "document_type": "CC",
        "email": "qa_admin_web@correo.com",
        "phone": "3000000001",
        "entidad": "",
        "cargo": "Administrador",
        "sede_id": "",
        "is_active": True,
        "created_at": timezone.now().isoformat(),
    })
    print("Cuenta admin creada:", USERNAME)
print("Listo. Ya puedes iniciar sesion en la web con", USERNAME)
