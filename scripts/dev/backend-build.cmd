@echo off
setlocal
cd /d "%~dp0..\..\backend"
set DB_URL=jdbc:postgresql://127.0.0.1:5432/cloudcad
set DB_USERNAME=cloudcad
set DB_PASSWORD=cloudcad_dev_password
mvn -DskipTests package
