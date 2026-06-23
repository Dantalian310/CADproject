@echo off
setlocal
set ROOT=%~dp0..\..
set PG_BIN=%ROOT%\.local\postgresql-16.14\pgsql\bin
set PG_DATA=%ROOT%\.local\pgdata

echo pg_ctl status:
"%PG_BIN%\pg_ctl.exe" -D "%PG_DATA%" status
echo.
echo netstat status:
netstat -ano | findstr 5432
endlocal
