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
powershell -NoProfile -ExecutionPolicy Bypass -Command "Add-Type -AssemblyName System.IO.Compression.FileSystem; if (-not (Test-Path -LiteralPath '%JAR%')) { Write-Error 'Backend jar not found. Run scripts\dev\backend-build.cmd first.'; exit 2 }; $zip = [System.IO.Compression.ZipFile]::OpenRead('%JAR%'); try { $isBootJar = $zip.Entries | Where-Object { $_.FullName -eq 'BOOT-INF/classes/com/cloudcad/CloudCadApplication.class' }; if (-not $isBootJar) { Write-Error 'Backend jar is not a Spring Boot executable jar. Run scripts\dev\backend-build.cmd to rebuild it.'; exit 3 } } finally { $zip.Dispose() }"
if errorlevel 1 exit /b %errorlevel%
java -jar "%JAR%"
endlocal
