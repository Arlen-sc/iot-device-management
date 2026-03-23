@echo off
chcp 65001 >nul
setlocal EnableDelayedExpansion
cd /d "%~dp0"

REM 启动已打包的可执行 JAR（需先执行 package.bat）
REM 可选 JVM 参数：set JAVA_OPTS=-Xms256m -Xmx512m 后再运行本脚本

set "JAR=%cd%\target\iot-device-management-1.0.0-SNAPSHOT.jar"
if not exist "%JAR%" (
    echo [start] 未找到: %JAR%
    echo [start] 请先在本目录运行 package.bat 完成打包
    pause
    exit /b 1
)

echo [start] 启动: %JAR%
echo.
java %JAVA_OPTS% -jar "%JAR%"
set "EC=!ERRORLEVEL!"
echo.
echo [start] 进程已结束，退出码: !EC!
pause
exit /b !EC!
