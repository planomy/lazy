const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('lazy', {
  onCursorMove: (callback) => {
    const handler = (_event, point) => callback(point)
    ipcRenderer.on('cursor-move', handler)
    return () => ipcRenderer.removeListener('cursor-move', handler)
  },
  onLaserToggle: (callback) => {
    const handler = (_event, active) => callback(active)
    ipcRenderer.on('laser-toggle', handler)
    return () => ipcRenderer.removeListener('laser-toggle', handler)
  },
  onLaserClear: (callback) => {
    const handler = () => callback()
    ipcRenderer.on('laser-clear', handler)
    return () => ipcRenderer.removeListener('laser-clear', handler)
  },
  onOverlayReady: (callback) => {
    const handler = (_event, bounds) => callback(bounds)
    ipcRenderer.on('overlay-bounds', handler)
    return () => ipcRenderer.removeListener('overlay-bounds', handler)
  },
})
