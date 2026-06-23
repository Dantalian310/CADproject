@echo off
setlocal
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0local-start.ps1"
endlocal