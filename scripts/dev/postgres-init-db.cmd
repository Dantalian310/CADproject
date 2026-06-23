@echo off
setlocal
set ROOT=%~dp0..\..
set PG_BIN=%ROOT%\.local\postgresql-16.14\pgsql\bin
set PG_DATA=%ROOT%\.local\pgdata
set PGPASSWORD=cloudcad_dev_password

if not exist "%PG_DATA%\PG_VERSION" (
  echo PostgreSQL data directory not initialized: %PG_DATA%
  echo Please run the prepared installation/init step first.
  exit /b 1
)

"%PG_BIN%\psql.exe" -h 127.0.0.1 -p 5432 -U cloudcad -d postgres -tc "select 1 from pg_database where datname = 'cloudcad'" | findstr 1 >nul
if errorlevel 1 (
  "%PG_BIN%\psql.exe" -h 127.0.0.1 -p 5432 -U cloudcad -d postgres -c "create database cloudcad encoding 'UTF8';"
)

"%PG_BIN%\psql.exe" -h 127.0.0.1 -p 5432 -U cloudcad -d cloudcad -tc "select 1 from information_schema.tables where table_schema='public' and table_name='users'" | findstr 1 >nul
if errorlevel 1 (
  "%PG_BIN%\psql.exe" -h 127.0.0.1 -p 5432 -U cloudcad -d cloudcad -v ON_ERROR_STOP=1 -f "%ROOT%\backend\src\main\resources\db\migration\V1__init_schema.sql"
) else (
  echo cloudcad schema already exists, skip migration script.
)
endlocal
