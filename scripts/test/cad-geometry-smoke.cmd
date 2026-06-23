@echo off
setlocal
node "%~dp0cad-geometry-smoke.mjs" %*
set EXIT_CODE=%ERRORLEVEL%
endlocal & exit /b %EXIT_CODE%
