@echo off
rem Dubbelklikken of: restore.cmd [opties], zie scripts\restore.ps1
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\restore.ps1" %*
set EXITCODE=%ERRORLEVEL%
if not defined STREAMZ_NO_PAUSE pause
exit /b %EXITCODE%
