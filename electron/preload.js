const { contextBridge, ipcRenderer } = require('electron')

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  showOpenDialog: () => ipcRenderer.invoke('show-open-dialog'),
  showSaveDialog: (options) => ipcRenderer.invoke('show-save-dialog', options),
  readFile: (filePath) => ipcRenderer.invoke('read-file', filePath),
  
  // Platform info
  platform: process.platform,
  
  // File system operations
  openExternal: (url) => ipcRenderer.invoke('open-external', url)
})

// DOM ready event
window.addEventListener('DOMContentLoaded', () => {
  console.log('Electron preload script loaded')
})