const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('lazy', {
  toggleLaser: () => ipcRenderer.send('control-toggle'),
  quit: () => ipcRenderer.send('control-quit'),
  onLaserState: (callback) => {
    const handler = (_event, active) => callback(active)
    ipcRenderer.on('laser-state', handler)
    return () => ipcRenderer.removeListener('laser-state', handler)
  },
})
