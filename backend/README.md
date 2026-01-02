# LMS Backend

Django REST API backend for the Learning Management System.

## Setup Instructions

1. **Create and activate virtual environment**
   ```bash
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   ```

2. **Install dependencies**
   ```bash
   pip install -r requirements.txt
   ```

3. **Configure database**
   - For SQLite (easier for development): Set `USE_SQLITE=True` in `.env`
   - For PostgreSQL: Configure database settings in `.env`

4. **Run migrations**
   ```bash
   python manage.py makemigrations
   python manage.py migrate
   ```

5. **Create superuser**
   ```bash
   python manage.py createsuperuser
   ```

6. **Run server**
   ```bash
   python manage.py runserver
   ```

## Environment Variables

Create a `.env` file in the backend directory:

```env
SECRET_KEY=your-secret-key-here
DEBUG=True
ALLOWED_HOSTS=localhost,127.0.0.1

# Database (PostgreSQL)
DB_NAME=lms_db
DB_USER=postgres
DB_PASSWORD=postgres
DB_HOST=localhost
DB_PORT=5432

# Use SQLite instead
USE_SQLITE=False

# Email Configuration
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USE_TLS=True
EMAIL_HOST_USER=your-email@gmail.com
EMAIL_HOST_PASSWORD=your-app-password
DEFAULT_FROM_EMAIL=noreply@lms.com
```

## API Documentation

The API is RESTful and uses JWT authentication. Include the token in the Authorization header:

```
Authorization: Bearer <your-token>
```

## Apps

- **accounts**: User authentication and management
- **courses**: Course and module management
- **assignments**: Assignment system
- **quizzes**: Quiz system
- **announcements**: Announcements and notifications
- **discussions**: Discussion forum
- **certificates**: Certificate generation

