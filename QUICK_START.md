# Quick Start Guide

Get the LMS up and running in 5 minutes!

## Prerequisites Check

```bash
python --version  # Should be 3.8+
node --version    # Should be 14+
npm --version     # Should come with Node.js
```

## Quick Setup (SQLite - Easiest)

### 1. Backend (Terminal 1)

```bash
cd backend
python -m venv venv
venv\Scripts\activate  # Windows
# OR
source venv/bin/activate  # Linux/Mac

pip install -r requirements.txt
python manage.py migrate
python manage.py createsuperuser
python manage.py runserver
```

### 2. Frontend (Terminal 2)

```bash
cd frontend
npm install
npm start
```

## First Steps

1. **Open** `http://localhost:3000`
2. **Register** as a student or instructor
3. **Login** as admin at `http://localhost:8000/admin` to approve instructors
4. **Create** your first course (as instructor)
5. **Enroll** and start learning (as student)

## Default URLs

- Frontend: http://localhost:3000
- Backend API: http://localhost:8000/api
- Admin Panel: http://localhost:8000/admin

## Common Commands

### Backend
```bash
python manage.py makemigrations  # Create migrations
python manage.py migrate         # Apply migrations
python manage.py createsuperuser # Create admin
python manage.py runserver       # Start server
```

### Frontend
```bash
npm install    # Install dependencies
npm start      # Start dev server
npm run build  # Build for production
```

## Troubleshooting

**Port 8000 in use?**
```bash
python manage.py runserver 8001
```

**Port 3000 in use?**
- React will automatically use 3001

**Database errors?**
- Delete `db.sqlite3` and run migrations again

**Module not found?**
- Activate virtual environment
- Run `pip install -r requirements.txt`

That's it! You're ready to go! 🚀

