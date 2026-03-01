from django.db import models
from django.conf import settings


class Course(models.Model):
    title = models.CharField(max_length=200)
    description = models.TextField()
    instructor = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, 
                                   related_name='taught_courses', limit_choices_to={'role': 'instructor'})
    thumbnail = models.ImageField(upload_to='course_thumbnails/', blank=True, null=True)
    price = models.DecimalField(max_digits=10, decimal_places=2, default=0.00)
    is_published = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        ordering = ['-created_at']
    
    def __str__(self):
        return self.title


class Section(models.Model):
    """Course section (e.g. Week 1, Chapter 1) - groups subsections/lectures."""
    course = models.ForeignKey(Course, on_delete=models.CASCADE, related_name='sections')
    title = models.CharField(max_length=200)
    order = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['order', 'created_at']

    def __str__(self):
        return f"{self.course.title} - {self.title}"


class Subsection(models.Model):
    """Lecture/content within a section - supports PDF upload."""
    section = models.ForeignKey(Section, on_delete=models.CASCADE, related_name='subsections')
    title = models.CharField(max_length=200)
    order = models.PositiveIntegerField(default=0)
    pdf_file = models.FileField(upload_to='course_lectures/', blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['order', 'created_at']

    def __str__(self):
        return f"{self.section.title} - {self.title}"


class Module(models.Model):
    CONTENT_TYPE_CHOICES = [
        ('video', 'Video'),
        ('pdf', 'PDF'),
        ('link', 'Link'),
        ('text', 'Text'),
    ]
    
    course = models.ForeignKey(Course, on_delete=models.CASCADE, related_name='modules')
    title = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    order = models.PositiveIntegerField(default=0)
    content_type = models.CharField(max_length=20, choices=CONTENT_TYPE_CHOICES, default='text')
    video_url = models.URLField(blank=True, null=True)
    pdf_file = models.FileField(upload_to='course_pdfs/', blank=True, null=True)
    external_link = models.URLField(blank=True, null=True)
    text_content = models.TextField(blank=True, null=True)
    duration_minutes = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        ordering = ['order', 'created_at']
    
    def __str__(self):
        return f"{self.course.title} - {self.title}"


class Enrollment(models.Model):
    student = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, 
                               related_name='enrollments', limit_choices_to={'role': 'student'})
    course = models.ForeignKey(Course, on_delete=models.CASCADE, related_name='enrollments')
    enrolled_at = models.DateTimeField(auto_now_add=True)
    progress_percentage = models.FloatField(default=0.0)
    is_completed = models.BooleanField(default=False)
    completed_at = models.DateTimeField(blank=True, null=True)
    
    class Meta:
        unique_together = ['student', 'course']
        ordering = ['-enrolled_at']
    
    def __str__(self):
        return f"{self.student.username} - {self.course.title}"


class ModuleProgress(models.Model):
    enrollment = models.ForeignKey(Enrollment, on_delete=models.CASCADE, related_name='module_progress')
    module = models.ForeignKey(Module, on_delete=models.CASCADE)
    is_completed = models.BooleanField(default=False)
    completed_at = models.DateTimeField(blank=True, null=True)
    last_accessed = models.DateTimeField(auto_now=True)
    
    class Meta:
        unique_together = ['enrollment', 'module']
    
    def __str__(self):
        return f"{self.enrollment.student.username} - {self.module.title}"


class SubsectionProgress(models.Model):
    """Tracks student progress through subsections (lectures)."""
    enrollment = models.ForeignKey(Enrollment, on_delete=models.CASCADE, related_name='subsection_progress')
    subsection = models.ForeignKey(Subsection, on_delete=models.CASCADE)
    is_completed = models.BooleanField(default=False)
    completed_at = models.DateTimeField(blank=True, null=True)
    last_accessed = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ['enrollment', 'subsection']

    def __str__(self):
        return f"{self.enrollment.student.username} - {self.subsection.title}"

