# TODO - Ejecutar el servidor con toda la aplicación funcionando

## Paso 1: Diagnóstico (backend)
- [ ] Validar que dependencias estén instaladas (requirements.txt)
- [ ] Crear/activar venv e instalar dependencias
- [ ] Ejecutar migraciones
- [ ] Confirmar que Django levanta con ASGI/Channels

## Paso 2: Diagnóstico (frontend)
- [ ] Verificar que existe `frontend/dist/frontend/browser` con index.html (o build)
- [ ] Si no existe, ejecutar build Angular

## Paso 3: Firebase
- [ ] Confirmar si falta `firebase_key.json`; si no, asegurar que la app no crashea (db=None)

## Paso 4: Ejecutar
- [ ] Arrancar en dev: `python manage.py runserver 0.0.0.0:8000`
- [ ] Probar HTTP endpoints básicos
- [ ] Probar WebSocket `ws/turns`

## Paso 5: Ajustes si falla
- [ ] Revisar error en terminal y corregir settings/rutas/build/cors

