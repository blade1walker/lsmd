@echo off
title Nexus EMS Bot Updater
echo ==============================================
echo Updating Nexus EMS Bot
echo ==============================================
echo Installing dependencies...
call npm install
echo Building TypeScript source...
call npm run build
echo ==============================================
echo Starting bot...
echo ==============================================
call npm start
pause
