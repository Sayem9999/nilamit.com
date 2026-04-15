@echo off
REM ═══════════════════════════════════════════════════════════════
REM  Nilamit — Firebase Full Setup Script
REM  Run this ONCE from the project root to configure Firebase.
REM  Double-click this file or run: firebase-setup.bat
REM ═══════════════════════════════════════════════════════════════
cd /d "%~dp0"

echo.
echo ╔════════════════════════════════════════╗
echo ║   Nilamit Firebase Setup              ║
echo ╚════════════════════════════════════════╝
echo.

REM ── Step 1: Check Firebase CLI ─────────────────────────────────
echo [1/7] Checking Firebase CLI...
firebase --version >nul 2>&1
IF %ERRORLEVEL% NEQ 0 (
    echo ERROR: Firebase CLI not found. Run: npm install -g firebase-tools
    pause
    exit /b 1
)
firebase --version
echo.

REM ── Step 2: List projects to confirm login ─────────────────────
echo [2/7] Checking Firebase login and listing projects...
echo (If you are not logged in, a browser window will open)
echo.
firebase projects:list
echo.
echo ------------------------------------------------------------------
echo  NOTE: Find your project ID above and update these two files:
echo    .firebaserc         → replace YOUR_FIREBASE_PROJECT_ID
echo    apphosting.yaml     → replace YOUR_DOMAIN.web.app
echo ------------------------------------------------------------------
echo.
SET /P PROJECT_ID="Enter your Firebase Project ID from the list above: "

REM ── Step 3: Set active project ─────────────────────────────────
echo.
echo [3/7] Setting active Firebase project to: %PROJECT_ID%
firebase use %PROJECT_ID%
IF %ERRORLEVEL% NEQ 0 (
    echo ERROR: Could not set project. Check the project ID and try again.
    pause
    exit /b 1
)

REM ── Step 4: Update .firebaserc with real project ID ─────────────
echo.
echo [4/7] Writing project ID to .firebaserc...
(
echo {
echo   "projects": {
echo     "default": "%PROJECT_ID%"
echo   }
echo }
) > .firebaserc
echo Done.

REM ── Step 5: Enable required Google APIs ────────────────────────
echo.
echo [5/7] Enabling required Google Cloud APIs...
gcloud services enable run.googleapis.com cloudbuild.googleapis.com secretmanager.googleapis.com cloudscheduler.googleapis.com firestore.googleapis.com --project=%PROJECT_ID%
IF %ERRORLEVEL% NEQ 0 (
    echo WARNING: gcloud not found or API enable failed.
    echo Manually enable these APIs at:
    echo https://console.cloud.google.com/apis/library?project=%PROJECT_ID%
    echo   - Cloud Run API
    echo   - Cloud Build API
    echo   - Secret Manager API
    echo   - Cloud Scheduler API
    echo   - Cloud Firestore API
)
echo.

REM ── Step 6: Deploy security rules ──────────────────────────────
echo [6/7] Deploying Firebase security rules...
echo   → Realtime Database rules (database.rules.json)
echo   → Firestore rules (firestore.rules)
echo   → Storage rules (storage.rules)
echo.
firebase deploy --only database,firestore,storage
IF %ERRORLEVEL% NEQ 0 (
    echo WARNING: Rules deploy failed. You may need to initialize these services first.
    echo Run: firebase init database
    echo Run: firebase init firestore
    echo Run: firebase init storage
)
echo.

REM ── Step 7: Install npm packages ───────────────────────────────
echo [7/7] Installing updated npm packages (firebase + firebase-admin)...
npm install
IF %ERRORLEVEL% NEQ 0 (
    echo ERROR: npm install failed.
    pause
    exit /b 1
)

echo.
echo ╔════════════════════════════════════════════════════════════╗
echo ║   Setup complete!                                         ║
echo ╠════════════════════════════════════════════════════════════╣
echo ║                                                           ║
echo ║  NEXT STEPS:                                              ║
echo ║                                                           ║
echo ║  1. Add all secrets to Google Secret Manager:            ║
echo ║     See DEPLOY_FIREBASE.md → Step 4                      ║
echo ║                                                           ║
echo ║  2. Get Firebase service account credentials:            ║
echo ║     Firebase Console → Project Settings → Service Accts  ║
echo ║     → Generate New Private Key → download JSON           ║
echo ║     Then add to Secret Manager:                          ║
echo ║       FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL,        ║
echo ║       FIREBASE_PRIVATE_KEY                               ║
echo ║                                                           ║
echo ║  3. Get Firebase Web App config:                         ║
echo ║     Firebase Console → Project Settings → Your Apps      ║
echo ║     → Add Web App → copy config values                   ║
echo ║     Add to Secret Manager:                               ║
echo ║       FIREBASE_WEB_API_KEY, FIREBASE_APP_ID,             ║
echo ║       FIREBASE_MESSAGING_SENDER_ID                       ║
echo ║                                                           ║
echo ║  4. Install Trigger Email extension:                     ║
echo ║     Firebase Console → Extensions →                      ║
echo ║     "Trigger Email from Firestore" → Install             ║
echo ║     Configure with your SMTP connection string           ║
echo ║                                                           ║
echo ║  5. Enable App Hosting:                                  ║
echo ║     firebase apphosting:backends:create                  ║
echo ║                                                           ║
echo ║  6. Set up Cloud Scheduler cron jobs:                    ║
echo ║     scripts\setup-cloud-scheduler.sh                     ║
echo ║                                                           ║
echo ╚════════════════════════════════════════════════════════════╝
echo.
pause
