import { app, BrowserWindow, Tray, Menu, Notification, session, nativeImage, shell, clipboard } from 'electron'

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

let tray: Tray | null = null;

function getIconPath(): string {
  return path.join(process.env.VITE_PUBLIC || '', 'tray-icon.png');
}

// Simple file logger for production debugging
function log(msg: string) {
  const fs = require('fs');
  const os = require('os');
  const logPath = path.join(os.homedir(), 'copilot-tracker.log');
  const timestamp = new Date().toISOString();
  try {
    fs.appendFileSync(logPath, `[${timestamp}] ${msg}\n`);
  } catch (e) {}
}

async function updateTrayMenu(data?: any, error?: Error) {
  if (!tray) return;
  log(`Updating tray menu. Data: ${!!data}, Error: ${!!error}`);

  if (error) {
    tray.setImage(getIconPath());
    if (error.message === 'AUTH_EXPIRED') {
      tray.setTitle('Login Required'); 
      tray.setContextMenu(Menu.buildFromTemplate([
        { label: 'GitHub Session Expired', enabled: false },
        { label: '1. Login to GitHub', click: () => {
          const loginWin = new BrowserWindow({ 
            width: 800, 
            height: 900,
            title: 'Login to GitHub',
            webPreferences: {
              sandbox: false
            }
          });
          loginWin.loadURL('https://github.com/login');
          loginWin.on('closed', () => {
            refreshData();
          });
        }},
        { label: '2. Copy Cookie (shows instructions)', click: () => {
          new Notification({
            title: 'Copy your session cookie',
            body: 'In your browser: F12 → Application → Cookies → github.com → copy "user_session" value → click "Import Session"'
          }).show();
        }},
        { label: '3. Import Session (from clipboard)', click: async () => {
          const cookieValue = clipboard.readText().trim();
          if (!cookieValue || cookieValue.length < 10) {
            new Notification({ title: 'Import Failed', body: 'Clipboard is empty or invalid. Copy the user_session cookie value first.' }).show();
            return;
          }
          await session.defaultSession.cookies.set({
            url: 'https://github.com',
            name: 'user_session',
            value: cookieValue,
            domain: '.github.com',
            path: '/',
            httpOnly: true,
            secure: true
          });
          await session.defaultSession.cookies.set({
            url: 'https://github.com',
            name: 'logged_in',
            value: 'yes',
            domain: '.github.com',
            path: '/'
          });
          new Notification({ title: 'Session Imported', body: 'Fetching Copilot data...' }).show();
          refreshData();
        }},
        { type: 'separator' },
        { label: 'Refresh Data', click: () => refreshData() },
        { label: 'Logout', click: async () => {
          await session.defaultSession.clearStorageData({ storages: ['cookies', 'localstorage', 'indexdb', 'cachestorage'] });
          refreshData();
        }},
        { label: 'Quit', click: () => app.quit() }
      ]));
      return;
    }
    
    tray.setTitle('Error');
    tray.setContextMenu(Menu.buildFromTemplate([
      { label: `Error: ${error.message}`, enabled: false },
      { label: 'Refresh Data', click: () => refreshData() },
      { label: 'Logout', click: async () => {
        await session.defaultSession.clearStorageData({ storages: ['cookies', 'localstorage', 'indexdb', 'cachestorage'] });
        refreshData();
      }},
      { label: 'Quit', click: () => app.quit() }
    ]));
    return;
  }

  if (data) {
    const consumed = parseFloat(data.consumed.toString().replace(/,/g, ''));
    const total = parseFloat(data.total.toString().replace(/,/g, ''));
    const percent = Math.min(100, Math.max(0, (consumed / total) * 100));
    
    const title = `${data.consumed}/${data.total}`;
    log(`Updating tray for: ${title} (${percent.toFixed(1)}%)`);
    
    let statusColor = '#8e2de2';
    if (percent > 80) statusColor = '#f39c12';
    if (percent > 95) statusColor = '#e74c3c';
    
    const svg = `<svg width="128" height="128" viewBox="0 0 128 128" xmlns="http://www.w3.org/2000/svg">
      <circle cx="64" cy="64" r="62" fill="${statusColor}" />
      <text x="64" y="85" font-family="sans-serif" font-size="52" font-weight="bold" fill="white" text-anchor="middle">${Math.round(percent)}%</text>
    </svg>`;
    
    const renderWin = new BrowserWindow({
      show: false,
      width: 128,
      height: 128,
      webPreferences: { offscreen: true }
    });

    const dataUrl = `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
    
    renderWin.loadURL(dataUrl).then(async () => {
      const dynamicIcon = await renderWin.webContents.capturePage();
      renderWin.destroy();
      
      if (tray) {
        try {
          const fs = require('fs');
          const iconPath = path.join(app.getPath('userData'), 'tray-icon-dynamic.png');
          // Resize to standard Linux tray size before saving
          const trayIcon = dynamicIcon.resize({ width: 22, height: 22 });
          fs.writeFileSync(iconPath, trayIcon.toPNG());
          
          tray.setImage(iconPath);
          tray.setTitle(title);
          tray.setToolTip(`Copilot Usage: ${title} (${percent.toFixed(1)}%)`);
        } catch (e) {
          log(`Failed to save tray icon: ${e}`);
        }
      }
    });
    
    updateTrayContextMenu(data);
  } else {
    tray.setImage(getIconPath());
    tray.setTitle('...');
    updateTrayContextMenu(undefined);
  }
}

function updateTrayContextMenu(data?: any) {
  if (!tray) return;
  
  let template: any[] = [];
  if (data) {
    template = [
      { label: `Usage: ${data.consumed} / ${data.total} requests`, enabled: false },
      { label: `Billed: ${data.billed}`, enabled: false },
      { label: `Last Checked: ${new Date(data.lastUpdated).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}`, enabled: false },
      { type: 'separator' }
    ];
  } else {
    template = [
      { label: 'Fetching data...', enabled: false },
      { type: 'separator' }
    ];
  }

  template.push(
    { label: 'Refresh Data', click: () => refreshData() },
    { label: 'Show Debug Browser', click: () => {
      const debugWin = new BrowserWindow({ width: 1200, height: 800 });
      debugWin.webContents.openDevTools({ mode: 'detach' });
      debugWin.loadURL('https://github.com/settings/billing/premium_requests_usage');
    }},
    { type: 'separator' },
    { label: 'Logout', click: async () => {
      await session.defaultSession.clearStorageData({ storages: ['cookies', 'localstorage', 'indexdb', 'cachestorage'] });
      refreshData();
    }},
    { label: 'Quit', click: () => app.quit() }
  );

  tray.setContextMenu(Menu.buildFromTemplate(template));
}


async function getCopilotData(): Promise<any> {
  // Check if we have a session cookie first
  const cookies = await session.defaultSession.cookies.get({ domain: '.github.com', name: 'user_session' });
  if (cookies.length === 0) {
    throw new Error('AUTH_EXPIRED');
  }

  return new Promise((resolve, reject) => {
    const scraperWin = new BrowserWindow({
      show: false,
      width: 1280,
      height: 800,
      webPreferences: {
        sandbox: false,
        offscreen: false
      }
    });

    scraperWin.loadURL('https://github.com/settings/billing/premium_requests_usage');

    scraperWin.webContents.on('did-finish-load', async () => {
      const currentUrl = scraperWin.webContents.getURL();
      
      if (currentUrl.includes('/login') || currentUrl.includes('/sessions/two-factor')) {
        scraperWin.destroy();
        reject(new Error('AUTH_EXPIRED'));
        return;
      }

      try {
        // Wait for dynamic React content
        await new Promise(r => setTimeout(r, 6000));

        // Re-check URL after wait - JS redirects may have happened
        const finalUrl = scraperWin.webContents.getURL();
        if (finalUrl.includes('/login') || finalUrl.includes('/sessions')) {
          scraperWin.destroy();
          reject(new Error('AUTH_EXPIRED'));
          return;
        }

        const data = await scraperWin.webContents.executeJavaScript(`
          (async () => {
            const bodyText = document.body.innerText;
            const html = document.body.innerHTML;
            
            // 1. Extract billed amount (e.g., "$0.00")
            const billedMatch = bodyText.match(/\\$[\\d,]+\\.\\d{2}/);
            const billed = billedMatch ? billedMatch[0] : '$0.00';
            
            let consumed = '0';
            let total = '300';

            // 2. Fetch directly from API using customer ID from HTML
            // Try different ways to find customer ID
            const customerMatch = html.match(/"customerId":(\\d+)/) || 
                                 html.match(/customer_id=(\\d+)/) ||
                                 html.match(/data-customer-id="(\\d+)"/);
                                 
            if (customerMatch) {
              try {
                // Use the exact parameters from the verified fetch curl
                const res = await fetch('/settings/billing/copilot_usage_card?customer_id=' + customerMatch[1] + '&period=3&query=', {
                  headers: {
                    'github-verified-fetch': 'true',
                    'x-requested-with': 'XMLHttpRequest',
                    'accept': 'application/json'
                  }
                });
                if (res.ok) {
                  const json = await res.json();
                  // In the screenshot, discountQuantity is the consumed amount
                  consumed = (json.discountQuantity || json.netQuantity || '0').toString();
                  total = (json.userPremiumRequestEntitlement || '300').toString();
                  return { consumed, total, billed, lastUpdated: new Date().toISOString() };
                }
              } catch(e) {
                console.error("Fetch failed", e);
              }
            }

            // 3. Targeted search for the "X of 300 requests" pattern
            const usagePatterns = [
              /([\\d,]+(?:\\.\\d+)?)\\s*(?:of|\\/)\\s*([\\d,]+(?:\\.\\d+)?)\\s*(?:requests|included)/i,
              /([\\d,]+(?:\\.\\d+)?)\\s*requests\\s*used/i,
              /usage\\s*([\\d,]+(?:\\.\\d+)?)\\s*\\/\\s*([\\d,]+(?:\\.\\d+)?)/i,
              /([\\d,]+(?:\\.\\d+)?)\\s*of\\s*([\\d,]+(?:\\.\\d+)?)\\s*included/i
            ];

            for (const pattern of usagePatterns) {
              const match = bodyText.match(pattern);
              if (match) {
                consumed = match[1].replace(/,/g, '');
                if (match[2]) total = match[2].replace(/,/g, '');
                break;
              }
            }

            // 4. Fallback: Find the number preceding "300" in the text
            if (consumed === '0') {
              const tokens = bodyText.split(/\\s+/);
              const limitIdx = tokens.findIndex(t => t.includes('300'));
              if (limitIdx > 0) {
                const candidate = tokens[limitIdx - 1].replace(/[,\\/]/g, '');
                if (!isNaN(parseFloat(candidate)) && parseFloat(candidate) < 1000) {
                  consumed = candidate;
                }
              }
            }

            // Final validation: if consumed looks like a year, it's wrong
            if (parseInt(consumed) >= 2024 && !bodyText.includes(consumed + ' of')) consumed = '0';

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
    }, 45000); // 45s timeout for scraper
  });
}

async function refreshData() {
  await updateTrayMenu(); // Set to loading state
  try {
    const data = await getCopilotData();
    await updateTrayMenu(data);
  } catch (err: any) {
    console.error(err);
    await updateTrayMenu(undefined, err);
  }
}

async function createTray() {
  tray = new Tray(getIconPath())
  tray.setToolTip('Copilot Tracker')
  
  // Start initial fetch
  refreshData();
  
  // Auto refresh every 15 minutes
  setInterval(() => {
    refreshData();
  }, 15 * 60 * 1000);

  // Listen for cookie changes to auto-refresh
  session.defaultSession.cookies.on('changed', (_, cookie, cause, removed) => {
    if (cookie.name === 'user_session' && !removed && (cause === 'explicit' || cause === 'overwrite')) {
      refreshData();
    }
  });
}

app.whenReady().then(async () => {
  await createTray()

  if (process.platform === 'linux') {
    new Notification({
      title: 'Copilot Tracker Started',
      body: 'Monitoring background usage. Check the top bar for updates.',
      icon: path.join(process.env.VITE_PUBLIC || '', 'tray-icon.png')
    }).show()
  }
})

app.on('window-all-closed', () => {
  // Overriding default behaviour so app doesn't quit when debug/login windows are closed
})
