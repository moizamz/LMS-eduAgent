# Step 1: Login and get token
$login = Invoke-WebRequest -Uri "http://127.0.0.1:8000/api/auth/token/" -Method POST -ContentType "application/json" -Body '{"username":"syedaayeshawajahat@gmail.com","password":"seecs123"}'
$token = ($login.Content | ConvertFrom-Json).access
echo "Token: $token"

# Step 2: Hit export with token
$response = Invoke-WebRequest -Uri "http://127.0.0.1:8000/api/quizzes/6/export/?format=csv" -Method GET -Headers @{Authorization="Bearer $token"}
echo "Status: $($response.StatusCode)"
echo "Content: $($response.Content)"