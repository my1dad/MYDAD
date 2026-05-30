const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("overDriveBins", {
  getRoot: () => ipcRenderer.invoke("bins:getRoot"),
  loadAll: () => ipcRenderer.invoke("bins:loadAll"),
  readJson: (relativePath) => ipcRenderer.invoke("bins:readJson", relativePath),
  writeJson: (relativePath, payload) => ipcRenderer.invoke("bins:writeJson", relativePath, payload),
  writeAttachment: (relativePath, dataUrl) =>
    ipcRenderer.invoke("bins:writeAttachment", relativePath, dataUrl),
  readAttachment: (relativePath) => ipcRenderer.invoke("bins:readAttachment", relativePath),
  reset: () => ipcRenderer.invoke("bins:reset"),
});
