from django.urls import path
from . import views

urlpatterns = [
    path('', views.QuizListView.as_view(), name='quiz_list'),
    path('questions/', views.QuestionListView.as_view(), name='question_list'),
    path('questions/<int:pk>/', views.QuestionDetailView.as_view(), name='question_detail'),
    path('choices/', views.ChoiceListView.as_view(), name='choice_list'),
    path('choices/<int:pk>/', views.ChoiceDetailView.as_view(), name='choice_detail'),
    path('generate-questions/', views.generate_questions, name='generate_questions'),
    path('import-questions/', views.import_questions, name='import_questions'),
    path('my-attempts/', views.my_quiz_attempts, name='my_quiz_attempts'),
    path('<int:quiz_id>/export/', views.export_quiz, name='export_quiz'),
    path('<int:quiz_id>/start/', views.start_quiz, name='start_quiz'),
    path('<int:quiz_id>/attempts/<int:attempt_id>/questions/', views.get_quiz_questions, name='get_quiz_questions'),
    path('<int:quiz_id>/attempts/<int:attempt_id>/submit/', views.submit_quiz, name='submit_quiz'),
    path('<int:quiz_id>/results/', views.quiz_results, name='quiz_results'),
    path('<int:pk>/', views.QuizDetailView.as_view(), name='quiz_detail'),
]