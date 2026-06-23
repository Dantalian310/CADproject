@echo off
setlocal
call "%~dp0frontend-stop.cmd"
call "%~dp0backend-stop.cmd"
call "%~dp0postgres-stop.cmd"
endlocal