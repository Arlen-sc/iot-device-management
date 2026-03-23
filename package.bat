@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0"

REM 需已安装 JDK 17、Maven、Node.js（PATH 可找到 java / mvn / npm）
REM 可选：只改后端、跳过前端 npm 时执行: package.bat skipnpm
set "EXTRA="
if /i "%~1"=="skipnpm" set "EXTRA=-Dskip.npm=true"

echo [package] 执行: mvn clean package -DskipTests %EXTRA%
echo.

call mvn clean package -DskipTests %EXTRA%
if errorlevel 1 (
    echo.
    echo [package] 打包失败
    pause
    exit /b 1
)

echo.
echo [package] 打包成功
echo [package] 产物: %cd%\target\iot-device-management-1.0.0-SNAPSHOT.jar
echo.
pause
exit /b 0
