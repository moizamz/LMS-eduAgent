# Learning Management System (LMS)

A full-fledged Learning Management System for university-level environments with support for students, instructors, and administrators with role-based access control.

## Features

### Core Features
- ✅ User authentication (signup, login, password reset)
- ✅ Role management (Admin, Instructor, Student)
- ✅ Course management (create, update, delete courses)
- ✅ Enrollment system for students
- ✅ Module-based course content (videos, PDFs, links)
- ✅ Assignment creation, submission, and grading
- ✅ Quizzes with MCQs and auto-grading
- ✅ Progress tracking and completion status
- ✅ Announcements and notifications
- ✅ Discussion forum or comments section
- ✅ Certificate generation upon course completion

### Admin Panel
- Manage users and roles
- Approve or block instructors
- View platform analytics (users, courses, engagement)

### Instructor Panel
- Create and manage courses
- Upload learning materials
- Create assignments and quizzes
- Grade submissions and provide feedback

### Student Panel
- Browse and enroll in courses
- Access learning content
- Submit assignments and attempt quizzes
- Track progress and download certificates

## Technology Stack

### Backend
- **Framework**: Django 4.2.7
- **API**: Django REST Framework
- **Authentication**: JWT (JSON Web Tokens)
- **Database**: PostgreSQL (with SQLite fallback for development)
- **PDF Generation**: ReportLab

### Frontend
- **Framework**: React 18.2.0
- **UI Library**: Material-UI (MUI)
- **Routing**: React Router DOM
- **HTTP Client**: Axios
- **State Management**: React Context API

## Project Structure

```
LMS/
├── backend/
│   ├── accounts/          # User authentication and management
│   ├── courses/            # Course and module management
│   ├── assignments/       # Assignment system
│   ├── quizzes/           # Quiz system
│   ├── announcements/     # Announcements and notifications
│   ├── discussions/       # Discussion forum
│   ├── certificates/      # Certificate generation
│   ├── lms_project/       # Django project settings
│   ├── manage.py
│   └── requirements.txt
├── frontend/
│   ├── public/
│   ├── src/
│   │   ├── components/    # Reusable components
│   │   ├── contexts/      # React contexts
│   │   ├── pages/         # Page components
│   │   ├── services/      # API services
│   │   ├── App.js
│   │   └── index.js
│   └── package.json
└── README.md
```

## Installation & Setup

### Prerequisites
- Python 3.8+
- Node.js 14+
- PostgreSQL (optional, SQLite can be used for development)
- pip and npm

### Backend Setup

1. **Navigate to backend directory**
   ```bash
   cd backend
   ```

2. **Create virtual environment**
   ```bash
   python -m venv venv
   ```

3. **Activate virtual environment**
   - Windows:
     ```bash
     venv\Scripts\activate
     ```
   - Linux/Mac:
     ```bash
     source venv/bin/activate
     ```

4. **Install dependencies**
   ```bash
   pip install -r requirements.txt
   ```

5. **Set up environment variables**
   - Copy `.env.example` to `.env` (if it exists) or create a `.env` file
   - Configure database and other settings

6. **Run migrations**
   ```bash
   python manage.py makemigrations
   python manage.py migrate
   ```

7. **Create superuser**
   ```bash
   python manage.py createsuperuser
   ```

8. **Run development server**
   ```bash
   python manage.py runserver
   ```

   Backend will be available at `http://localhost:8000`

### Frontend Setup

1. **Navigate to frontend directory**
   ```bash
   cd frontend
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Start development server**
   ```bash
   npm start
   ```

   Frontend will be available at `http://localhost:3000`

## Database Models

### User Model
- Custom user model with roles (admin, instructor, student)
- Profile information (phone, bio, profile picture)
- Instructor approval system

### Course Model
- Course information (title, description, instructor)
- Module-based content structure
- Enrollment tracking

### Module Model
- Supports multiple content types (video, PDF, link, text)
- Ordered modules within courses

### Assignment Model
- Assignment creation with due dates
- Submission tracking and grading

### Quiz Model
- Multiple choice questions
- Auto-grading system
- Attempt tracking

### Certificate Model
- Automatic certificate generation
- PDF certificate download

## API Endpoints

### Authentication
- `POST /api/auth/register/` - User registration
- `POST /api/auth/login/` - User login
- `GET /api/auth/profile/` - Get user profile
- `PUT /api/auth/profile/update/` - Update profile
- `POST /api/auth/change-password/` - Change password
- `POST /api/auth/password-reset/` - Request password reset

### Courses
- `GET /api/courses/` - List courses
- `POST /api/courses/` - Create course (instructor/admin)
- `GET /api/courses/{id}/` - Course details
- `PUT /api/courses/{id}/` - Update course
- `DELETE /api/courses/{id}/` - Delete course
- `POST /api/courses/{id}/enroll/` - Enroll in course
- `GET /api/courses/my-enrollments/` - Get user enrollments
- `GET /api/courses/progress/{course_id}/` - Get course progress

### Assignments
- `GET /api/assignments/?course_id={id}` - List assignments
- `POST /api/assignments/` - Create assignment
- `POST /api/assignments/{id}/submit/` - Submit assignment
- `GET /api/assignments/my-submissions/` - Get user submissions
- `POST /api/assignments/submissions/{id}/grade/` - Grade submission

### Quizzes
- `GET /api/quizzes/?course_id={id}` - List quizzes
- `POST /api/quizzes/` - Create quiz
- `POST /api/quizzes/{id}/start/` - Start quiz attempt
- `POST /api/quizzes/{id}/attempts/{attempt_id}/submit/` - Submit quiz
- `GET /api/quizzes/my-attempts/` - Get user attempts

### Certificates
- `POST /api/certificates/generate/{enrollment_id}/` - Generate certificate
- `GET /api/certificates/{id}/download/` - Download certificate
- `GET /api/certificates/my-certificates/` - Get user certificates

## Usage

### Creating an Admin User
1. Run `python manage.py createsuperuser`
2. Set role to 'admin' in Django admin or via API

### Creating an Instructor
1. Register with role 'instructor'
2. Admin must approve the instructor account
3. Once approved, instructor can create courses

### Student Workflow
1. Register with role 'student'
2. Browse available courses
3. Enroll in courses
4. Access course modules
5. Submit assignments and take quizzes
6. Track progress
7. Download certificates upon completion

## Development

### Running Tests
```bash
python manage.py test
```

### Database Reset
```bash
python manage.py flush
python manage.py migrate
```

### Collect Static Files
```bash
python manage.py collectstatic
```

## Deployment

### Backend Deployment
1. Set `DEBUG=False` in settings
2. Configure production database
3. Set up proper SECRET_KEY
4. Configure ALLOWED_HOSTS
5. Set up static file serving
6. Use a production WSGI server (e.g., Gunicorn)

### Frontend Deployment
1. Build production bundle:
   ```bash
   npm run build
   ```
2. Serve the `build` folder using a web server (e.g., Nginx)

## Security Considerations

- JWT tokens for authentication
- Password hashing
- CSRF protection
- SQL injection prevention (Django ORM)
- XSS protection
- Role-based access control
- File upload validation

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## License

This project is open source and available under the MIT License.

## Support

For issues and questions, please open an issue on the repository.

## Future Enhancements

- Video streaming integration
- Live chat support
- Mobile app
- Advanced analytics
- Payment integration
- Multi-language support
- Email notifications
- Calendar integration

