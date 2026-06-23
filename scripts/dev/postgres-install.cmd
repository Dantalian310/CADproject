@echo off
setlocal
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0postgres-install.ps1" %*
endlocal
