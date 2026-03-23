@echo off
chcp 65001 >nul
setlocal EnableDelayedExpansion
cd /d "%~dp0"

REM Optional env:
REM   SERVER_PORT   - port to free before start, default 8080
REM   JAVA_OPTS     - JVM options
REM   SKIP_NPM=1    - skip web-app npm build
REM   SKIP_MVN=1    - skip mvn package after npm, run existing JAR as-is

set "ROOT=%cd%"
set "JAR=%ROOT%\target\iot-device-management-1.0.0-SNAPSHOT.jar"
set "APP_PORT=8080"
if defined SERVER_PORT set "APP_PORT=%SERVER_PORT%"

REM --- Stop process listening on APP_PORT so old Java release the port ---
echo [start] Free port %APP_PORT% if in use...
for /f "tokens=5" %%a in ('netstat -ano 2^>nul ^| findstr ":%APP_PORT%" ^| findstr LISTENING') do (
    echo [start] taskkill /PID %%a
    taskkill /F /PID %%a 2>nul
)

REM --- Frontend: Vite build into src/main/resources/static ---
if defined SKIP_NPM (
    echo [start] SKIP_NPM set, skip npm run build
) else (
    if not exist "%ROOT%\web-app\package.json" (
        echo [start] web-app\package.json missing, skip npm
    ) else (
        pushd "%ROOT%\web-app"
        if not exist "node_modules" (
            echo [start] npm install...
            call npm install --no-fund --no-audit
            if errorlevel 1 (
                echo [start] npm install failed
                popd
                pause
                exit /b 1
            )
        )
        echo [start] npm run build...
        call npm run build
        set "NPMERR=!ERRORLEVEL!"
        popd
        if not "!NPMERR!"=="0" (
            echo [start] npm run build failed
            pause
            exit /b 1
        )
    )
)

REM --- Repackage JAR so new static files are inside the fat JAR ---
if defined SKIP_MVN (
    echo [start] SKIP_MVN set, skip mvn package
) else (
    echo [start] mvn package -DskipTests -Dskip.npm=true ...
    call mvn package -DskipTests -Dskip.npm=true
    if errorlevel 1 (
        echo [start] mvn package failed
        pause
        exit /b 1
    )
)

if not exist "%JAR%" (
    echo [start] JAR not found:
    echo        %JAR%
    echo [start] Run package.bat or clear SKIP_MVN to build.
    pause
    exit /b 1
)

echo [start] Launching:
echo        %JAR%
echo.
java %JAVA_OPTS% -jar "%JAR%"
set "EC=!ERRORLEVEL!"
echo.
echo [start] Process ended, exit code: !EC!
pause
exit /b !EC!
