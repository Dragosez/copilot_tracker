import { app, BrowserWindow, Tray, Menu, nativeImage, ipcMain, Notification, screen, session } from 'electron'
import path from 'node:path'

// The built directory structure
const DIST_PATH = path.join(__dirname, '../dist')
process.env.DIST = DIST_PATH
process.env.VITE_PUBLIC = app.isPackaged ? DIST_PATH : path.join(DIST_PATH, '../public')

// Handle Linux Wayland/Sandbox issues
if (process.platform === 'linux') {
  app.commandLine.appendSwitch('no-sandbox')
  app.commandLine.appendSwitch('password-store', 'basic')
}

let win: BrowserWindow | null
let tray: Tray | null

const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL']

function createWindow() {
  win = new BrowserWindow({
    width: 350,
    height: 480,
    show: false,
    frame: false,
    resizable: false,
    alwaysOnTop: true,
    transparent: true,
    skipTaskbar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      sandbox: false,
    },
  })

  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL)
  } else {
    win.loadFile(path.join(DIST_PATH, 'index.html'))
  }

  win.on('blur', () => {
    win?.hide()
  })
}

function createTray() {
  const iconPath = path.join(process.env.VITE_PUBLIC, 'tray-icon.png');
  tray = new Tray(iconPath)
  
  const contextMenu = Menu.buildFromTemplate([
    { label: 'Show Tracker', click: () => showWindow() },
    { label: 'Refresh Data', click: () => {
      if (win) win.webContents.send('refresh-data');
    }},
    { type: 'separator' },
    { label: 'Quit', click: () => app.quit() }
  ])

  tray.setToolTip('Copilot Tracker')
  tray.setContextMenu(contextMenu)
  
  tray.on('click', () => {
    showWindow()
  })
}

function showWindow() {
  if (!win) return
  
  const cursorPoint = screen.getCursorScreenPoint()
  const display = screen.getDisplayNearestPoint(cursorPoint)
  const x = Math.round(display.workArea.x + display.workArea.width - 360)
  const y = display.workArea.y + 10
  
  win.setPosition(x, y)
  win.show()
}

app.whenReady().then(() => {
  createWindow()
  createTray()

  if (process.platform === 'linux') {
    new Notification({
      title: 'Copilot Tracker',
      body: 'App started! Click the icon in the top bar to see your usage.',
      icon: path.join(process.env.VITE_PUBLIC, 'tray-icon.png')
    }).show()
  }
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
    win = null
  }
})

ipcMain.handle('get-github-cookies', async () => {
  return new Promise((resolve, reject) => {
    const loginWin = new BrowserWindow({
      width: 600,
      height: 800,
      webPreferences: {
        sandbox: false
      }
    });

    loginWin.loadURL('https://github.com/login');

    const checkCookies = async () => {
      const url = loginWin.webContents.getURL();
      if (url === 'https://github.com/' || url === 'https://github.com') {
        const allCookies = await session.defaultSession.cookies.get({ domain: 'github.com' });
        
        const userSession = allCookies.find(c => c.name === 'user_session');
        if (!userSession) return;
        
        const cookieString = allCookies.map(c => `${c.name}=${c.value}`).join('; ');
        loginWin.close();
        resolve(cookieString);
      }
    };

    loginWin.webContents.on('did-navigate', checkCookies);
    loginWin.webContents.on('did-navigate-in-page', checkCookies);
    
    loginWin.on('closed', () => {
      reject(new Error('Login window closed by user'));
    });
  });
});

ipcMain.handle('get-copilot-data', async () => {
  return new Promise((resolve, reject) => {
    const scraperWin = new BrowserWindow({
      show: false,
      webPreferences: {
        sandbox: false,
        offscreen: true
      }
    });

    // Use the default session which already has the cookies from the login window
    scraperWin.loadURL('https://github.com/settings/billing/premium_request_analytics');

    scraperWin.webContents.on('did-finish-load', async () => {
      const currentUrl = scraperWin.webContents.getURL();
      
      if (currentUrl.includes('/login') || currentUrl.includes('/sessions/two-factor')) {
        scraperWin.destroy();
        reject(new Error('AUTH_EXPIRED'));
        return;
      }

      try {
        // Wait for dynamic content to render
        await new Promise(r => setTimeout(r, 4500));

        const data = await scraperWin.webContents.executeJavaScript(`
          (() => {
            const bodyText = document.body.innerText;
            const billedMatch = bodyText.match(/\\$[\\d,]+\\.\\d{2}/);
            const billed = billedMatch ? billedMatch[0] : '$0.00';
            
            const usageMatch = bodyText.match(/(\\d{1,})\\s+of\\s+(\\d{1,})/i);
            let consumed = '0';
            let total = '300';
            
            if (usageMatch) {
              consumed = usageMatch[1];
              total = usageMatch[2];
            } else {
              const standaloneMatch = bodyText.match(/(\\d{1,})\\s+consumed/i);
              if (standaloneMatch) consumed = standaloneMatch[1];
            }

            return {
              billed,
              consumed,
              total,
              lastUpdated: new Date().toISOString()
            };
          })()
        `);

        scraperWin.destroy();
        resolve(data);
      } catch (err) {
        if (!scraperWin.isDestroyed()) scraperWin.destroy();
        reject(err);
      }
    });

    setTimeout(() => {
      if (!scraperWin.isDestroyed()) {
        scraperWin.destroy();
        reject(new Error('TIMEOUT'));
      }
    }, 45000);
  });
});
