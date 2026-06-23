@echo off
setlocal enabledelayedexpansion

set "SCRIPT_DIR=%~dp0"
set "JAVA_HOME=C:\Users\Administrator\AppData\Local\Java\zulu17.50.19-ca-jdk17.0.11-win_x64"
set "ANDROID_HOME=C:\Users\Administrator\AppData\Local\Android\Sdk"
set "NODE_DIR=C:\Users\Administrator\AppData\Local\Programs\kimi-desktop\resources\resources\runtime"
set "GRADLE_OPTS=-Dorg.gradle.daemon=false"

set "PATH=%JAVA_HOME%\bin;%NODE_DIR%;%PATH%"

cd /d "%SCRIPT_DIR%"

echo ====================================
echo   EasyText APK 一键打包
echo ====================================
echo.

echo [1/4] 构建前端 dist...
call "%NODE_DIR%\npm.cmd" run build
if errorlevel 1 (
    echo [X] 前端构建失败
    pause
    exit /b 1
)
echo [OK] 前端构建完成
echo.

echo [2/4] 同步到 Capacitor Android...
call "%NODE_DIR%\npx.cmd" cap sync android
if errorlevel 1 (
    echo [X] Capacitor 同步失败
    pause
    exit /b 1
)
echo [OK] 同步完成
echo.

echo [3/4] 构建 Debug APK...
cd /d "%SCRIPT_DIR%android"
call gradlew assembleDebug --no-daemon
if errorlevel 1 (
    echo [X] APK 构建失败
    pause
    exit /b 1
)
echo [OK] APK 构建完成
echo.

echo [4/4] 复制 APK...
copy /Y "%SCRIPT_DIR%android\app\build\outputs\apk\debug\app-debug.apk" "%SCRIPT_DIR%EasyText.apk" >nul
if errorlevel 1 (
    echo [X] APK 复制失败
    pause
    exit /b 1
)

for %%F in ("%SCRIPT_DIR%EasyText.apk") do set "APK_SIZE=%%~zF"

echo.
echo ====================================
echo   打包成功！
echo   文件：EasyText.apk
echo   大小：%APK_SIZE% 字节
echo ====================================
echo.
pause
