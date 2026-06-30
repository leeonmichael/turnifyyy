"""
Turn statistics and analytics module
Author: Nicolas Ruiz
"""
from django.db.models import Count, Avg
from .models import Turn
from datetime import date

def get_turn_statistics():
    """Calculate statistics for turn management"""
    from django.utils import timezone
    today = date.today()
    
    total_turns = Turn.objects.count()
    waiting_turns = Turn.objects.filter(status='waiting').count()
    calling_turns = Turn.objects.filter(status='called').count()
    completed = Turn.objects.filter(status='finished').count()
    
    service_stats = {
        'general': Turn.objects.filter(service_type='general', created_at__date=today).count(),
        'preferential': Turn.objects.filter(service_type='preferential', created_at__date=today).count(),
        'emergency': Turn.objects.filter(service_type='emergency', created_at__date=today).count(),
        'vip': Turn.objects.filter(service_type='vip', created_at__date=today).count()
    }
    
    last_7_days = []
    for i in range(7):
        day = today - __import__('datetime').timedelta(days=i)
        count = Turn.objects.filter(created_at__date=day).count()
        last_7_days.append({
            'date': day.strftime('%Y-%m-%d'),
            'turns': count
        })
    last_7_days.reverse()
    
    return {
        'total': total_turns,
        'waiting': waiting_turns,
        'calling': calling_turns,
        'today_turns': Turn.objects.filter(created_at__date=today).count(),
        'completed': completed,
        'service_stats': service_stats,
        'last_7_days': last_7_days,
        'average_wait_time': 0
    }

def calculate_average_wait_time():
    """Calculate average wait time for completed turns"""
    return 0

def get_service_type_distribution():
    """Get distribution of turns by service type"""
    return Turn.objects.values('service_type').annotate(count=Count('id'))