@echo off
cd /d "%~dp0"
node --version >nul 2>&1
if errorlevel 1 (
  echo Install Node.js 24 or later, then run this file again.
  pause
  exit /b 1
)
echo Starting Dreamcatcher Context at http://127.0.0.1:8788
node src/server.js
pause
