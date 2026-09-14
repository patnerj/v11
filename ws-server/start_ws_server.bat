@echo off
title AlphaCapital Real-Time WebSocket Gateway
echo ========================================================
echo   AlphaCapital Enterprise Real-Time WebSocket Gateway
echo ========================================================
cd /d "%~dp0"
if not exist node_modules (
  echo Installing dependencies...
  call npm install
)
echo Starting WebSocket server on port 8080...
node index.js
pause
