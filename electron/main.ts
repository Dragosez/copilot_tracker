import { app, BrowserWindow, Tray, Menu, nativeImage, ipcMain } from 'electron'
import path from 'node:path'
import puppeteer from 'puppeteer-core'
import { Launcher } from 'chrome-launcher'

// The built directory structure
const DIST_PATH = path.join(__dirname, '../dist')
process.env.DIST = DIST_PATH
process.env.VITE_PUBLIC = app.isPackaged ? DIST_PATH : path.join(DIST_PATH, '../public')

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
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
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
  const icon = nativeImage.createFromDataURL('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAABmJLR0QA/wD/AP+gvaeTAAAACXBIWXMAAAsTAAALEwEAmpwYAAAAB3RJTUUH5AgKCQ8XNn5jSgAAAB1pVFh0Q29tbWVudAAAAAAAQ3JlYXRlZCB3aXRoIEdJTVBkLm3pAAAAXUlEQVQ4y2NgGAWjYBSMglEwCkbBSAcM+f//PwM+fvyYgYGBgYGBAUgeWR5ZHi6PNo8un1geWR6SPLY8unxS88HCHj0+vflgYI8en958MLBHj09vPnjYoycgf8AoGAWjAAAyAxfD8F6VAAAAAElFTkSuQmCC')
  
  tray = new Tray(icon)
  tray.setToolTip('Copilot Tracker')

  tray.on('click', () => {
    if (win?.isVisible()) {
      win.hide()
    } else {
      showWindow()
    }
  })

  const contextMenu = Menu.buildFromTemplate([
    { label: 'Refresh', click: () => win?.webContents.send('refresh-data') },
    { type: 'separator' },
    { label: 'Quit', click: () => app.quit() }
  ])
  
  tray.on('right-click', () => {
    tray?.popUpContextMenu(contextMenu)
  })
}

function showWindow() {
  if (!win || !tray) return

  const trayBounds = tray.getBounds()
  const { width, height } = win.getBounds()
  
  win.setPosition(
    trayBounds.x - Math.floor(width / 2) + Math.floor(trayBounds.width / 2),
    trayBounds.y + trayBounds.height + 5
  )
  
  win.show()
  win.focus()
}

app.whenReady().then(() => {
  createWindow()
  createTray()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
    win = null
  }
})

// IPC Handlers
ipcMain.handle('login-with-github', async () => {
  return new Promise((resolve, reject) => {
    const loginWin = new BrowserWindow({
      width: 500,
      height: 700,
      show: true,
      title: 'Login to GitHub',
      autoHideMenuBar: true
    });

    loginWin.loadURL('https://github.com/login');

    const checkCookies = async () => {
      const cookies = await loginWin.webContents.session.cookies.get({ domain: '.github.com' });
      const sessionCookie = cookies.find(c => c.name === 'user_session' || c.name === '__Host-user_session_same_site');
      
      if (sessionCookie) {
        const cookieString = cookies.map(c => `${c.name}=${c.value}`).join('; ');
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

ipcMain.handle('get-copilot-data', async (_event, cookie: string) => {
  let browser;
  try {
    const chromePath = Launcher.getFirstInstallation();
    if (!chromePath) throw new Error('Chrome/Chromium not found');

    browser = await puppeteer.launch({
      executablePath: chromePath,
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();
    
    const cookies = cookie.split(';').map(pair => {
      const [name, ...value] = pair.trim().split('=');
      return {
        name: name || '',
        value: value.join('=') || '',
        domain: '.github.com',
        path: '/'
      };
    }).filter(c => c.name && c.value);

    await page.setCookie(...cookies);

    await page.goto('https://github.com/settings/billing/premium_request_analytics', {
      waitUntil: 'networkidle2',
      timeout: 30000
    });

    const data = await page.evaluate(() => {
      const getTextByLabel = (label: string) => {
        const elements = Array.from(document.querySelectorAll('div, span, p'));
        const target = elements.find(el => el.textContent?.trim().includes(label));
        if (target && target.nextElementSibling) {
           return target.nextElementSibling.textContent?.trim() || '';
        }
        return '';
      };

      const billedText = getTextByLabel('Billed premium requests') || '$0.00';
      
      const consumedContainer = (Array.from(document.querySelectorAll('div, p, span')).find(el => 
        el.textContent?.includes('Included premium requests consumed') && el.children.length === 0
      ) || Array.from(document.querySelectorAll('div')).find(el => el.textContent?.includes('Included premium requests consumed'))) as HTMLElement | null;

      let consumed = '0';
      let total = '300';
      
      if (consumedContainer) {
        const text = consumedContainer.parentElement?.innerText || consumedContainer.innerText;
        const match = text.match(/([\d.]+)\s+of\s+([\d.]+)/);
        if (match) {
          consumed = match[1];
          total = match[2];
        }
      }

      return {
        billed: billedText,
        consumed,
        total
      };
    });

    await browser.close();

    return {
      ...data,
      lastUpdated: new Date().toISOString()
    };

  } catch (error) {
    if (browser) await browser.close();
    console.error('Scraping error:', error);
    throw error;
  }
})
