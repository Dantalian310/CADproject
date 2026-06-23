@echo off
setlocal
set ROOT=%~dp0..\..
set PG_BIN=%ROOT%\.local\postgresql-16.14\pgsql\bin
set PG_DATA=%ROOT%\.local\pgdata
set PG_LOG=%ROOT%\.local\postgresql.log

if not exist "%PG_BIN%\postgres.exe" (
  echo PostgreSQL binaries not found: %PG_BIN%
  exit /b 1
)

"%PG_BIN%\pg_ctl.exe" -D "%PG_DATA%" status >NUL 2>NUL
if "%ERRORLEVEL%"=="0" (
  echo PostgreSQL is already running.
  exit /b 0
)

"%PG_BIN%\pg_ctl.exe" -D "%PG_DATA%" -l "%PG_LOG%" start
endlocal
