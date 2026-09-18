from datetime import date, timedelta

from .fs_helpers import is_in_todays_queue


def get_turn_statistics():
    from .firebase_config import db
    if not db:
        return _empty_stats()

    all_turns = []
    for doc in db.collection('turns').stream():
        t = doc.to_dict()
        if t:
            all_turns.append(t)

    today_str = date.today().isoformat()
    today_turns = [t for t in all_turns if t.get('created_at', '').startswith(today_str)]

    service_types = ['general', 'preferential', 'emergency', 'vip']
    service_stats = {st: sum(1 for t in today_turns if t.get('service_type') == st) for st in service_types}

    last_7_days = []
    for i in range(6, -1, -1):
        day = date.today() - timedelta(days=i)
        day_str = day.isoformat()
        count = sum(1 for t in all_turns if t.get('created_at', '').startswith(day_str))
        last_7_days.append({'date': day_str, 'turns': count})

    return {
        'total':          len(all_turns),
        'waiting':        sum(1 for t in all_turns if is_in_todays_queue(t)),
        'calling':        sum(1 for t in all_turns if t.get('status') == 'called'),
        'today_turns':    len(today_turns),
        'completed':      sum(1 for t in all_turns if t.get('status') == 'finished'),
        'service_stats':  service_stats,
        'last_7_days':    last_7_days,
        'average_wait_time': 0
    }


def _empty_stats():
    return {'total': 0, 'waiting': 0, 'calling': 0, 'today_turns': 0, 'completed': 0,
            'service_stats': {}, 'last_7_days': [], 'average_wait_time': 0}


def calculate_average_wait_time():
    return 0


def get_service_type_distribution():
    from .firebase_config import db
    from collections import Counter
    if not db:
        return []
    counter = Counter()
    for doc in db.collection('turns').stream():
        t = doc.to_dict()
        if t:
            counter[t.get('service_type', 'general')] += 1
    return [{'service_type': k, 'count': v} for k, v in counter.items()]
