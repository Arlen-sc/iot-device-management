@echo off
setlocal

REM No-args: use PowerShell interactive mode with Chinese prompts.
if "%~1"=="" (
  powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0generate-license.ps1"
  exit /b %ERRORLEVEL%
)

REM Args mode: pass through to node script.
node "%~dp0license-generator.cjs" %*
set "EXIT_CODE=%ERRORLEVEL%"

REM Return real exit code.
exit /b %EXIT_CODE%
