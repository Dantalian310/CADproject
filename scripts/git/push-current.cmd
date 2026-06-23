@echo off
setlocal
if "%~1"=="" (
  echo Usage: push-current.cmd "commit message"
  exit /b 1
)
git status
git add .
git commit -m "%~1"
git push
