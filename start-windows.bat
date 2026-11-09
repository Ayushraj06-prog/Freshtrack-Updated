@echo off
title FreshTrack Kitchen Manager
echo ===================================================
echo   FreshTrack - Zero Waste Kitchen & SQLite DB
echo ===================================================
echo.

REM Check if Node.js is installed
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Node.js is not installed or not in your PATH.
    echo Please install Node.js v20 or v22 from https://nodejs.org
    echo.
    pause
    exit /b 1
)

REM Check if node_modules exists, if not install
if not exist "node_modules" (
    echo [SETUP] First-time setup: Installing dependencies...
    call npm install
    if %errorlevel% neq 0 (
        echo [ERROR] Failed to install dependencies.
        pause
        exit /b 1
    )
)

echo [STARTING] Launching FreshTrack server on http://localhost:3000 ...
echo Database: SQLite (data\freshtrack.db)
echo.
echo Press Ctrl+C in this window anytime to stop the server.
echo.

REM Open browser after 2 seconds
start "" cmd /c "timeout /t 2 /nobreak >nul && start http://localhost:3000"

REM Run development server
call npm run dev

pause
