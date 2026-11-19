@echo off
rem Dubbelklikken of: upgrade.cmd [opties], zie scripts\upgrade.ps1
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\upgrade.ps1" %*
set EXITCODE=%ERRORLEVEL%
if not defined STREAMZ_NO_PAUSE pause
exit /b %EXITCODE%
