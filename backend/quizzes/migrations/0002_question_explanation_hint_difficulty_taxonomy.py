# Generated manually - add explanation, hint, difficulty, taxonomy to Question

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('quizzes', '0001_initial'),
    ]

    operations = [
        migrations.AddField(
            model_name='question',
            name='explanation',
            field=models.TextField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='question',
            name='hint',
            field=models.TextField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='question',
            name='difficulty',
            field=models.CharField(blank=True, choices=[('easy', 'Easy'), ('medium', 'Medium'), ('hard', 'Hard')], max_length=20, null=True),
        ),
        migrations.AddField(
            model_name='question',
            name='taxonomy',
            field=models.CharField(blank=True, choices=[('remember', 'Remember'), ('understand', 'Understand'), ('apply', 'Apply'), ('analyze', 'Analyze'), ('evaluate', 'Evaluate'), ('create', 'Create')], max_length=20, null=True),
        ),
    ]
