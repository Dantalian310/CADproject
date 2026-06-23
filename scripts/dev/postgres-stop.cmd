@echo off
setlocal
set ROOT=%~dp0..\..
set PG_BIN=%ROOT%\.local\postgresql-16.14\pgsql\bin
set PG_DATA=%ROOT%\.local\pgdata

"%PG_BIN%\pg_ctl.exe" -D "%PG_DATA%" stop -m fast
if errorlevel 1 (
  for /f "tokens=5" %%p in ('netstat -ano ^| findstr "127.0.0.1:5432" ^| findstr "LISTENING"') do (
    echo Stopping PostgreSQL process %%p detected on 127.0.0.1:5432
    taskkill /PID %%p /T /F
  )
)
endlocal
