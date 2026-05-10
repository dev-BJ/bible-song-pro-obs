const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('HelperBridge', {
  focusSelf: () => ipcRenderer.send('helper:focus'),
  getLocalServerInfo: () => ipcRenderer.invoke('helper:get-local-server-info'),
  checkForUpdates: () => ipcRenderer.invoke('helper:update-check'),
  downloadUpdate: () => ipcRenderer.invoke('helper:update-download'),
  installUpdateNow: () => ipcRenderer.invoke('helper:update-install'),
  onAutoStartEngine: (callback) => {
    if (typeof callback !== 'function') return () => {};
    const handler = () => callback();
    ipcRenderer.on('helper:auto-start-engine', handler);
    return () => ipcRenderer.removeListener('helper:auto-start-engine', handler);
  },
  onUpdateStatus: (callback) => {
    if (typeof callback !== 'function') return () => {};
    const handler = (_event, payload) => callback(payload || {});
    ipcRenderer.on('helper:update-status', handler);
    return () => ipcRenderer.removeListener('helper:update-status', handler);
  }
});
