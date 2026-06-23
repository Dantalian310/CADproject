@echo off
setlocal
set ROOT=%~dp0..\..
set BACKEND=%ROOT%\backend
set JAR=%BACKEND%\target\cloudcad-backend-0.1.0-SNAPSHOT.jar

set DB_URL=jdbc:postgresql://127.0.0.1:5432/cloudcad
set DB_USERNAME=cloudcad
set DB_PASSWORD=cloudcad_dev_password
set CORS_ALLOWED_ORIGINS=http://localhost:5173,http://127.0.0.1:5173

cd /d "%BACKEND%"
java -jar "%JAR%"
endlocal
