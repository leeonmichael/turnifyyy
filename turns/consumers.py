import json
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async


class TurnConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        self.room_group_name = 'turns'
        await self.channel_layer.group_add(self.room_group_name, self.channel_name)
        await self.accept()
        await self.send_all_turns()

    async def disconnect(self, close_code):
        await self.channel_layer.group_discard(self.room_group_name, self.channel_name)

    async def receive(self, text_data):
        data   = json.loads(text_data)
        action = data.get('action')
        if action == 'get_current':
            await self.send_current_turn()
        elif action == 'get_all':
            await self.send_all_turns()
        elif action == 'get_waiting':
            await self.send_waiting_turns()
        elif action == 'get_position':
            await self.send_user_position(data.get('user_turn'))

    async def send_current_turn(self):
        turn = await self._get_current_turn()
        await self.send(text_data=json.dumps({
            'type':   'current_turn',
            'number': turn['number'] if turn else None,
            'status': turn['status'] if turn else 'none'
        }))

    async def send_all_turns(self):
        turns = await self._get_all_turns_data()
        await self.send(text_data=json.dumps({'type': 'all_turns', 'turns': turns}))

    async def send_waiting_turns(self):
        turns = await self._get_waiting_turns_data()
        await self.send(text_data=json.dumps({'type': 'waiting_turns', 'turns': turns, 'count': len(turns)}))

    async def send_user_position(self, user_turn):
        if not user_turn:
            await self.send(text_data=json.dumps({'type': 'user_position', 'position': -1, 'turns_ahead': -1, 'message': 'No turn assigned'}))
            return
        data = await self._get_position_data(user_turn)
        await self.send(text_data=json.dumps({'type': 'user_position', **data}))

    # ── Firestore helpers (wrapped as sync-in-thread for async context) ──

    @database_sync_to_async
    def _get_current_turn(self):
        from .firebase_config import db
        if not db:
            return None
        for doc in db.collection('turns').stream():
            t = doc.to_dict()
            if t and t.get('status') == 'called':
                return {'number': t.get('number'), 'status': t.get('status')}
        return None

    @database_sync_to_async
    def _get_all_turns_data(self):
        from .firebase_config import db
        from .views import _fmt_time, _fmt_datetime
        from .fs_helpers import _sedes_map, _resolve_sede_name
        if not db:
            return []
        sedes_map = _sedes_map()
        data = []
        for doc in db.collection('turns').stream():
            t = doc.to_dict()
            if not t:
                continue
            data.append({
                'id':           doc.id,
                'number':       t.get('number', ''),
                'status':       t.get('status', ''),
                'service_type': t.get('service_type', ''),
                'sede_id':      t.get('sede_id', ''),
                'sede':         _resolve_sede_name(t.get('sede_id', ''), sedes_map),
                'created_at':   _fmt_time(t.get('created_at', '')),
                'called_by':    t.get('called_by', ''),
                'created_by':   t.get('created_by', ''),
                'scheduled_for':_fmt_datetime(t.get('scheduled_for', '')),
                'meet_link':          t.get('meet_link', ''),
                'required_documents': t.get('required_documents', []),
                'uploaded_documents': t.get('uploaded_documents', []),
                'chat_messages':      t.get('chat_messages', []),
            })
        data.sort(key=lambda x: x.get('created_at', ''), reverse=True)
        return data

    @database_sync_to_async
    def _get_waiting_turns_data(self):
        from .firebase_config import db
        from .fs_helpers import _sedes_map, _resolve_sede_name
        if not db:
            return []
        sedes_map = _sedes_map()
        data = []
        for doc in db.collection('turns').stream():
            t = doc.to_dict()
            if t and t.get('status') == 'waiting':
                data.append({
                    'number':  t.get('number'),
                    'status':  'waiting',
                    'sede_id': t.get('sede_id', ''),
                    'sede':    _resolve_sede_name(t.get('sede_id', ''), sedes_map),
                })
        data.sort(key=lambda x: x.get('number', ''))
        return data

    @database_sync_to_async
    def _get_position_data(self, user_turn):
        from .firebase_config import db
        if not db:
            return {'position': -1, 'turns_ahead': -1, 'message': 'Service unavailable'}
        all_docs = list(db.collection('turns').stream())
        all_turns = [doc.to_dict() for doc in all_docs if doc.to_dict()]
        user_doc = next((t for t in all_turns if t.get('number') == user_turn), None)
        if not user_doc:
            return {'position': -1, 'turns_ahead': -1, 'message': 'Turn not found'}
        if user_doc.get('status') == 'finished':
            return {'position': 0, 'turns_ahead': 0, 'status': 'finished'}
        waiting = sorted([t for t in all_turns if t.get('status') == 'waiting'], key=lambda t: t.get('created_at', ''))
        idx = next((i for i, t in enumerate(waiting) if t.get('number') == user_turn), -1)
        if idx == -1:
            return {'position': -1, 'turns_ahead': -1, 'status': user_doc.get('status'), 'user_turn': user_turn}
        return {'position': idx + 1, 'turns_ahead': idx, 'status': user_doc.get('status'), 'user_turn': user_turn}

    # Called by channel layer group_send from broadcast_turn_update()
    async def turn_update(self, event):
        await self.send(text_data=json.dumps(event['data']))
