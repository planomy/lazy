@echo off
cd /d "%~dp0"
echo Starting Lazy Laser...
start "" "Lazy Laser.exe"
timeout /t 3 /nobreak >nul
if exist "%USERPROFILE%\Desktop\lazy-started.txt" (
  echo Lazy Laser started. Look for the small control window.
) else (
  echo.
  echo Lazy Laser did not start. Windows may be blocking it.
  echo Try: right-click Lazy Laser.exe -^> Properties -^> Unblock
  echo Or allow it in Windows Security / antivirus.
  echo.
)
pause
