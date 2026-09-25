# PMFK Click-by-Click Setup

This guide uses GitHub for the public website and Render for the backend API. GitHub Pages cannot run the Node API by itself, so both services are needed for accounts, cloud sync, and live lessons.

## What you will create

| Part | Result |
| --- | --- |
| GitHub repository | Stores the PMFK source code |
| GitHub Pages | Public website: `https://mrshuoyuanko-ops.github.io/pmfk-fresh-app/` |
| Render | Backend API and WebSocket server |
| Postgres | Persistent account and app data |
| GitHub Actions | Windows, macOS, Linux, and Android builds |

The starting marketplace is empty. No fake families, tutors, lessons, chores, or payments are included.

## Requirements

- GitHub account
- Render account
- Node.js `22.12.0` or newer
- Git
- A PMFK project folder

## 1. Test the app locally

1. Open PowerShell.
2. Change to the PMFK folder:

```powershell
cd "C:\Pocket Money For Kids (PMFK)"
```

3. Install the locked dependencies:

```powershell
npm ci
```

4. Build the web app:

```powershell
npm run build
```

5. Start the full local server:

```powershell
npm start
```

6. Open `http://localhost:4000` in your browser.
7. In a second PowerShell window, check the API:

```powershell
Invoke-RestMethod http://localhost:4000/api/health
```

The response must contain `ok: true`. Stop the server with `Ctrl+C` after testing.

For development with hot reload, run `npm run dev:all` and open `http://localhost:5173`.

## 2. Create the GitHub website

### A. Create the repository

1. Go to [github.com](https://github.com) and sign in.
2. Click the **+** button in the top-right corner.
3. Click **New repository**.
4. Enter `pmfk-fresh-app` as the repository name.
5. Choose **Public** if the source should be publicly visible.
6. Leave **Add a README**, `.gitignore`, and license unchecked.
7. Click **Create repository**.

### B. Upload the project

Open PowerShell in the PMFK folder and run:

```powershell
git add .
git commit -m "PMFK release"
git branch -M main
git remote add origin https://github.com/mrshuoyuanko-ops/pmfk-fresh-app.git
git push -u origin main
```

If `origin` already exists, use:

```powershell
git remote set-url origin https://github.com/mrshuoyuanko-ops/pmfk-fresh-app.git
git push -u origin main
```

### C. Enable GitHub Pages

1. Open the `mrshuoyuanko-ops/pmfk-fresh-app` repository on GitHub.
2. Click **Settings**.
3. In the left menu, click **Pages**.
4. Under **Build and deployment**, set **Source** to **GitHub Actions**.
5. Click the **Actions** tab.
6. Select **Deploy to GitHub Pages**.
7. Click **Run workflow**.
8. Select the `main` branch.
9. Click **Run workflow**.
10. Wait until the workflow is green.
11. Return to **Settings → Pages** and open the displayed website URL.

The workflow also requests Pages enablement automatically. If the workflow reports `Get Pages site failed` or `Not Found`, enable it manually: open **Settings → Pages**, choose **GitHub Actions** as the source, save if GitHub shows a save button, then return to **Actions → Deploy to GitHub Pages → Run workflow** and run it again.

The website URL will look like:

```text
https://mrshuoyuanko-ops.github.io/pmfk-fresh-app/
```

At this point GitHub hosts the frontend only. Continue with Render before testing account creation or live features.

## 3. Deploy the backend on Render

The repository includes [render.yaml](render.yaml). It tells Render to run:

- Build: `npm install && npm run build`
- Start: `npm start`
- Health check: `/api/health`

1. Go to [render.com](https://render.com).
2. Click **Get Started** or **Sign in**.
3. Choose **Sign in with GitHub**.
4. Allow Render to access the GitHub repository.
5. Click **New**.
6. Click **Blueprint**.
7. Select the `pmfk-fresh-app` repository.
8. Review the service named `pmfk`.
9. Click **Apply**.
10. Wait for the deployment to finish.
11. Copy the exact service URL shown by Render.
12. Open this address in a browser:

```text
https://YOUR-RENDER-URL/api/health
```

The response must be `{"ok":true}`. Do not assume the URL is `pmfk.onrender.com`; use the URL Render actually gives you.

## 4. Connect the GitHub website to Render

1. Open the GitHub `pmfk-fresh-app` repository.
2. Click **Settings**.
3. Click **Secrets and variables → Actions**.
4. Open the **Secrets** tab.
5. Click **New repository secret**.
6. Set **Name** to `VITE_API_URL`.
7. Set **Secret** to the exact Render URL, for example `https://pmfk.onrender.com`.
8. Click **Add secret**.
9. Open the **Actions** tab.
10. Select **Deploy to GitHub Pages**.
11. Click **Run workflow**.
12. Select `main` and click **Run workflow**.
13. Wait for the workflow to turn green.

Open the GitHub Pages URL again. The website is now hosted by GitHub Pages and sends API requests to Render.

## 5. Add persistent storage

Render's local disk can reset after a restart. Use Postgres for real user data.

1. Create a project at [supabase.com](https://supabase.com) or [neon.tech](https://neon.tech).
2. Open the database dashboard.
3. Copy the Postgres connection string.
4. Open the PMFK service in Render.
5. Click **Environment**.
6. Click **Add Environment Variable**.
7. Set **Key** to `DATABASE_URL`.
8. Paste the Postgres connection string as **Value**.
9. Click **Save Changes**.
10. Wait for Render to redeploy.

## 6. Configure installer URLs

The desktop app reads [electron/config.json](electron/config.json). For a local desktop build, replace its value with your real Render URL:

```json
{
  "url": "https://YOUR-ACTUAL-RENDER-URL"
}
```

For GitHub Actions, create the URL variable:

1. Open the GitHub `pmfk-fresh-app` repository.
2. Click **Settings**.
3. Click **Secrets and variables → Actions**.
4. Open the **Variables** tab.
5. Click **New repository variable**.
6. Set **Name** to `PMFK_URL`.
7. Set **Value** to the exact Render URL.
8. Click **Add variable**.

The installer workflow uses `PMFK_URL` for desktop and Android builds. If it is missing, it falls back to `https://pmfk.onrender.com`.

## 7. Build all installers on GitHub

The workflow is [.github/workflows/build-installers.yml](.github/workflows/build-installers.yml).

1. In PowerShell, commit and push the latest files:

```powershell
git add .
git commit -m "Prepare PMFK installers"
git push
```

2. Open the GitHub `pmfk-fresh-app` repository.
3. Click **Actions**.
4. Click **Build Installers** in the workflow list.
5. Click **Run workflow**.
6. Select the `main` branch.
7. Click **Run workflow**.
8. Wait for all jobs to finish.
9. Click the completed workflow run.
10. Scroll to **Artifacts**.
11. Download the artifact for the platform you need.

Artifacts produced:

- `pmfk-windows`: Windows `.exe`
- `pmfk-macos`: macOS `.dmg`
- `pmfk-linux`: Linux `.AppImage` and `.deb`
- `pmfk-android`: Android `app-debug.apk`

## 8. Install each platform

### Windows

1. Download `pmfk-windows` from the Actions run.
2. Extract the downloaded ZIP.
3. Double-click the `.exe`.
4. Complete the installer.
5. Open PMFK from the Start Menu.

An unsigned build may show a Windows security warning.

### macOS

1. Download `pmfk-macos`.
2. Extract the ZIP.
3. Open the `.dmg`.
4. Drag PMFK into **Applications**.
5. If macOS blocks the app, right-click it and choose **Open**.

A trusted public Mac release requires Apple Developer signing and notarization.

### Linux

For AppImage:

```bash
chmod +x Pocket-Money-For-Kids-*.AppImage
./Pocket-Money-For-Kids-*.AppImage
```

For Debian or Ubuntu:

```bash
sudo dpkg -i pocket-money-for-kids*.deb
sudo apt-get -f install
```

### Android

1. Download `pmfk-android`.
2. Extract the ZIP.
3. Transfer `app-debug.apk` to the Android device.
4. Open the APK.
5. Allow installation from that source if Android asks.
6. Tap **Install**.
7. Open PMFK.

This is a debug APK for testing and sideloading. Google Play requires a signed release APK or AAB.

### ChromeOS

1. Open the GitHub Pages URL in Chrome.
2. Click the install icon in the address bar, or open Chrome menu → **Save and share → Install page as app**.
3. Click **Install**.

Supported Chromebooks may also install the Android APK, but Android app support depends on the device.

### iPhone and iPad

1. Open the GitHub Pages URL in Safari.
2. Tap **Share**.
3. Tap **Add to Home Screen**.
4. Tap **Add**.

This creates the supported iPhone/iPad web app. This workflow does not create an App Store `.ipa`. An App Store version requires a Mac, Xcode, Apple Developer account, certificates, and a separate iOS project.

## 9. Final verification

Before sharing the website or installers, run:

```powershell
npm ci
npm run build
npm run lint
npx electron-builder --version
npx cap --version
```

Then verify the deployed services:

- GitHub Pages URL opens the website.
- Render URL `/api/health` returns `{"ok":true}`.
- GitHub Actions **Deploy to GitHub Pages** is green.
- GitHub Actions **Build Installers** is green.
- Downloaded installer opens the GitHub Pages/Render-backed app.

## Important limits

- GitHub Pages hosts the website frontend, not the Node backend.
- Render is required for accounts, sync, and live lessons.
- The desktop apps load the deployed URL; they do not package the backend.
- Android is currently a debug APK.
- iPhone and iPad use the PWA path, not an App Store installer.
