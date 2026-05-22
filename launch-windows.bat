@echo off
SETLOCAL EnableDelayedExpansion

echo ==========================================
echo    MagnetFinder - Initializing...
echo ==========================================

:: Check if Node.js is installed
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Node.js is not installed!
    echo Please install it from https://nodejs.org/
    pause
    exit /b
)

:: Install dependencies if node_modules doesn't exist
if not exist "node_modules\" (
    echo [INFO] First time use: Installing components...
    npm install --production
)

echo [OK] Launching application...
echo.
node start.js

pause
