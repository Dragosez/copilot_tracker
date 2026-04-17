import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('electronAPI', {
  getCopilotData: () => ipcRenderer.invoke('get-copilot-data'),
  loginWithGitHub: () => ipcRenderer.invoke('get-github-cookies'),
  onRefreshData: (callback: () => void) => {
    ipcRenderer.on('refresh-data', () => callback())
  }
})
