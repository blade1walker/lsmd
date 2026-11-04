@echo off
title LSMD Oracle VM Manager
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\vm-manager.ps1" %*
