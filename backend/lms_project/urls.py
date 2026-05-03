"""
URL configuration for lms_project project.
"""
from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static

from quizzes import views as quiz_views
from assignments.views import download_ai_grading_pdf

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/auth/', include('accounts.urls')),
    path('api/courses/', include('courses.urls')),
    # Resolve before the assignments include so this URL cannot be shadowed by reload/order issues.
    path(
        'api/assignments/submissions/<int:submission_id>/ai-grading-pdf/',
        download_ai_grading_pdf,
        name='download_ai_grading_pdf',
    ),
    path('api/assignments/', include('assignments.urls')),
    # Ensure /api/quizzes/<id>/export/ always resolves to the export view
    path('api/quizzes/<int:quiz_id>/export/', quiz_views.export_quiz, name='export_quiz_root'),
    path('api/quizzes/', include('quizzes.urls')),
    path('api/announcements/', include('announcements.urls')),
    path('api/discussions/', include('discussions.urls')),
    path('api/certificates/', include('certificates.urls')),
    path('api/gamification/', include('gamification.urls')),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)