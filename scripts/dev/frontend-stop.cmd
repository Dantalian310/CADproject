@echo off
setlocal
for /f "tokens=5" %%p in ('netstat -ano ^| findstr "127.0.0.1:5173" ^| findstr "LISTENING"') do (
  echo Stopping frontend process %%p on port 5173
  taskkill /PID %%p /T /F
  if errorlevel 1 powershell -NoProfile -Command "Stop-Process -Id %%p -Force -ErrorAction SilentlyContinue"
)
endlocal