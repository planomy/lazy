const {
  app,
  BrowserWindow,
  Tray,
  Menu,
  globalShortcut,
  screen,
  nativeImage,
  dialog,
} = require('electron')
const path = require('path')
const fs = require('fs')

// Transparent overlays often crash silently on AMD/Intel GPUs without this.
app.disableHardwareAcceleration()

const TOGGLE_ACCEL = 'Control+Alt+L'
const CLEAR_ACCEL = 'Control+Shift+Backspace'
const POLL_MS = 16

let overlayWindow = null
let tray = null
let laserActive = false
let pollTimer = null
let overlayBounds = { x: 0, y: 0, width: 0, height: 0 }

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
    dialog.showErrorBox('Lazy Laser', `Overlay failed to load (${desc}).`)
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
  if (tray) {
    tray.setToolTip(laserActive ? 'Lazy Laser — ON (Ctrl+Alt+L)' : 'Lazy Laser — OFF (Ctrl+Alt+L)')
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
  const toggleOk = globalShortcut.register(TOGGLE_ACCEL, toggleLaser)
  const clearOk = globalShortcut.register(CLEAR_ACCEL, () => {
    if (overlayWindow && !overlayWindow.isDestroyed()) {
      overlayWindow.webContents.send('laser-clear')
    }
  })
  if (!toggleOk) {
    dialog.showErrorBox('Lazy Laser', `Could not register ${TOGGLE_ACCEL}. Another app may be using it.`)
  }
  if (!clearOk) console.error(`Could not register ${CLEAR_ACCEL}`)
}

function showWelcome() {
  dialog.showMessageBox({
    type: 'info',
    title: 'Lazy Laser',
    message: 'Lazy Laser is running',
    detail:
      'Press Ctrl+Alt+L to turn the laser on or off.\n\n' +
      'Look for the red dot in the system tray near the clock. ' +
      'If you do not see it, click the ^ arrow to show hidden icons.',
    buttons: ['OK'],
    noLink: true,
  })
}

function showAlreadyRunning() {
  dialog.showMessageBox({
    type: 'info',
    title: 'Lazy Laser',
    message: 'Lazy Laser is already running',
    detail: 'Press Ctrl+Alt+L or click the red tray icon.',
    buttons: ['OK'],
    noLink: true,
  })
}

function createTray() {
  const icon = createTrayIcon().resize({ width: 16, height: 16 })
  tray = new Tray(icon)
  tray.setToolTip('Lazy Laser — OFF (Ctrl+Alt+L)')

  const menu = Menu.buildFromTemplate([
    {
      label: 'Toggle laser',
      accelerator: TOGGLE_ACCEL,
      click: toggleLaser,
    },
    {
      label: 'Clear trail',
      accelerator: CLEAR_ACCEL,
      click: () => {
        if (overlayWindow && !overlayWindow.isDestroyed()) {
          overlayWindow.webContents.send('laser-clear')
        }
      },
    },
    { type: 'separator' },
    {
      label: 'Quit Lazy',
      click: () => app.quit(),
    },
  ])

  tray.setContextMenu(menu)
  tray.on('click', toggleLaser)
}

const gotLock = app.requestSingleInstanceLock()
if (!gotLock) {
  app.whenReady().then(showAlreadyRunning).finally(() => app.quit())
} else {
  app.on('second-instance', showAlreadyRunning)

  app.whenReady().then(() => {
    try {
      createTray()
      showWelcome()

      try {
        createOverlayWindow()
      } catch (err) {
        logError('createOverlayWindow', err)
        dialog.showErrorBox('Lazy Laser', `Could not start overlay:\n${err.message}`)
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

process.on('unhandledRejection', (reason) => {
  logError('unhandledRejection', reason)
})

app.on('will-quit', () => {
  stopCursorPoll()
  globalShortcut.unregisterAll()
})

app.on('window-all-closed', (event) => {
  event.preventDefault()
})
