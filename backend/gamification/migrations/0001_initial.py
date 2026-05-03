from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        ('courses', '0002_add_sections_subsections'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name='StudentGamificationState',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('total_xp', models.PositiveIntegerField(default=0)),
                ('current_streak_days', models.PositiveIntegerField(default=0)),
                ('longest_streak_days', models.PositiveIntegerField(default=0)),
                ('last_activity_date', models.DateField(blank=True, null=True)),
                ('bandit', models.JSONField(default=dict)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                (
                    'course',
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name='gamification_states',
                        to='courses.course',
                    ),
                ),
                (
                    'student',
                    models.ForeignKey(
                        limit_choices_to={'role': 'student'},
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name='gamification_states',
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={
                'ordering': ['-total_xp'],
                'unique_together': {('student', 'course')},
            },
        ),
        migrations.CreateModel(
            name='EarnedBadge',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('slug', models.CharField(db_index=True, max_length=64)),
                ('title', models.CharField(max_length=120)),
                ('earned_at', models.DateTimeField(auto_now_add=True)),
                (
                    'course',
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name='earned_badges',
                        to='courses.course',
                    ),
                ),
                (
                    'student',
                    models.ForeignKey(
                        limit_choices_to={'role': 'student'},
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name='earned_badges',
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={
                'ordering': ['-earned_at'],
                'unique_together': {('student', 'course', 'slug')},
            },
        ),
        migrations.CreateModel(
            name='RewardLedgerEntry',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('event_type', models.CharField(max_length=64)),
                ('base_points', models.PositiveIntegerField(default=0)),
                ('bonus_points', models.PositiveIntegerField(default=0)),
                ('bandit_arm', models.PositiveSmallIntegerField(default=0)),
                ('proxy_reward', models.FloatField(default=0.0)),
                ('llm_remark', models.TextField(blank=True)),
                ('nudge_key', models.CharField(blank=True, max_length=64)),
                ('metadata', models.JSONField(default=dict)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                (
                    'course',
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name='reward_ledger',
                        to='courses.course',
                    ),
                ),
                (
                    'student',
                    models.ForeignKey(
                        limit_choices_to={'role': 'student'},
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name='reward_ledger',
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={
                'ordering': ['-created_at'],
            },
        ),
    ]
