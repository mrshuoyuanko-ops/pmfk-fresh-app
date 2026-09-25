// PMFK desktop shell (Electron) — wraps the web app into installable apps.
// Edit electron/config.json to point at your deployed URL.
const { app, BrowserWindow, shell } = require('electron')
const fs = require('fs')
const path = require('path')

let appUrl = 'https://pmfk.onrender.com'
try {
  const cfg = JSON.parse(fs.readFileSync(path.join(__dirname, 'config.json'), 'utf8'))
  if (cfg.url) appUrl = cfg.url
} catch {
  /* fall back to default URL */
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 820,
    autoHideMenuBar: true,
    title: 'Pocket Money For Kids (PMFK)',
    icon: path.join(__dirname, '..', 'public', 'icons', 'icon-512.png'),
    webPreferences: { contextIsolation: true },
  })
  win.loadURL(appUrl)
  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })
}

app.whenReady().then(() => {
  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
