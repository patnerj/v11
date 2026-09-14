@echo off
title AlphaCapital WebSocket Gateway (PM2 Manager)
echo ========================================================
echo   AlphaCapital Enterprise WebSocket Gateway under PM2
echo ========================================================
cd /d "%~dp0"
if not exist node_modules (
  echo Installing dependencies...
  call npm install
)
call pm2 start ecosystem.config.js
call pm2 status
echo.
echo WebSocket Gateway is running in the background via PM2!
echo View logs with: pm2 logs fxsim-ws-gateway
echo Stop server with: pm2 stop ecosystem.config.js
pause
