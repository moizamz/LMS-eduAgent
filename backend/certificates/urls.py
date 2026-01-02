from django.urls import path
from . import views

urlpatterns = [
    path('generate/<int:enrollment_id>/', views.generate_certificate, name='generate_certificate'),
    path('<int:certificate_id>/download/', views.download_certificate, name='download_certificate'),
    path('my-certificates/', views.my_certificates, name='my_certificates'),
]

