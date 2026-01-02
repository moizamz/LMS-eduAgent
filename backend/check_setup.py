#!/usr/bin/env python
"""
Quick diagnostic script to check Django setup
"""
import os
import sys
import django

# Setup Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'lms_project.settings')
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

try:
    django.setup()
    print("✓ Django setup successful")
    
    # Check if we can import models
    from accounts.models import User
    print("✓ User model imported successfully")
    
    from courses.models import Course
    print("✓ Course model imported successfully")
    
    from assignments.models import Assignment
    print("✓ Assignment model imported successfully")
    
    from quizzes.models import Quiz
    print("✓ Quiz model imported successfully")
    
    from announcements.models import Announcement
    print("✓ Announcement model imported successfully")
    
    from discussions.models import Discussion
    print("✓ Discussion model imported successfully")
    
    from certificates.models import Certificate
    print("✓ Certificate model imported successfully")
    
    print("\n✓ All models imported successfully!")
    print("\nYou can now run:")
    print("  python manage.py makemigrations")
    print("  python manage.py migrate")
    
except Exception as e:
    print(f"✗ Error: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)

