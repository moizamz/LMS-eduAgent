from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("quizzes", "0004_studentadaptivepolicystate"),
    ]

    operations = [
        migrations.AddField(
            model_name="studentadaptivepolicystate",
            name="ability_state",
            field=models.JSONField(default=dict),
        ),
    ]
