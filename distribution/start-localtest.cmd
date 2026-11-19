@echo off
rem Dubbelklikken of: start-localtest.cmd [opties], zie scripts\start-localtest.ps1
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\start-localtest.ps1" %*
set EXITCODE=%ERRORLEVEL%
if not defined STREAMZ_NO_PAUSE pause
exit /b %EXITCODE%
