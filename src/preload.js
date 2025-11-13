const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electron', {
  platform: process.platform
});

contextBridge.exposeInMainWorld('api', {
  selectReportFiles: () => ipcRenderer.invoke('dialog:select-report-files'),
  selectHardwareFile: () => ipcRenderer.invoke('dialog:select-hardware-file'),
  runAnalysis: (payload) => ipcRenderer.invoke('analysis:run', payload),
  getSettings: () => ipcRenderer.invoke('settings:get'),
  setHardwarePath: (hardwarePath) => ipcRenderer.invoke('settings:set-hardware', hardwarePath),
  setFilterState: (filters) => ipcRenderer.invoke('settings:set-filters', filters),
  setTheme: (theme) => ipcRenderer.invoke('settings:set-theme', theme),
  exportPdf: (payload) => ipcRenderer.invoke('export:pdf', payload)
});
