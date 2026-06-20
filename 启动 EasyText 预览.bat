@echo off
chcp 65001 >/dev/null 2>&1
echo ====================================
echo   EasyText 预览服务器启动中...
echo ====================================
cd /d "%~dp0"
node server.cjs
pause
