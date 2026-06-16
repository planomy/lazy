@echo off
cd /d "%~dp0"
powershell -NoProfile -Command "$s=(New-Object -ComObject WScript.Shell).CreateShortcut('%USERPROFILE%\Desktop\Lazy Laser.lnk'); $s.TargetPath='%~dp0Lazy Laser.exe'; $s.WorkingDirectory='%~dp0'; $s.IconLocation='%~dp0Lazy Laser.exe,0'; $s.Description='Lazy Laser pointer'; $s.Save()"
echo Desktop shortcut created: Lazy Laser.lnk
pause
