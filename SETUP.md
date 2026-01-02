# Complete Setup Guide

This guide will walk you through setting up the entire LMS system from scratch.

## Prerequisites

Before you begin, ensure you have the following installed:

- **Python 3.8+** - [Download Python](https://www.python.org/downloads/)
- **Node.js 14+** - [Download Node.js](https://nodejs.org/)
- **PostgreSQL** (Optional) - [Download PostgreSQL](https://www.postgresql.org/download/)
- **Git** - [Download Git](https://git-scm.com/downloads)

## Step-by-Step Setup

### 1. Clone or Download the Project

```bash
cd "C:\Users\abdul\Documents\Personal Documents\LMS"
```

### 2. Backend Setup

#### 2.1 Navigate to Backend Directory
```bash
cd backend
```

#### 2.2 Create Virtual Environment
```bash
python -m venv venv
```

#### 2.3 Activate Virtual Environment
- **Windows (PowerShell):**
  ```powershell
  .\venv\Scripts\Activate.ps1
  ```
- **Windows (CMD):**
  ```cmd
  venv\Scripts\activate.bat
  ```
- **Linux/Mac:**
  ```bash
  source venv/bin/activate
  ```

#### 2.4 Install Python Dependencies
```bash
pip install -r requirements.txt
```

#### 2.5 Configure Environment
Create a `.env` file in the `backend` directory:

```env
SECRET_KEY=django-insecure-change-this-in-production-key
DEBUG=True
ALLOWED_HOSTS=localhost,127.0.0.1
USE_SQLITE=True
```

For PostgreSQL (optional):
```env
DB_NAME=lms_db
DB_USER=postgres
DB_PASSWORD=postgres
DB_HOST=localhost
DB_PORT=5432
USE_SQLITE=False
```

#### 2.6 Run Database Migrations
```bash
python manage.py makemigrations
python manage.py migrate
```

#### 2.7 Create Superuser (Admin)
```bash
python manage.py createsuperuser
```
Follow the prompts to create an admin account.

#### 2.8 Start Backend Server
```bash
python manage.py runserver
```

The backend API will be available at `http://localhost:8000`

### 3. Frontend Setup

#### 3.1 Open a New Terminal
Keep the backend server running, and open a new terminal window.

#### 3.2 Navigate to Frontend Directory
```bash
cd frontend
```

#### 3.3 Install Node Dependencies
```bash
npm install
```

#### 3.4 Start Frontend Development Server
```bash
npm start
```

The frontend will automatically open at `http://localhost:3000`

## Initial Setup Complete!

You should now have:
- ✅ Backend running on `http://localhost:8000`
- ✅ Frontend running on `http://localhost:3000`

## First Steps After Setup

### 1. Access the Application
- Open your browser and go to `http://localhost:3000`
- You should see the login page

### 2. Create Test Users

#### Option A: Using Django Admin
1. Go to `http://localhost:8000/admin`
2. Login with your superuser credentials
3. Navigate to Users
4. Create new users with different roles

#### Option B: Using Registration Page
1. Go to `http://localhost:3000/register`
2. Register as:
   - **Student**: Select "Student" role
   - **Instructor**: Select "Instructor" role (needs admin approval)

### 3. Approve Instructor (if needed)
1. Login as admin
2. Go to Admin Panel
3. Find pending instructors
4. Click "Approve"

### 4. Create Your First Course
1. Login as an approved instructor
2. Go to Instructor Panel
3. Click "Create Course"
4. Fill in course details
5. Add modules, assignments, and quizzes

## Troubleshooting

### Backend Issues

**Problem: ModuleNotFoundError**
- Solution: Ensure virtual environment is activated and dependencies are installed

**Problem: Database connection error**
- Solution: Check database settings in `.env` file or use SQLite by setting `USE_SQLITE=True`

**Problem: Migration errors**
- Solution: Delete `db.sqlite3` and migration files in app folders, then run migrations again

### Frontend Issues

**Problem: npm install fails**
- Solution: Try deleting `node_modules` and `package-lock.json`, then run `npm install` again

**Problem: API connection errors**
- Solution: Ensure backend is running on port 8000 and check CORS settings

**Problem: Port already in use**
- Solution: Change port in `package.json` or kill the process using the port

## Development Workflow

1. **Backend Changes**: Restart Django server after model changes
2. **Frontend Changes**: React hot-reloads automatically
3. **Database Changes**: Run migrations after model changes
4. **New Dependencies**: Update `requirements.txt` or `package.json`

## Testing the System

1. **Create a Course** (as instructor)
2. **Enroll in Course** (as student)
3. **Complete Modules** (as student)
4. **Submit Assignment** (as student)
5. **Grade Assignment** (as instructor)
6. **Take Quiz** (as student)
7. **Generate Certificate** (as student after completion)

## Next Steps

- Customize the UI theme
- Add more course content
- Configure email settings for password reset
- Set up production database
- Deploy to production server

## Support

If you encounter any issues:
1. Check the error messages in the terminal
2. Review the logs
3. Check database connectivity
4. Verify environment variables

Happy Learning! 🎓

