@echo off
setlocal
set "REPO=https://github.com/EmperorRajaSinga/sabung-idol-arena.git"
set "BRANCH=zip-update"
set "WORK=%TEMP%\sabung-idol-arena-publish"

echo ================================================
echo Sabung Idol Arena - Publish to GitHub
echo ================================================

where git >nul 2>nul
if errorlevel 1 (
  echo Git was not found. Install Git for Windows, then run this file again.
  pause
  exit /b 1
)

if exist "%WORK%" rmdir /s /q "%WORK%"
echo Cloning the project repository...
git clone --branch "%BRANCH%" "%REPO%" "%WORK%"
if errorlevel 1 (
  echo Could not clone the deployment branch. Check GitHub access and branch availability.
  pause
  exit /b 1
)

echo Copying project files...
robocopy "%~dp0" "%WORK%" /E /XD .git node_modules dist dist-single .wrangler /XF PUBLISH-TO-GITHUB-WINDOWS.bat
if errorlevel 8 (
  echo File copy failed.
  pause
  exit /b 1
)

cd /d "%WORK%"
git add -A
git commit -m "Update Sabung Idol Arena"
if errorlevel 1 (
  echo No changes to commit, or commit failed.
  pause
  exit /b 1
)

echo Pushing changes to GitHub...
git push origin "%BRANCH%"
if errorlevel 1 (
  echo Push failed. Check GitHub authentication and try again.
  pause
  exit /b 1
)

echo.
echo SUCCESS: Changes pushed to the zip-update branch.
echo Check the GitHub Actions tab for the Cloudflare Workers deployment result.
start https://github.com/EmperorRajaSinga/sabung-idol-arena/actions
pause
