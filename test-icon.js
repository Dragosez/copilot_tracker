const { app, Tray, nativeImage, BrowserWindow } = require('electron');

app.disableHardwareAcceleration();

app.whenReady().then(async () => {
  const win = new BrowserWindow({ show: false, width: 200, height: 50, webPreferences: { offscreen: true } });
  await win.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent('<html><body style="margin:0; background: transparent; color: white; font-family: sans-serif; font-size: 20px; font-weight: bold; line-height: 50px; text-align: center;">258 / 300</body></html>'));
  
  setTimeout(async () => {
    const image = await win.webContents.capturePage();
    console.log("Captured image size:", image.getSize());
    app.quit();
  }, 1000);
});
