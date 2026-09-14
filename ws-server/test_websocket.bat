@echo off
title AlphaCapital WebSocket Gateway Automated Tester
echo ========================================================
echo   AlphaCapital Real-Time WebSocket Gateway Test Runner
echo ========================================================
cd /d "%~dp0"
node test_gateway.js
echo.
pause
