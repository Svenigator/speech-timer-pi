@echo off
REM Speech Timer Pi - Companion Module Installer (Windows)
REM Copies this module folder into the Companion dev-modules folder.

setlocal enabledelayedexpansion

set "TARGET=%APPDATA%\companion\modules\speech-timer-pi"

echo ==========================================
echo  Speech Timer Pi - Companion Module
echo ==========================================
echo.
echo Target: %TARGET%
echo.

if exist "%TARGET%" (
    echo WARNING: Target folder already exists.
    set /p CONFIRM="Overwrite? (y/n): "
    if /i not "!CONFIRM!"=="y" (
        echo Cancelled.
        pause
        exit /b 0
    )
    rmdir /s /q "%TARGET%"
)

mkdir "%TARGET%" 2>nul

echo Copying files...
xcopy /E /I /Y "%~dp0*" "%TARGET%" >nul

echo.
echo Module installed.
echo.
echo Next steps:
echo   1. Open a terminal in %TARGET%
echo   2. Run: npm install
echo   3. Restart Companion
echo   4. Add instance: "Speech Timer Pi"
echo.
pause
