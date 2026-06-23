@echo off
setlocal

echo === PostgreSQL 5432 ===
netstat -ano | findstr "127.0.0.1:5432" | findstr "LISTENING"
echo.

echo === Backend 8080 ===
netstat -ano | findstr ":8080" | findstr "LISTENING"
powershell -NoProfile -ExecutionPolicy Bypass -Command "try { 'Backend health: ' + (Invoke-RestMethod -TimeoutSec 5 http://127.0.0.1:8080/actuator/health).status } catch { 'Backend health failed: ' + $_.Exception.Message }"
echo.

echo === Frontend 5173 ===
netstat -ano | findstr "127.0.0.1:5173" | findstr "LISTENING"
powershell -NoProfile -ExecutionPolicy Bypass -Command "try { 'Frontend HTTP status: ' + (Invoke-WebRequest -UseBasicParsing -TimeoutSec 5 http://127.0.0.1:5173/).StatusCode } catch { 'Frontend request failed: ' + $_.Exception.Message }"
echo.

echo Frontend URL: http://127.0.0.1:5173/
echo Backend health URL: http://127.0.0.1:8080/actuator/health
endlocal
