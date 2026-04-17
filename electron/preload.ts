import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('electronAPI', {
  getCopilotData: (cookie: string) => ipcRenderer.invoke('get-copilot-data', cookie),
  loginWithGitHub: () => ipcRenderer.invoke('login-with-github'),
  onMainProcessMessage: (callback: (message: string) => void) => {
    ipcRenderer.on('main-process-message', (_event, value) => callback(value))
  }
})
