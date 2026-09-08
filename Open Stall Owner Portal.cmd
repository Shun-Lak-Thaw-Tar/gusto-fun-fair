@echo off
setlocal
cd /d "%~dp0"
if not exist "stall owner\package.json" goto missing

echo Starting the Fun Fair database and backend...
cd /d "%~dp0Admin"
node scripts/start-local.mjs
if errorlevel 1 goto failed

cd /d "%~dp0stall owner"
if not exist "node_modules" call npm.cmd install --no-audit --no-fund
if errorlevel 1 goto failed

echo Starting the Stall Owner Portal...
start "Stall Owner Portal" cmd /c node node_modules\vite\bin\vite.js --host 127.0.0.1 --port 5174 --strictPort
timeout /t 5 /nobreak >nul
start "" "http://127.0.0.1:5174/login"
echo Stall Owner Portal: http://127.0.0.1:5174/login
exit /b 0

:missing
echo Could not find the "stall owner" folder next to this file.
pause
exit /b 1

:failed
echo The Stall Owner Portal could not start. Please check the message above.
pause
exit /b 1
