@echo off
setlocal
chcp 65001 >nul
cd /d "%~dp0"
title Anasym local
echo Starting... progress is written to start.log
call :main > start.log 2>&1
type start.log
echo.
pause
exit /b

:main
echo [%date% %time%] start
where node || (echo [ERROR] Node.js not found & exit /b 1)
node --version
set "PY="
py -3.12 --version && set "PY=py -3.12"
if not defined PY (python --version && set "PY=python")
if not defined PY (echo [ERROR] Python not found & exit /b 1)
echo Using %PY%

where code && start "" code "%~dp0."

if not exist "backend\.venv\Scripts\python.exe" (
  echo === Creating Python venv ===
  %PY% -m venv backend\.venv || exit /b 1
)
backend\.venv\Scripts\python.exe -c "import django, rest_framework, dotenv, corsheaders" 2>nul || (
  echo === Installing Python packages ===
  findstr /v /i "psycopg" backend\requirements.txt > backend\.venv\requirements-local.txt
  backend\.venv\Scripts\python.exe -m pip install -r backend\.venv\requirements-local.txt || exit /b 1
)
if not exist "frontend\node_modules\vite\bin\vite.js" (
  echo === Installing frontend packages ===
  call npm --prefix frontend ci || exit /b 1
)
echo === Starting site ===
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\launch.ps1 -UseSqlite -SeedDemo || (echo [ERROR] launch failed & exit /b 1)
start "" http://127.0.0.1:5173
echo DONE. Site: http://127.0.0.1:5173
exit /b 0
