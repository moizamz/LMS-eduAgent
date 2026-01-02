from django.contrib import admin
from .models import Certificate


@admin.register(Certificate)
class CertificateAdmin(admin.ModelAdmin):
    list_display = ['certificate_number', 'enrollment', 'issued_at']
    list_filter = ['issued_at']
    search_fields = ['certificate_number', 'enrollment__student__username', 'enrollment__course__title']

