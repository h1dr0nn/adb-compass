$SDK_ROOT = "C:\Android\android-sdk"
$TOOLS_ZIP = "cmdline-tools.zip"
$DOWNLOAD_URL = "https://dl.google.com/android/repository/commandlinetools-win-11076708_latest.zip"

if (-not (Test-Path $SDK_ROOT)) {
    New-Item -Path $SDK_ROOT -ItemType Directory -Force
}

Set-Location $SDK_ROOT

echo "--- [1/4] Downloading modern Android Command Line Tools ---"
if (-not (Test-Path $TOOLS_ZIP)) {
    Invoke-WebRequest -Uri $DOWNLOAD_URL -OutFile $TOOLS_ZIP
}

echo "--- [2/4] Extracting tools ---"
Expand-Archive -Path $TOOLS_ZIP -DestinationPath "$SDK_ROOT\temp_tools" -Force
if (-not (Test-Path "$SDK_ROOT\cmdline-tools")) {
    New-Item -Path "$SDK_ROOT\cmdline-tools" -ItemType Directory -Force
}
# Move to the correct 'latest' structure required by sdkmanager
Move-Item -Path "$SDK_ROOT\temp_tools\cmdline-tools" -Destination "$SDK_ROOT\cmdline-tools\latest" -Force
Remove-Item -Path "$SDK_ROOT\temp_tools" -Recurse -Force

echo "--- [3/4] Installing Platforms and Build-Tools (Android 34) ---"
$SDK_MANAGER = "$SDK_ROOT\cmdline-tools\latest\bin\sdkmanager.bat"
$env:JAVA_HOME = "C:\Program Files\OpenJDK\jdk-25"
$env:Path = "$env:JAVA_HOME\bin;" + $env:Path

# Accept licenses
echo y | & $SDK_MANAGER --sdk_root=$SDK_ROOT --licenses

# Install components
& $SDK_MANAGER --sdk_root=$SDK_ROOT "platforms;android-34" "build-tools;34.0.0"

echo "--- [4/4] Verifying installation ---"
if (Test-Path "$SDK_ROOT\platforms\android-34\android.jar") {
    echo "SUCCESS: android.jar found!"
} else {
    echo "ERROR: android.jar not found."
}

if (Test-Path "$SDK_ROOT\build-tools\34.0.0\d8.bat") {
    echo "SUCCESS: d8 build tool found!"
} else {
    echo "ERROR: d8 build tool not found."
}

echo "Done! You can now run ./build.bat in the android-agent folder."
