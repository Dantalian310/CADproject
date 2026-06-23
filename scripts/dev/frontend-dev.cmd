@echo off
setlocal
cd /d "%~dp0..\..\frontend"
echo Starting Cloud CAD frontend: http://127.0.0.1:5173/
echo Keep this window open while developing. Press Ctrl+C to stop.
npm run dev
