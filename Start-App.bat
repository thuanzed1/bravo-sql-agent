@echo off
chcp 65001 >nul
title BRAVO SQL Studio
cd /d "%~dp0"

echo ===================
echo   BRAVO SQL STUDIO 
echo ===================

where node >nul 2>&1
if errorlevel 1 (
    echo [LOI] Chua cai dat Node.js. Vui long cai Node.js LTS roi chay lai.
    pause
    exit /b 1
)

if not exist "node_modules" (
    echo [*] Phat hien lan chay dau tien - dang cai dat thu vien ^(npm install^)...
    call npm install
    if errorlevel 1 (
        echo [LOI] Cai dat thu vien that bai. Kiem tra ket noi mang roi thu lai.
        pause
        exit /b 1
    )
)

echo [*] Dang khoi chay he thong:
echo     - Backend Server : http://localhost:5000
echo     - Frontend Studio: http://localhost:5173
echo.

call npm run dev
if errorlevel 1 (
    echo.
    echo [LOI] Ung dung dung dot ngot. Neu dang mo san o cua so khac, hay tat cua so cu truoc.
    pause
)
