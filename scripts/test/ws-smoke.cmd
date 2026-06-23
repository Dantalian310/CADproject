@echo off
setlocal
node "%~dp0ws-smoke.mjs" %*
set EXIT_CODE=%ERRORLEVEL%
endlocal & exit /b %EXIT_CODE%
