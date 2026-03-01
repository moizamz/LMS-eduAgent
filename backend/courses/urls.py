from django.urls import path
from . import views

urlpatterns = [
    path('', views.CourseListView.as_view(), name='course_list'),
    path('<int:pk>/', views.CourseDetailView.as_view(), name='course_detail'),
    path('modules/', views.ModuleListView.as_view(), name='module_list'),
    path('modules/<int:pk>/', views.ModuleDetailView.as_view(), name='module_detail'),
    path('sections/', views.SectionListView.as_view(), name='section_list'),
    path('sections/<int:pk>/', views.SectionDetailView.as_view(), name='section_detail'),
    path('subsections/', views.SubsectionListView.as_view(), name='subsection_list'),
    path('subsections/<int:pk>/', views.SubsectionDetailView.as_view(), name='subsection_detail'),
    path('<int:course_id>/enroll/', views.enroll_course, name='enroll_course'),
    path('my-enrollments/', views.my_enrollments, name='my_enrollments'),
    path('progress/<int:course_id>/', views.course_progress, name='course_progress'),
    path('<int:enrollment_id>/modules/<int:module_id>/complete/', views.mark_module_complete, name='mark_module_complete'),
    path('<int:enrollment_id>/subsections/<int:subsection_id>/complete/', views.mark_subsection_complete, name='mark_subsection_complete'),
    path('analytics/', views.analytics, name='analytics'),
]

