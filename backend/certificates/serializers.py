from rest_framework import serializers
from .models import Certificate
from courses.serializers import EnrollmentSerializer


class CertificateSerializer(serializers.ModelSerializer):
    enrollment = EnrollmentSerializer(read_only=True)
    
    class Meta:
        model = Certificate
        fields = ['id', 'enrollment', 'certificate_number', 'issued_at', 'pdf_file']
        read_only_fields = ['id', 'certificate_number', 'issued_at']

