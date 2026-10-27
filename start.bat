@echo off
cd /d "%~dp0"
title CapiReal
if not exist node_modules (
  echo [CapiReal] First run: installing packages...
  call npm install
  if errorlevel 1 (
    echo npm install failed.
    pause
    exit /b 1
  )
)
echo [CapiReal] Starting at http://localhost:3000  (close this window to stop)
call npm run dev
pause
