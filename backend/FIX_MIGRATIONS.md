# Fix Migration Issues

## Step 1: Delete Existing Database (if exists)
If you have an existing `db.sqlite3` file, delete it:
```powershell
Remove-Item db.sqlite3 -ErrorAction SilentlyContinue
```

## Step 2: Delete All Migration Files (except __init__.py)
```powershell
# Delete migration files but keep __init__.py
Get-ChildItem -Path . -Recurse -Filter "*.py" | Where-Object { $_.Directory.Name -eq "migrations" -and $_.Name -ne "__init__.py" } | Remove-Item
```

## Step 3: Run Makemigrations
```powershell
python manage.py makemigrations accounts
python manage.py makemigrations courses
python manage.py makemigrations assignments
python manage.py makemigrations quizzes
python manage.py makemigrations announcements
python manage.py makemigrations discussions
python manage.py makemigrations certificates
```

## Step 4: Run Migrate
```powershell
python manage.py migrate
```

## Step 5: Create Superuser
```powershell
python manage.py createsuperuser
```

## Alternative: One Command to Create All Migrations
```powershell
python manage.py makemigrations
python manage.py migrate
```

