from django.contrib import admin
from django.urls import path, include, re_path
from django.views.generic import TemplateView
from django.http import HttpResponse
from pathlib import Path
import mimetypes
from turns import views

BASE_DIR = Path(__file__).resolve().parent.parent
DIST_DIR = BASE_DIR / 'frontend' / 'dist' / 'frontend' / 'browser'

def serve_index(request):
    return TemplateView.as_view(template_name='index.html')(request)

def make_serve_static(file_path):
    def serve_static(request):
        full_path = DIST_DIR / file_path
        if full_path.exists() and full_path.is_file():
            content_type, _ = mimetypes.guess_type(str(full_path))
            if content_type is None:
                content_type = 'application/octet-stream'
            with open(full_path, 'rb') as f:
                return HttpResponse(f.read(), content_type=content_type)
        return serve_index(request)
    return serve_static

# Get actual filenames from dist
def get_asset_urls():
    assets = []
    try:
        for f in DIST_DIR.iterdir():
            if f.is_file() and (f.suffix.lower() in [
                '.css', '.js', '.ico', '.png', '.jpg', '.jpeg', '.svg', '.gif', '.webp', '.woff', '.woff2',
            ]):
                assets.append(re_path(f'^{f.name}$', make_serve_static(f.name)))
    except:
        pass
    return assets

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/', include('turns.urls')),
    path('', views.home, name='index'),
    path('home/', views.home, name='home'),
    path('employee/', views.employee, name='employee'),
    path('screen/', views.screen, name='screen'),
    path('dashboard/', views.dashboard, name='dashboard'),
    path('register/', views.register_page, name='register_page'),
    path('login/', views.login_page, name='login_page'),
] + get_asset_urls() + [
    # SPA fallback - must be last
    re_path(r'^.*$', serve_index),
]