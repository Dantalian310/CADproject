@echo off
setlocal
cd /d "%~dp0..\..\backend"
set DB_URL=jdbc:postgresql://127.0.0.1:5432/cloudcad
set DB_USERNAME=cloudcad
set DB_PASSWORD=cloudcad_dev_password
echo Building Spring Boot executable jar for deployment...
for /f "tokens=5" %%p in ('netstat -ano ^| findstr ":8080" ^| findstr "LISTENING"') do (
  echo Backend is running on port 8080 with PID %%p.
  echo Stop the local backend first, then run scripts\dev\backend-build.cmd again.
  echo Tip: use scripts\dev\local-stop.cmd, or close the backend Java process from Task Manager if Windows denies taskkill.
  exit /b 1
)
mvn -DskipTests clean package
if errorlevel 1 exit /b %errorlevel%
echo Backend jar: %CD%\target\cloudcad-backend-0.1.0-SNAPSHOT.jar
