@echo off
setlocal

set "SCRIPT_DIR=%~dp0"
set "PROJECT_DIR=%SCRIPT_DIR%.."

wscript "%SCRIPT_DIR%start-quiet-progress.vbs"

timeout /t 2 /nobreak >nul

start "" "http://localhost:3000"

endlocal