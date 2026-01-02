# PowerShell script to fix migrations and set up database

Write-Host "=== LMS Database Setup Script ===" -ForegroundColor Green

# Step 1: Delete existing database
Write-Host "`nStep 1: Cleaning up existing database..." -ForegroundColor Yellow
if (Test-Path "db.sqlite3") {
    Remove-Item "db.sqlite3"
    Write-Host "  ✓ Deleted db.sqlite3" -ForegroundColor Green
} else {
    Write-Host "  ✓ No existing database found" -ForegroundColor Green
}

# Step 2: Delete existing migration files (except __init__.py)
Write-Host "`nStep 2: Cleaning up migration files..." -ForegroundColor Yellow
$migrationFiles = Get-ChildItem -Path . -Recurse -Filter "0*.py" | Where-Object { $_.Directory.Name -eq "migrations" }
if ($migrationFiles) {
    $migrationFiles | Remove-Item
    Write-Host "  ✓ Deleted existing migration files" -ForegroundColor Green
} else {
    Write-Host "  ✓ No existing migration files found" -ForegroundColor Green
}

# Step 3: Create migrations
Write-Host "`nStep 3: Creating migrations..." -ForegroundColor Yellow
python manage.py makemigrations
if ($LASTEXITCODE -eq 0) {
    Write-Host "  ✓ Migrations created successfully" -ForegroundColor Green
} else {
    Write-Host "  ✗ Error creating migrations" -ForegroundColor Red
    exit 1
}

# Step 4: Apply migrations
Write-Host "`nStep 4: Applying migrations..." -ForegroundColor Yellow
python manage.py migrate
if ($LASTEXITCODE -eq 0) {
    Write-Host "  ✓ Migrations applied successfully" -ForegroundColor Green
} else {
    Write-Host "  ✗ Error applying migrations" -ForegroundColor Red
    exit 1
}

Write-Host "`n=== Setup Complete! ===" -ForegroundColor Green
Write-Host "`nNext step: Create a superuser with:" -ForegroundColor Cyan
Write-Host "  python manage.py createsuperuser" -ForegroundColor White

