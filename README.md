# GitHub Copilot Tracker (Ubuntu)

A premium desktop application for Ubuntu that lives in your top bar and tracks your GitHub Copilot premium usage (Billed vs. Consumed requests).

![GitHub Copilot Tracker](public/icon.png)

## Features
- **Seamless Login**: Secure GitHub authentication via internal popup (no manual cookie copying).
- **Ubuntu Integration**: Stays pinned to the system tray/top bar.
- **Automated Scraping**: Uses a background service to fetch your billing data directly from GitHub.

## Prerequisites
- Ubuntu 20.04+ (or any modern Linux distro)
- Chrome or Chromium installed (required for scraping service)

## Installation

### 1. Download the Installer
Download the latest `.deb` package from the [Releases](https://github.com/Dragosez/copilot_tracker/releases) page.

### 2. Install
```bash
sudo dpkg -i copilot-tracker_1.0.0_amd64.deb
```

## Development

### Setup
```bash
pnpm install
```

### Run (Development)
```bash
pnpm run dev
```

### Build (.deb package)
```bash
pnpm run electron:build
```

## How it works
The app uses Electron to provide the desktop integration and a Puppeteer-based scraper to fetch data from `github.com/settings/billing/premium_stats`. Your credentials are never stored; the app only uses a local session cookie captured during the secure login flow.

---
Created by [Dragosez](https://github.com/Dragosez)
