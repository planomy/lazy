@echo off
cd /d "%~dp0"
echo Starting Lazy Laser...
start "" "Lazy Laser.exe"
timeout /t 4 /nobreak >nul
if exist "lazy-started.txt" goto started
if exist "%USERPROFILE%\Desktop\lazy-started.txt" goto started
if exist "%USERPROFILE%\OneDrive\Desktop\lazy-started.txt" goto started
tasklist /FI "IMAGENAME eq Lazy Laser.exe" 2>nul | find /I "Lazy Laser.exe" >nul && goto started
echo.
echo Lazy Laser did not start. Check Windows Security / antivirus.
echo.
goto end
:started
echo.
echo Lazy Laser IS running.
echo   - Press Alt+Tab and look for "Lazy Laser"
echo   - Or click it on the taskbar
echo   - Or press F8 to turn the laser on
echo.
:end
pause
