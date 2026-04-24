# Copilot Tracker (Native Linux Edition)

A native Linux topbar indicator to track your GitHub Copilot usage and billed amount. 

Unlike the Electron version, this native Python implementation supports wide horizontal text in the Ubuntu/GNOME topbar, mimicking the style of system indicators like CPU temperature or fan speed.

## Features
- **Native Topbar Label:** Displays `Usage • Billed` directly in the panel.
- **Lightweight:** Uses Python and GTK instead of a heavy Chromium-based app.
- **Native Login:** Uses a native WebKit2 window for GitHub authentication.
- **Autostart:** Automatically starts when you log into your desktop.

## Installation

### Option 1: Install via .deb (Recommended for most users)
The `.deb` package is the easiest way to install. It automatically handles all system dependencies for you.

1. Download the latest `copilot-tracker.deb` from the [Releases](https://github.com/Dragosez/copilot-tracker/releases) tab.
2. Install it using `apt` (this ensures dependencies are downloaded):
   ```bash
   sudo apt install ./copilot-tracker.deb
   ```
   *Note: Using `dpkg -i` may fail if you are missing dependencies. If that happens, run `sudo apt install -f` to fix them.*

### Option 2: Build from Source
If you want to install directly from this folder:

1. Run the installer:
   ```bash
   make install
   ```
   *Note: This will ask for your sudo password to install the necessary system libraries (`python3-gi`, `webkit2`, `appindicator`).*

2. Launch it:
   ```bash
   copilot-tracker
   ```

## Autostart at Boot
The application is configured to start automatically as soon as you log into your desktop.
- **Verification:** Open the "Startup Applications" app in Ubuntu; you should see "Copilot Tracker" in the list.
- **Manual Control:** You can enable or disable the autostart behavior through the "Startup Applications" menu.

## Uninstallation
To remove the app and its configuration:

**If installed via .deb:**
```bash
sudo apt remove copilot-tracker
```

**If installed via Source:**
```bash
make uninstall
```
