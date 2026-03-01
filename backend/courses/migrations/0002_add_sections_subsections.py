# Generated manually for Section, Subsection, SubsectionProgress

from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('courses', '0001_initial'),
    ]

    operations = [
        migrations.CreateModel(
            name='Section',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('title', models.CharField(max_length=200)),
                ('order', models.PositiveIntegerField(default=0)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('course', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='sections', to='courses.course')),
            ],
            options={
                'ordering': ['order', 'created_at'],
            },
        ),
        migrations.CreateModel(
            name='Subsection',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('title', models.CharField(max_length=200)),
                ('order', models.PositiveIntegerField(default=0)),
                ('pdf_file', models.FileField(blank=True, null=True, upload_to='course_lectures/')),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('section', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='subsections', to='courses.section')),
            ],
            options={
                'ordering': ['order', 'created_at'],
            },
        ),
        migrations.CreateModel(
            name='SubsectionProgress',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('is_completed', models.BooleanField(default=False)),
                ('completed_at', models.DateTimeField(blank=True, null=True)),
                ('last_accessed', models.DateTimeField(auto_now=True)),
                ('enrollment', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='subsection_progress', to='courses.enrollment')),
                ('subsection', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, to='courses.subsection')),
            ],
            options={
                'unique_together': {('enrollment', 'subsection')},
            },
        ),
    ]
