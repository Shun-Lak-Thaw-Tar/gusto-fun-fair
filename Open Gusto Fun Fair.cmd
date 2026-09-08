@echo off
setlocal
cd /d "%~dp0"
if exist "Admin\scripts\start-local.mjs" goto found_admin
if exist "client\scripts\start-local.mjs" goto found_client
echo Could not find the website folder next to this file.
echo Expected a folder named Admin ^(or client^) that contains scripts\start-local.mjs.
pause
exit /b 1

:found_admin
cd /d "%~dp0Admin"
goto run

:found_client
cd /d "%~dp0client"

:run
echo Starting Gusto Fun Fair...
node scripts/start-local.mjs
if errorlevel 1 (
  echo Website could not start. Please check the message above.
  pause
  exit /b 1
)
start "" "http://127.0.0.1:5173/admin/login"
endlocal
