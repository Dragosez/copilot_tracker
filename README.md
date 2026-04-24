# Copilot Tracker (Native Linux Edition)

A native Linux topbar indicator to track your GitHub Copilot usage and billed amount. 

Unlike the Electron version, this native Python implementation supports wide horizontal text in the Ubuntu/GNOME topbar, mimicking the style of system indicators like CPU temperature or fan speed.

## Features
- **Native Topbar Label:** Displays `Usage • Billed` directly in the panel.
- **Lightweight:** Uses Python and GTK instead of a heavy Chromium-based app.
- **Native Login:** Uses a native WebKit2 window for GitHub authentication.
- **Autostart:** Automatically starts when you log into your desktop.

## Installation (Ubuntu/Debian)

1. Clone the repository.
2. Run the installer:
   ```bash
   make install
   ```
   *Note: This will ask for your sudo password to install the necessary system libraries (`python3-gi`, `webkit2`, `appindicator`).*

3. Launch it:
   ```bash
   copilot-tracker
   ```

## Uninstallation
To remove the app and its autostart entry:
```bash
make uninstall
```
