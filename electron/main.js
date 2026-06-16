const {
  app,
  BrowserWindow,
  Tray,
  Menu,
  globalShortcut,
  screen,
  nativeImage,
} = require('electron')
const path = require('path')

const TOGGLE_ACCEL = 'Control+Alt+L'
const CLEAR_ACCEL = 'Control+Shift+Backspace'
const POLL_MS = 16

let overlayWindow = null
let tray = null
let laserActive = false
let pollTimer = null
let overlayBounds = { x: 0, y: 0, width: 0, height: 0 }

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
  if (!toggleOk) console.error(`Could not register ${TOGGLE_ACCEL}`)
  if (!clearOk) console.error(`Could not register ${CLEAR_ACCEL}`)
}

function createTray() {
  const icon = nativeImage.createFromDataURL(
    'data:image/svg+xml;base64,' +
      Buffer.from(
        `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32"><circle cx="16" cy="16" r="14" fill="#ef4444"/><circle cx="16" cy="16" r="6" fill="#fff" opacity="0.9"/></svg>`,
      ).toString('base64'),
  )

  tray = new Tray(icon.resize({ width: 16, height: 16 }))
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

app.whenReady().then(() => {
  const gotLock = app.requestSingleInstanceLock()
  if (!gotLock) {
    app.quit()
    return
  }

  createOverlayWindow()
  createTray()
  registerShortcuts()
  startCursorPoll()

  screen.on('display-added', layoutOverlay)
  screen.on('display-removed', layoutOverlay)
  screen.on('display-metrics-changed', layoutOverlay)
})

app.on('will-quit', () => {
  stopCursorPoll()
  globalShortcut.unregisterAll()
})

app.on('window-all-closed', (event) => {
  event.preventDefault()
})
