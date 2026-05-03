from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('assignments', '0004_assignment_instruction_file'),
    ]

    operations = [
        migrations.AddField(
            model_name='assignmentsubmission',
            name='ai_grading',
            field=models.JSONField(blank=True, default=dict),
        ),
    ]
