from rest_framework import generics, status, permissions
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from django.utils import timezone
from reportlab.lib.pagesizes import letter, A4
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Image
from reportlab.pdfgen import canvas
from io import BytesIO
from django.http import HttpResponse
from django.conf import settings
import os
import uuid
from .models import Certificate
from .serializers import CertificateSerializer
from courses.models import Enrollment


def generate_certificate_pdf(certificate):
    """Generate PDF certificate"""
    buffer = BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=A4)
    story = []
    
    styles = getSampleStyleSheet()
    title_style = ParagraphStyle(
        'CustomTitle',
        parent=styles['Heading1'],
        fontSize=24,
        textColor=colors.HexColor('#1a237e'),
        spaceAfter=30,
        alignment=1,  # Center alignment
    )
    
    heading_style = ParagraphStyle(
        'CustomHeading',
        parent=styles['Heading2'],
        fontSize=18,
        textColor=colors.HexColor('#283593'),
        spaceAfter=20,
        alignment=1,
    )
    
    normal_style = ParagraphStyle(
        'CustomNormal',
        parent=styles['Normal'],
        fontSize=14,
        textColor=colors.HexColor('#424242'),
        alignment=1,
        spaceAfter=15,
    )
    
    # Title
    story.append(Spacer(1, 2*inch))
    story.append(Paragraph("CERTIFICATE OF COMPLETION", title_style))
    story.append(Spacer(1, 0.5*inch))
    
    # Body
    student_name = certificate.enrollment.student.get_full_name() or certificate.enrollment.student.username
    course_title = certificate.enrollment.course.title
    completion_date = certificate.issued_at.strftime("%B %d, %Y")
    
    story.append(Paragraph("This is to certify that", normal_style))
    story.append(Spacer(1, 0.3*inch))
    story.append(Paragraph(f"<b>{student_name}</b>", heading_style))
    story.append(Spacer(1, 0.3*inch))
    story.append(Paragraph("has successfully completed the course", normal_style))
    story.append(Spacer(1, 0.3*inch))
    story.append(Paragraph(f"<b>{course_title}</b>", heading_style))
    story.append(Spacer(1, 0.3*inch))
    story.append(Paragraph(f"on {completion_date}", normal_style))
    story.append(Spacer(1, 0.5*inch))
    
    # Certificate number
    story.append(Paragraph(f"Certificate Number: {certificate.certificate_number}", 
                          ParagraphStyle('CustomNormal', parent=normal_style, fontSize=10)))
    
    doc.build(story)
    buffer.seek(0)
    return buffer


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def generate_certificate(request, enrollment_id):
    if not request.user.is_student:
        return Response({'error': 'Only students can generate certificates'}, 
                       status=status.HTTP_403_FORBIDDEN)
    
    try:
        enrollment = Enrollment.objects.get(id=enrollment_id, student=request.user)
    except Enrollment.DoesNotExist:
        return Response({'error': 'Enrollment not found'}, status=status.HTTP_404_NOT_FOUND)
    
    if not enrollment.is_completed:
        return Response({'error': 'Course not completed yet'}, 
                       status=status.HTTP_400_BAD_REQUEST)
    
    # Check if certificate already exists
    if hasattr(enrollment, 'certificate'):
        serializer = CertificateSerializer(enrollment.certificate)
        return Response(serializer.data)
    
    # Generate certificate number
    certificate_number = f"CERT-{enrollment.course.id}-{enrollment.student.id}-{uuid.uuid4().hex[:8].upper()}"
    
    # Create certificate
    certificate = Certificate.objects.create(
        enrollment=enrollment,
        certificate_number=certificate_number
    )
    
    # Generate PDF
    pdf_buffer = generate_certificate_pdf(certificate)
    
    # Save PDF file
    filename = f"certificate_{certificate_number}.pdf"
    filepath = os.path.join(settings.MEDIA_ROOT, 'certificates', filename)
    os.makedirs(os.path.dirname(filepath), exist_ok=True)
    
    with open(filepath, 'wb') as f:
        f.write(pdf_buffer.read())
    
    certificate.pdf_file.name = f'certificates/{filename}'
    certificate.save()
    
    serializer = CertificateSerializer(certificate)
    return Response(serializer.data, status=status.HTTP_201_CREATED)


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def download_certificate(request, certificate_id):
    try:
        certificate = Certificate.objects.get(id=certificate_id)
    except Certificate.DoesNotExist:
        return Response({'error': 'Certificate not found'}, status=status.HTTP_404_NOT_FOUND)
    
    # Check permissions
    if request.user.is_student and certificate.enrollment.student != request.user:
        return Response({'error': 'Permission denied'}, status=status.HTTP_403_FORBIDDEN)
    
    if request.user.is_instructor and certificate.enrollment.course.instructor != request.user:
        return Response({'error': 'Permission denied'}, status=status.HTTP_403_FORBIDDEN)
    
    if not request.user.is_admin:
        if request.user.is_student and certificate.enrollment.student != request.user:
            return Response({'error': 'Permission denied'}, status=status.HTTP_403_FORBIDDEN)
    
    if certificate.pdf_file:
        response = HttpResponse(certificate.pdf_file.read(), content_type='application/pdf')
        response['Content-Disposition'] = f'attachment; filename="certificate_{certificate.certificate_number}.pdf"'
        return response
    
    # Generate PDF if not exists
    pdf_buffer = generate_certificate_pdf(certificate)
    response = HttpResponse(pdf_buffer.read(), content_type='application/pdf')
    response['Content-Disposition'] = f'attachment; filename="certificate_{certificate.certificate_number}.pdf"'
    return response


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def my_certificates(request):
    if request.user.is_student:
        certificates = Certificate.objects.filter(enrollment__student=request.user)
    elif request.user.is_instructor:
        certificates = Certificate.objects.filter(enrollment__course__instructor=request.user)
    else:
        certificates = Certificate.objects.all()
    
    serializer = CertificateSerializer(certificates, many=True)
    return Response(serializer.data)

