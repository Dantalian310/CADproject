@echo off
setlocal
if "%~1"=="" (
  echo Usage: setup-remote.cmd ^<git-remote-url^>
  exit /b 1
)
git remote remove origin 2>nul
git remote add origin "%~1"
git branch -M main
git remote -v
