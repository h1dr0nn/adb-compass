@echo off
setlocal enabledelayedexpansion

:: Simple build script for Android Agent
:: Requires: javac (Java 11+) and Android build-tools (d8 or dx)

set JDK_BIN=C:\Program Files\OpenJDK\jdk-25\bin
set ANDROID_SDK_ROOT=C:\Android\android-sdk
set BUILD_TOOLS_PATH=%ANDROID_SDK_ROOT%\build-tools\34.0.0
set ANDROID_JAR=%ANDROID_SDK_ROOT%\platforms\android-34\android.jar
set OUT_DIR=build
set SRC_DIR=src
set PACKAGE=com/h1dr0n/adbcompass
set JAR_NAME=agent.jar

:: Add JDK to path for this session if it exists
if exist "%JDK_BIN%" set PATH=%JDK_BIN%;%PATH%

echo [0/3] Debug info:
java -version
javac -version

echo [1/3] Compiling Java source...
dir /s /b %SRC_DIR%\*.java > sources.txt
javac -source 11 -target 11 -cp "%ANDROID_JAR%" -d %OUT_DIR% @sources.txt
del sources.txt

if %ERRORLEVEL% neq 0 (
    echo Compilation failed.
    exit /b %ERRORLEVEL%
)

echo [2/3] Converting to DEX...
:: Find all class files recursively
dir /s /b %OUT_DIR%\*.class > classes.txt

:: Try d8 first, then fallback to dx
if exist "%BUILD_TOOLS_PATH%\d8.bat" (
    call "%BUILD_TOOLS_PATH%\d8.bat" --release --output %JAR_NAME% @classes.txt
) else (
    call "%BUILD_TOOLS_PATH%\dx.bat" --dex --output %JAR_NAME% @classes.txt
)
del classes.txt

if %ERRORLEVEL% neq 0 (
    echo DEX conversion failed.
    exit /b %ERRORLEVEL%
)

echo [3/3] Copying to binaries...
if not exist ..\src-tauri\binaries mkdir ..\src-tauri\binaries
copy %JAR_NAME% ..\src-tauri\binaries\

echo Build successful: ..\src-tauri\binaries\%JAR_NAME%
