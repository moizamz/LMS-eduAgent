# API Documentation

Complete API reference for the LMS backend.

## Base URL
```
http://localhost:8000/api
```

## Authentication

All protected endpoints require JWT authentication. Include the token in the Authorization header:

```
Authorization: Bearer <access_token>
```

## Endpoints

### Authentication

#### Register User
```http
POST /api/auth/register/
Content-Type: application/json

{
  "username": "student1",
  "email": "student1@example.com",
  "password": "securepassword123",
  "password2": "securepassword123",
  "first_name": "John",
  "last_name": "Doe",
  "role": "student",
  "phone": "+1234567890"
}
```

**Response:**
```json
{
  "user": {
    "id": 1,
    "username": "student1",
    "email": "student1@example.com",
    "role": "student",
    ...
  },
  "refresh": "refresh_token",
  "access": "access_token"
}
```

#### Login
```http
POST /api/auth/login/
Content-Type: application/json

{
  "username": "student1",
  "password": "securepassword123"
}
```

#### Get Profile
```http
GET /api/auth/profile/
Authorization: Bearer <token>
```

#### Update Profile
```http
PUT /api/auth/profile/update/
Authorization: Bearer <token>
Content-Type: application/json

{
  "first_name": "John",
  "last_name": "Doe",
  "phone": "+1234567890",
  "bio": "Student bio"
}
```

#### Change Password
```http
POST /api/auth/change-password/
Authorization: Bearer <token>
Content-Type: application/json

{
  "old_password": "oldpassword",
  "new_password": "newpassword123",
  "new_password2": "newpassword123"
}
```

#### Password Reset Request
```http
POST /api/auth/password-reset/
Content-Type: application/json

{
  "email": "user@example.com"
}
```

### Courses

#### List Courses
```http
GET /api/courses/
Authorization: Bearer <token>
```

**Query Parameters:**
- `search`: Search term for course title/description

#### Get Course Details
```http
GET /api/courses/{id}/
Authorization: Bearer <token>
```

#### Create Course (Instructor/Admin)
```http
POST /api/courses/
Authorization: Bearer <token>
Content-Type: application/json

{
  "title": "Introduction to Python",
  "description": "Learn Python programming",
  "price": "0.00",
  "is_published": true
}
```

#### Update Course
```http
PUT /api/courses/{id}/
Authorization: Bearer <token>
Content-Type: application/json
```

#### Delete Course
```http
DELETE /api/courses/{id}/
Authorization: Bearer <token>
```

#### Enroll in Course
```http
POST /api/courses/{course_id}/enroll/
Authorization: Bearer <token>
```

#### Get My Enrollments
```http
GET /api/courses/my-enrollments/
Authorization: Bearer <token>
```

#### Get Course Progress
```http
GET /api/courses/progress/{course_id}/
Authorization: Bearer <token>
```

#### Mark Module Complete
```http
POST /api/courses/{enrollment_id}/modules/{module_id}/complete/
Authorization: Bearer <token>
```

### Modules

#### List Modules
```http
GET /api/courses/modules/?course_id={course_id}
Authorization: Bearer <token>
```

#### Create Module
```http
POST /api/courses/modules/
Authorization: Bearer <token>
Content-Type: application/json

{
  "course": 1,
  "title": "Module 1: Introduction",
  "description": "Module description",
  "order": 1,
  "content_type": "video",
  "video_url": "https://example.com/video.mp4",
  "duration_minutes": 30
}
```

**Content Types:**
- `video`: Use `video_url`
- `pdf`: Use `pdf_file` (multipart/form-data)
- `link`: Use `external_link`
- `text`: Use `text_content`

### Assignments

#### List Assignments
```http
GET /api/assignments/?course_id={course_id}
Authorization: Bearer <token>
```

#### Create Assignment
```http
POST /api/assignments/
Authorization: Bearer <token>
Content-Type: application/json

{
  "course_id": 1,
  "title": "Assignment 1",
  "description": "Complete this assignment",
  "due_date": "2024-12-31T23:59:59Z",
  "max_score": 100
}
```

#### Submit Assignment
```http
POST /api/assignments/{assignment_id}/submit/
Authorization: Bearer <token>
Content-Type: multipart/form-data

{
  "submission_file": <file>,
  "submission_text": "Submission text"
}
```

#### Get My Submissions
```http
GET /api/assignments/my-submissions/
Authorization: Bearer <token>
```

#### Grade Submission
```http
POST /api/assignments/submissions/{submission_id}/grade/
Authorization: Bearer <token>
Content-Type: application/json

{
  "score": 85,
  "feedback": "Good work!"
}
```

### Quizzes

#### List Quizzes
```http
GET /api/quizzes/?course_id={course_id}
Authorization: Bearer <token>
```

#### Create Quiz
```http
POST /api/quizzes/
Authorization: Bearer <token>
Content-Type: application/json

{
  "course_id": 1,
  "title": "Quiz 1",
  "description": "Test your knowledge",
  "time_limit_minutes": 30,
  "passing_score": 60,
  "max_attempts": 3
}
```

#### Start Quiz
```http
POST /api/quizzes/{quiz_id}/start/
Authorization: Bearer <token>
```

#### Get Quiz Questions
```http
GET /api/quizzes/{quiz_id}/attempts/{attempt_id}/questions/
Authorization: Bearer <token>
```

#### Submit Quiz
```http
POST /api/quizzes/{quiz_id}/attempts/{attempt_id}/submit/
Authorization: Bearer <token>
Content-Type: application/json

{
  "answers": [
    {
      "question_id": 1,
      "choice_id": 2
    },
    {
      "question_id": 2,
      "choice_id": 5
    }
  ]
}
```

#### Get Quiz Results
```http
GET /api/quizzes/{quiz_id}/results/
Authorization: Bearer <token>
```

### Certificates

#### Generate Certificate
```http
POST /api/certificates/generate/{enrollment_id}/
Authorization: Bearer <token>
```

#### Download Certificate
```http
GET /api/certificates/{certificate_id}/download/
Authorization: Bearer <token>
```

#### Get My Certificates
```http
GET /api/certificates/my-certificates/
Authorization: Bearer <token>
```

### Announcements

#### List Announcements
```http
GET /api/announcements/?course_id={course_id}
Authorization: Bearer <token>
```

#### Create Announcement
```http
POST /api/announcements/
Authorization: Bearer <token>
Content-Type: application/json

{
  "course_id": 1,
  "title": "Important Announcement",
  "content": "Announcement content",
  "priority": "high"
}
```

#### Get Notifications
```http
GET /api/announcements/notifications/
Authorization: Bearer <token>
```

### Discussions

#### List Discussions
```http
GET /api/discussions/?course_id={course_id}
Authorization: Bearer <token>
```

#### Create Discussion
```http
POST /api/discussions/
Authorization: Bearer <token>
Content-Type: application/json

{
  "course_id": 1,
  "title": "Discussion Topic",
  "content": "Discussion content"
}
```

#### Create Comment
```http
POST /api/discussions/comments/
Authorization: Bearer <token>
Content-Type: application/json

{
  "discussion": 1,
  "content": "Comment text"
}
```

#### Reply to Comment
```http
POST /api/discussions/comments/{comment_id}/reply/
Authorization: Bearer <token>
Content-Type: application/json

{
  "content": "Reply text"
}
```

### Admin

#### List Users
```http
GET /api/auth/users/
Authorization: Bearer <token>
```

#### Approve Instructor
```http
PATCH /api/auth/users/{user_id}/approve/
Authorization: Bearer <token>
```

#### Block User
```http
PATCH /api/auth/users/{user_id}/block/
Authorization: Bearer <token>
```

#### Get Analytics
```http
GET /api/courses/analytics/
Authorization: Bearer <token>
```

## Error Responses

All endpoints may return error responses in the following format:

```json
{
  "error": "Error message",
  "detail": "Detailed error information"
}
```

**Common HTTP Status Codes:**
- `200 OK`: Success
- `201 Created`: Resource created
- `400 Bad Request`: Invalid request data
- `401 Unauthorized`: Authentication required
- `403 Forbidden`: Permission denied
- `404 Not Found`: Resource not found
- `500 Internal Server Error`: Server error

## Rate Limiting

Currently, there is no rate limiting implemented. Consider adding rate limiting for production use.

## Pagination

List endpoints support pagination:
- `page`: Page number
- `page_size`: Items per page (default: 20)

Response format:
```json
{
  "count": 100,
  "next": "http://localhost:8000/api/endpoint/?page=2",
  "previous": null,
  "results": [...]
}
```

