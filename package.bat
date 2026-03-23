@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0"

REM Requires JDK 17, Maven, Node.js on PATH
REM Skip frontend npm: package.bat skipnpm

set "EXTRA="
if /i "%~1"=="skipnpm" set "EXTRA=-Dskip.npm=true"

echo [package] mvn clean package -DskipTests %EXTRA%
echo.

call mvn clean package -DskipTests %EXTRA%
if errorlevel 1 (
    echo.
    echo [package] BUILD FAILED
    pause
    exit /b 1
)

echo.
echo [package] BUILD OK
echo [package] JAR: %cd%\target\iot-device-management-1.0.0-SNAPSHOT.jar
echo.
pause
exit /b 0
