@echo off
rem Dubbelklikken of: start.cmd [opties], zie start.ps1
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0start.ps1" %*
set EXITCODE=%ERRORLEVEL%
if not defined STREAMZ_NO_PAUSE pause
exit /b %EXITCODE%
