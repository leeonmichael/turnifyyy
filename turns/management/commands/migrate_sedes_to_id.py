from django.core.management.base import BaseCommand
from django.utils import timezone
from firebase_admin import firestore as fb_firestore

from turns.firebase_config import db


class Command(BaseCommand):
    help = (
        "Backfillea 'sede_id' en users/ y turns/ a partir del campo de texto "
        "'sede' que guardaban antes. Si el nombre no coincide con ninguna sede "
        "ya registrada en la colección 'sedes', crea una sede nueva para ese "
        "nombre (esto cubre el caso real: la colección 'sedes' nunca se usó y "
        "los nombres solo existían como texto suelto en users/turns). "
        "Idempotente: los documentos que ya tienen sede_id no se tocan."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            '--dry-run', action='store_true',
            help='Solo muestra qué se haría, sin escribir en Firestore.',
        )

    def handle(self, *args, **options):
        if not db:
            self.stderr.write(self.style.ERROR('Firestore no está disponible (revisa credenciales).'))
            return

        dry_run = options['dry_run']

        sedes_by_name = {}
        for doc in db.collection('sedes').stream():
            d = doc.to_dict() or {}
            name = (d.get('name') or '').strip().lower()
            if name:
                sedes_by_name[name] = doc.id
        self.stdout.write(f"Sedes ya registradas: {len(sedes_by_name)}")

        # Primera pasada (solo lectura): decide qué sede_id le corresponde a
        # cada doc y qué nombres nuevos hay que crear en 'sedes'.
        plan = []          # (collection, doc_ref, sede_id_or_None_if_new, display_name)
        names_to_create = {}  # lower(name) -> nombre original (primera aparición)

        for collection, is_turn in (('users', False), ('turns', True)):
            for doc in db.collection(collection).stream():
                d = doc.to_dict() or {}
                if 'sede_id' in d:
                    continue
                old_sede = (d.get('sede') or '').strip()
                if not old_sede:
                    continue
                if is_turn and (old_sede.upper() == 'VIRTUAL' or d.get('service_type') == 'virtual'):
                    plan.append((collection, doc.reference, 'VIRTUAL', old_sede))
                    continue
                key = old_sede.lower()
                if key in sedes_by_name:
                    plan.append((collection, doc.reference, sedes_by_name[key], old_sede))
                else:
                    names_to_create.setdefault(key, old_sede)
                    plan.append((collection, doc.reference, None, old_sede))

        if names_to_create:
            self.stdout.write(f"\nSedes nuevas a crear a partir de nombres existentes ({len(names_to_create)}):")
            for name in names_to_create.values():
                self.stdout.write(f"    - {name}")

        if not dry_run:
            now_iso = timezone.now().isoformat()
            for key, name in names_to_create.items():
                _, doc_ref = db.collection('sedes').add({
                    'name': name, 'city': '', 'address': '',
                    'is_active': True, 'created_at': now_iso, 'updated_at': now_iso,
                })
                sedes_by_name[key] = doc_ref.id

        counts = {'users': 0, 'turns': 0}
        for collection, doc_ref, sede_id, old_sede in plan:
            if sede_id is None:
                sede_id = sedes_by_name.get(old_sede.lower())
            counts[collection] += 1
            if not dry_run:
                doc_ref.update({'sede_id': sede_id, 'sede': fb_firestore.DELETE_FIELD})

        self.stdout.write(f"\n[users] documentos a migrar: {counts['users']}")
        self.stdout.write(f"[turns] documentos a migrar: {counts['turns']}")

        if dry_run:
            self.stdout.write(self.style.WARNING('\nDry-run: no se escribió nada. Corre sin --dry-run para aplicar.'))
        else:
            self.stdout.write(self.style.SUCCESS('\nMigración aplicada.'))
