# How to Run the LMS Application

Complete step-by-step guide to run both backend and frontend.

## Prerequisites

Make sure you have:
- ✅ Python 3.8+ installed
- ✅ Node.js 14+ installed
- ✅ pip (comes with Python)
- ✅ npm (comes with Node.js)

## Quick Start (Two Terminal Windows)

You need **TWO terminal windows** - one for backend, one for frontend.

---

## Step 1: Start the Backend (Terminal 1)

### 1.1 Open PowerShell/Terminal
Navigate to your project directory:
```powershell
cd "C:\Users\abdul\Documents\Personal Documents\LMS\backend"
```

### 1.2 Activate Virtual Environment
```powershell
.\venv\Scripts\Activate.ps1
```

**Note:** If you get an execution policy error, run this first:
```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

**Alternative (if above doesn't work):**
```cmd
venv\Scripts\activate.bat
```

### 1.3 Install Dependencies (if not already installed)
```powershell
pip install -r requirements.txt
```

### 1.4 Run Database Migrations (if not already done)
```powershell
python manage.py migrate
```

### 1.5 Start the Backend Server
```powershell
python manage.py runserver
```

✅ **Backend is now running at:** `http://localhost:8000`

**Keep this terminal window open!**

---

## Step 2: Start the Frontend (Terminal 2)

### 2.1 Open a NEW PowerShell/Terminal Window
Navigate to the frontend directory:
```powershell
cd "C:\Users\abdul\Documents\Personal Documents\LMS\frontend"
```

### 2.2 Install Dependencies (if not already installed)
```powershell
npm install
```

### 2.3 Start the Frontend Development Server
```powershell
npm start
```

✅ **Frontend will automatically open at:** `http://localhost:3000`

**Keep this terminal window open too!**

---

## Step 3: Access the Application

1. **Frontend (Main App):** Open your browser and go to:
   ```
   http://localhost:3000
   ```
   You'll see the beautiful new login page! 🎨

2. **Backend API:** Available at:
   ```
   http://localhost:8000/api
   ```

3. **Admin Panel:** Available at:
   ```
   http://localhost:8000/admin
   ```

---

## First Time Setup (If Needed)

### Create an Admin User

If you haven't created a superuser yet, in **Terminal 1** (backend), run:
```powershell
python manage.py createsuperuser
```

Follow the prompts to create an admin account.

---

## Complete Command Summary

### Backend (Terminal 1)
```powershell
cd backend
.\venv\Scripts\Activate.ps1
python manage.py runserver
```

### Frontend (Terminal 2)
```powershell
cd frontend
npm start
```

---

## Troubleshooting

### ❌ Backend Issues

**Problem: "ModuleNotFoundError"**
- Solution: Make sure virtual environment is activated and run `pip install -r requirements.txt`

**Problem: "Port 8000 already in use"**
- Solution: Kill the process using port 8000 or run on a different port:
  ```powershell
  python manage.py runserver 8001
  ```
  Then update `frontend/package.json` proxy to `http://localhost:8001`

**Problem: "Database errors"**
- Solution: Delete `backend/db.sqlite3` and run:
  ```powershell
  python manage.py migrate
  ```

**Problem: "Execution policy error"**
- Solution: Run in PowerShell:
  ```powershell
  Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
  ```

### ❌ Frontend Issues

**Problem: "npm install fails"**
- Solution: Delete `node_modules` and `package-lock.json`, then:
  ```powershell
  npm install
  ```

**Problem: "Port 3000 already in use"**
- Solution: React will automatically use port 3001, or kill the process using port 3000

**Problem: "Cannot connect to backend"**
- Solution: Make sure backend is running on port 8000, check CORS settings

**Problem: "Module not found errors"**
- Solution: Run `npm install` again in the frontend directory

---

## Stopping the Application

1. **Stop Backend:** In Terminal 1, press `Ctrl + C`
2. **Stop Frontend:** In Terminal 2, press `Ctrl + C`

---

## Development Tips

- ✅ Backend auto-reloads on code changes
- ✅ Frontend hot-reloads automatically (no refresh needed!)
- ✅ Keep both terminals open while developing
- ✅ Check terminal output for errors

---

## What You Should See

1. **Backend Terminal:** Shows Django server running with request logs
2. **Frontend Terminal:** Shows React dev server and compilation status
3. **Browser:** Beautiful login page with animated gradient background! 🎉

---

## Next Steps

1. **Register a new account** at `http://localhost:3000/register`
2. **Login** with your credentials
3. **Create courses** (as instructor)
4. **Enroll in courses** (as student)
5. **Explore the features!**

---

## Quick Reference

| Service | URL | Port |
|---------|-----|------|
| Frontend | http://localhost:3000 | 3000 |
| Backend API | http://localhost:8000/api | 8000 |
| Admin Panel | http://localhost:8000/admin | 8000 |

---

**That's it! Your LMS is now running! 🚀**

