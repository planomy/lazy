const {
  app,
  BrowserWindow,
  Tray,
  Menu,
  globalShortcut,
  screen,
  nativeImage,
  dialog,
  ipcMain,
} = require('electron')
const path = require('path')
const fs = require('fs')
const os = require('os')

if (process.platform === 'win32') {
  app.setAppUserModelId('com.planomy.lazy')
}

app.disableHardwareAcceleration()
app.commandLine.appendSwitch('disable-gpu-compositing')
app.commandLine.appendSwitch('disable-direct-composition')

const TOGGLE_ACCEL = 'F8'
const CLEAR_ACCEL = 'Control+Shift+Backspace'
const POLL_MS = 16

let overlayWindow = null
let controlWindow = null
let tray = null
let laserActive = false
let pollTimer = null
let overlayBounds = { x: 0, y: 0, width: 0, height: 0 }

function markStarted() {
  const text = `Lazy Laser started at ${new Date().toLocaleString()}\nPress F8 or click the Lazy Laser window button.\n`
  const paths = [
    path.join(path.dirname(process.execPath), 'lazy-started.txt'),
    path.join(os.homedir(), 'Desktop', 'lazy-started.txt'),
    path.join(os.homedir(), 'OneDrive', 'Desktop', 'lazy-started.txt'),
  ]
  for (const marker of paths) {
    try {
      fs.writeFileSync(marker, text)
    } catch {
      // ignore
    }
  }
}

function logError(label, err) {
  const line = `[${new Date().toISOString()}] ${label}: ${err?.stack || err}\n`
  console.error(line)
  try {
    fs.appendFileSync(path.join(app.getPath('userData'), 'lazy.log'), line)
  } catch {
    // ignore
  }
}

function createTrayIcon() {
  const iconPath = path.join(__dirname, '../assets/icon.png')
  const fromFile = nativeImage.createFromPath(iconPath)
  if (!fromFile.isEmpty()) {
    return fromFile
  }

  const size = 32
  const buffer = Buffer.alloc(size * size * 4)
  const cx = 16
  const cy = 16
  const r = 14

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4
      if (Math.hypot(x - cx, y - cy) <= r) {
        buffer[i] = 239
        buffer[i + 1] = 68
        buffer[i + 2] = 68
        buffer[i + 3] = 255
      }
    }
  }

  return nativeImage.createFromBuffer(buffer, { width: size, height: size })
}

function unionDisplayBounds() {
  const displays = screen.getAllDisplays()
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity

  for (const display of displays) {
    const { x, y, width, height } = display.bounds
    minX = Math.min(minX, x)
    minY = Math.min(minY, y)
    maxX = Math.max(maxX, x + width)
    maxY = Math.max(maxY, y + height)
  }

  return {
    x: minX,
    y: minY,
    width: Math.max(1, maxX - minX),
    height: Math.max(1, maxY - minY),
  }
}

function createControlWindow() {
  const appIcon = createTrayIcon()
  controlWindow = new BrowserWindow({
    width: 280,
    height: 200,
    frame: true,
    resizable: false,
    alwaysOnTop: true,
    skipTaskbar: false,
    show: false,
    title: 'Lazy Laser — click button to start',
    icon: appIcon,
    backgroundColor: '#1e1e1e',
    webPreferences: {
      preload: path.join(__dirname, 'control-preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  controlWindow.setMenuBarVisibility(false)
  controlWindow.center()
  controlWindow.loadFile(path.join(__dirname, '../src/control.html'))
  controlWindow.webContents.on('did-finish-load', () => {
    controlWindow.webContents.send('laser-state', laserActive)
    controlWindow.show()
    controlWindow.focus()
    controlWindow.moveTop()
    controlWindow.flashFrame(true)
  })
  controlWindow.on('closed', () => {
    controlWindow = null
  })
}

function createOverlayWindow() {
  overlayBounds = unionDisplayBounds()

  overlayWindow = new BrowserWindow({
    x: overlayBounds.x,
    y: overlayBounds.y,
    width: overlayBounds.width,
    height: overlayBounds.height,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    resizable: false,
    movable: false,
    minimizable: false,
    maximizable: false,
    closable: false,
    skipTaskbar: true,
    show: false,
    focusable: false,
    hasShadow: false,
    thickFrame: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  overlayWindow.setAlwaysOnTop(true, 'screen-saver')
  overlayWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })
  overlayWindow.setIgnoreMouseEvents(true, { forward: true })

  overlayWindow.webContents.on('did-fail-load', (_event, code, desc) => {
    logError('overlay did-fail-load', `${code} ${desc}`)
    dialog.showErrorBox('Lazy Laser', `Laser overlay failed (${desc}). The control window still works — try again or restart.`)
  })

  overlayWindow.loadFile(path.join(__dirname, '../src/overlay.html'))

  overlayWindow.webContents.on('did-finish-load', () => {
    overlayWindow.webContents.send('overlay-bounds', overlayBounds)
    overlayWindow.showInactive()
  })

  overlayWindow.on('closed', () => {
    overlayWindow = null
  })
}

function layoutOverlay() {
  if (!overlayWindow) return
  overlayBounds = unionDisplayBounds()
  overlayWindow.setBounds(overlayBounds)
  overlayWindow.webContents.send('overlay-bounds', overlayBounds)
}

function setLaserActive(next) {
  laserActive = next
  if (overlayWindow && !overlayWindow.isDestroyed()) {
    overlayWindow.webContents.send('laser-toggle', laserActive)
  }
  if (controlWindow && !controlWindow.isDestroyed()) {
    controlWindow.webContents.send('laser-state', laserActive)
    controlWindow.setTitle(
      laserActive ? 'Lazy Laser — ON (move mouse)' : 'Lazy Laser — OFF',
    )
  }
  if (tray) {
    tray.setToolTip(laserActive ? 'Lazy Laser — ON (F8)' : 'Lazy Laser — OFF (F8)')
  }
}

function startCursorPoll() {
  if (pollTimer) return
  pollTimer = setInterval(() => {
    if (!laserActive || !overlayWindow || overlayWindow.isDestroyed()) return
    const point = screen.getCursorScreenPoint()
    overlayWindow.webContents.send('cursor-move', {
      x: point.x - overlayBounds.x,
      y: point.y - overlayBounds.y,
      screenX: point.x,
      screenY: point.y,
    })
  }, POLL_MS)
}

function stopCursorPoll() {
  if (!pollTimer) return
  clearInterval(pollTimer)
  pollTimer = null
}

function toggleLaser() {
  setLaserActive(!laserActive)
}

function registerShortcuts() {
  globalShortcut.unregisterAll()
  globalShortcut.register(TOGGLE_ACCEL, toggleLaser)
  globalShortcut.register(CLEAR_ACCEL, () => {
    if (overlayWindow && !overlayWindow.isDestroyed()) {
      overlayWindow.webContents.send('laser-clear')
    }
  })
}

function createTray() {
  const icon = createTrayIcon().resize({ width: 16, height: 16 })
  tray = new Tray(icon)
  tray.setToolTip('Lazy Laser — OFF (F8)')

  const menu = Menu.buildFromTemplate([
    { label: 'Show control window', click: () => controlWindow?.show() },
    { label: 'Toggle laser', click: toggleLaser },
    { type: 'separator' },
    { label: 'Quit', click: () => app.quit() },
  ])

  tray.setContextMenu(menu)
  tray.on('click', () => controlWindow?.show())
}

function showAlreadyRunning() {
  dialog.showMessageBox({
    type: 'info',
    title: 'Lazy Laser',
    message: 'Lazy Laser is already running',
    detail: 'Look for the Lazy Laser control window.',
    buttons: ['OK'],
  })
}

ipcMain.on('control-toggle', toggleLaser)
ipcMain.on('control-quit', () => app.quit())

const gotLock = app.requestSingleInstanceLock()
if (!gotLock) {
  app.whenReady().then(showAlreadyRunning).finally(() => app.quit())
} else {
  app.on('second-instance', showAlreadyRunning)

  app.whenReady().then(() => {
    markStarted()

    try {
      createControlWindow()
      createTray()

      try {
        createOverlayWindow()
      } catch (err) {
        logError('createOverlayWindow', err)
        dialog.showErrorBox('Lazy Laser', `Overlay failed:\n${err.message}\n\nYou can still use the control window to retry after restart.`)
      }

      registerShortcuts()
      startCursorPoll()

      screen.on('display-added', layoutOverlay)
      screen.on('display-removed', layoutOverlay)
      screen.on('display-metrics-changed', layoutOverlay)
    } catch (err) {
      logError('startup', err)
      dialog.showErrorBox('Lazy Laser', `Startup failed:\n${err.message}`)
      app.quit()
    }
  })
}

process.on('uncaughtException', (err) => {
  logError('uncaughtException', err)
  dialog.showErrorBox('Lazy Laser crashed', err.message)
})

app.on('will-quit', () => {
  stopCursorPoll()
  globalShortcut.unregisterAll()
})

app.on('window-all-closed', (event) => {
  event.preventDefault()
})
