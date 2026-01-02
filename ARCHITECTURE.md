# System Architecture

## Overview

The LMS is built using a modern full-stack architecture with Django REST Framework backend and React frontend.

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                        Frontend (React)                      │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  │
│  │  Student │  │Instructor│  │   Admin   │  │  Public  │  │
│  │  Panel   │  │  Panel   │  │  Panel   │  │  Pages   │  │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘  │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │         React Router + Context API                    │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │              Axios HTTP Client                        │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                            │
                            │ HTTP/REST API
                            │ JWT Authentication
                            ▼
┌─────────────────────────────────────────────────────────────┐
│              Backend (Django REST Framework)                │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐ │
│  │Accounts  │  │ Courses   │  │Assignments│  │ Quizzes  │ │
│  │  App     │  │   App     │  │   App     │  │   App    │ │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘ │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐               │
│  │Announce- │  │Discussion │  │Certifi-  │               │
│  │  ments   │  │   App     │  │  cates   │               │
│  └──────────┘  └──────────┘  └──────────┘               │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │         Django REST Framework + JWT Auth              │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                            │
                            │ ORM
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                    Database (PostgreSQL/SQLite)             │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐ │
│  │  Users   │  │ Courses   │  │Enrollments│  │Assignments│ │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘ │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐ │
│  │ Modules  │  │  Quizzes  │  │Questions │  │Certificates│ │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘ │
└─────────────────────────────────────────────────────────────┘
```

## Component Architecture

### Frontend Components

#### 1. Authentication Layer
- **AuthContext**: Global authentication state management
- **PrivateRoute**: Route protection based on authentication and roles
- **Login/Register**: User authentication pages

#### 2. Role-Based Panels
- **StudentPanel**: Course browsing, enrollment, progress tracking
- **InstructorPanel**: Course creation, content management, grading
- **AdminPanel**: User management, analytics, platform oversight

#### 3. Core Pages
- **Dashboard**: Role-specific dashboard with statistics
- **Courses**: Course listing and details
- **MyCourses**: Student's enrolled courses with progress
- **Profile**: User profile management

### Backend Architecture

#### 1. Django Apps

**accounts**
- User model (extends AbstractUser)
- Authentication endpoints
- User management
- Role-based permissions

**courses**
- Course model
- Module model (supports multiple content types)
- Enrollment tracking
- Progress calculation

**assignments**
- Assignment creation
- Submission handling
- Grading system

**quizzes**
- Quiz model with questions and choices
- Attempt tracking
- Auto-grading

**announcements**
- Platform and course announcements
- Notification system

**discussions**
- Discussion threads
- Comment system with replies

**certificates**
- Certificate generation
- PDF creation with ReportLab

#### 2. Database Schema

**Core Models:**
- `User`: Custom user with roles
- `Course`: Course information
- `Module`: Course content modules
- `Enrollment`: Student-course relationship
- `ModuleProgress`: Track module completion
- `Assignment`: Course assignments
- `AssignmentSubmission`: Student submissions
- `Quiz`: Quiz information
- `Question`: Quiz questions
- `Choice`: Answer choices
- `QuizAttempt`: Student quiz attempts
- `Answer`: Student answers
- `Announcement`: Announcements
- `Notification`: User notifications
- `Discussion`: Discussion threads
- `Comment`: Discussion comments
- `Certificate`: Generated certificates

## Data Flow

### Authentication Flow
```
User Login → Frontend → POST /api/auth/login/
→ Backend validates → Returns JWT token
→ Frontend stores token → Sets Authorization header
→ All subsequent requests include token
```

### Course Enrollment Flow
```
Student browses courses → Selects course → POST /api/courses/{id}/enroll/
→ Backend creates Enrollment → Returns enrollment data
→ Frontend updates UI → Student can access course content
```

### Assignment Submission Flow
```
Student views assignment → Submits file/text → POST /api/assignments/{id}/submit/
→ Backend saves submission → Returns submission data
→ Instructor grades → POST /api/assignments/submissions/{id}/grade/
→ Student receives grade and feedback
```

### Quiz Flow
```
Student starts quiz → POST /api/quizzes/{id}/start/
→ Backend creates attempt → Returns questions
→ Student answers → POST /api/quizzes/{id}/attempts/{id}/submit/
→ Backend auto-grades → Returns score
```

## Security Architecture

### Authentication
- JWT tokens for stateless authentication
- Token refresh mechanism
- Secure password hashing (Django's default)

### Authorization
- Role-based access control (RBAC)
- Permission checks at view level
- Instructor approval system

### Data Protection
- CSRF protection (Django)
- SQL injection prevention (ORM)
- XSS protection
- File upload validation

## API Design

### RESTful Principles
- Resource-based URLs
- HTTP methods (GET, POST, PUT, DELETE)
- JSON request/response format
- Status codes for errors

### Endpoint Structure
```
/api/{resource}/          # List/Create
/api/{resource}/{id}/     # Retrieve/Update/Delete
/api/{resource}/{id}/{action}/  # Custom actions
```

## File Structure

```
LMS/
├── backend/
│   ├── accounts/         # User management
│   ├── courses/          # Course system
│   ├── assignments/     # Assignment system
│   ├── quizzes/         # Quiz system
│   ├── announcements/    # Announcements
│   ├── discussions/     # Discussion forum
│   ├── certificates/     # Certificate generation
│   └── lms_project/      # Django settings
├── frontend/
│   ├── src/
│   │   ├── components/  # Reusable components
│   │   ├── contexts/    # React contexts
│   │   ├── pages/       # Page components
│   │   └── services/    # API services
│   └── public/          # Static files
└── docs/                # Documentation
```

## Scalability Considerations

### Current Architecture
- Monolithic Django backend
- Single-page React application
- SQLite/PostgreSQL database

### Future Enhancements
- Microservices architecture
- Redis for caching
- Celery for async tasks
- CDN for static/media files
- Load balancing
- Database replication

## Deployment Architecture

### Development
```
Frontend (React Dev Server) → Backend (Django Dev Server) → SQLite
```

### Production
```
Nginx → React Build → Django (Gunicorn) → PostgreSQL
```

## Technology Choices

### Backend
- **Django**: Mature, secure, feature-rich
- **DRF**: Powerful REST API framework
- **JWT**: Stateless authentication
- **PostgreSQL**: Robust relational database

### Frontend
- **React**: Component-based UI
- **Material-UI**: Professional UI components
- **React Router**: Client-side routing
- **Axios**: HTTP client

## Performance Optimizations

1. **Database**: Indexes on foreign keys and frequently queried fields
2. **API**: Pagination for list endpoints
3. **Frontend**: Code splitting, lazy loading
4. **Caching**: Consider Redis for production

## Monitoring & Logging

### Current
- Django logging
- Console output

### Recommended for Production
- Application monitoring (Sentry)
- Performance monitoring (New Relic)
- Log aggregation (ELK Stack)

