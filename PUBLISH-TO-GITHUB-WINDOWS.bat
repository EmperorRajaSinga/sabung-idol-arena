@echo off
setlocal
set "REPO=https://github.com/EmperorRajaSinga/sabung-idol-arena.git"
set "WORK=%TEMP%\sabung-idol-arena-publish"
echo ================================================
echo Sabung Idol Arena - Publish source to GitHub
echo ================================================
where git >nul 2>nul
if errorlevel 1 (
  echo Git was not found. Install Git for Windows or GitHub Desktop, then run this file again.
  echo https://desktop.github.com/
  pause
  exit /b 1
)
if exist "%WORK%" rmdir /s /q "%WORK%"
echo Cloning your empty GitHub repository...
git clone "%REPO%" "%WORK%"
if errorlevel 1 (
  echo Could not clone. Check that you are signed in to GitHub and that the repository exists.
  pause
  exit /b 1
)
echo Copying project files...
robocopy "%~dp0" "%WORK%" /E /XD .git node_modules dist dist-single .netlify /XF PUBLISH-TO-GITHUB-WINDOWS.bat
if errorlevel 8 (
  echo File copy failed.
  pause
  exit /b 1
)
cd /d "%WORK%"
git add -A
git commit -m "Deploy Sabung Idol Arena latest project"
if errorlevel 1 (
  echo Commit failed. The repository may already contain the same files.
  pause
  exit /b 1
)
echo Pushing files to GitHub...
git push -u origin main
if errorlevel 1 (
  echo Push failed. Complete the GitHub sign-in prompt if one appears, then run this file again.
  pause
  exit /b 1
)
echo.
echo SUCCESS: Source code has been pushed to GitHub.
echo Next: connect this repository to Netlify.
start https://app.netlify.com/start
pause
