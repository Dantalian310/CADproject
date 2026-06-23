@echo off
setlocal
for /f "tokens=5" %%p in ('netstat -ano ^| findstr ":8080" ^| findstr "LISTENING"') do (
  echo Stopping backend process %%p on port 8080
  taskkill /PID %%p /T /F
  if errorlevel 1 powershell -NoProfile -Command "Stop-Process -Id %%p -Force -ErrorAction SilentlyContinue"
)
endlocal