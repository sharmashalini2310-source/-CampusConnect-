@echo off
title CampusConnect Setup and Server
cd /d "%~dp0"
if not exist .env (
  copy .env.example .env >nul
  echo Created .env from .env.example
)
if not exist node_modules (
  echo Installing packages for first run...
  call npm install
  if errorlevel 1 pause & exit /b 1
)
echo.
echo Starting CampusConnect...
echo Keep this window open while using the website.
echo Open http://localhost:5000 in your browser.
echo.
call npm run dev
pause
