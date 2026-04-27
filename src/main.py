import os
import sys
import threading
import time
import subprocess
import requests
from datetime import datetime

import gi
gi.require_version('Gtk', '3.0')
gi.require_version('AyatanaAppIndicator3', '0.1')
from gi.repository import Gtk, AyatanaAppIndicator3 as AppIndicator, GLib, Gdk, Gio

from .scraper import get_copilot_data
from .auth import run_login
from .config import clear_session

# Constants
APP_ID = "copilot-tracker"
VERSION = "1.0.1"
REPO_URL = "https://api.github.com/repos/Dragosez/copilot_tracker/releases/latest"
# Guide string should be longer than any possible label to reserve enough space in the topbar
# Using a generous guide to prevent the label from disappearing if it expands
GUIDE_STR = " 0000.0/0000 | $000.00 " 
ICON_PATH = os.path.abspath(os.path.join(os.path.dirname(__file__), "assets", "tray-icon.png"))

class CopilotTrackerApp:
    def __init__(self):
        self.is_fetching = False
        self.last_fetch_time = 0
        self.current_label = "Loading..."
        self.update_available = False
        self.latest_version_data = None
        
        self.indicator = AppIndicator.Indicator.new(
            APP_ID,
            ICON_PATH,
            AppIndicator.IndicatorCategory.APPLICATION_STATUS
        )
        self.indicator.set_status(AppIndicator.IndicatorStatus.ACTIVE)
        
        # Initial label
        self._safe_set_label(self.current_label)
        
        # Build menu
        self.menu = Gtk.Menu()
        
        self.item_usage = Gtk.MenuItem(label="Usage: ...")
        self.item_usage.set_sensitive(False)
        self.menu.append(self.item_usage)
        
        self.item_billed = Gtk.MenuItem(label="Billed: ...")
        self.item_billed.set_sensitive(False)
        self.menu.append(self.item_billed)
        
        self.item_time = Gtk.MenuItem(label="Last Checked: ...")
        self.item_time.set_sensitive(False)
        self.menu.append(self.item_time)
        
        self.menu.append(Gtk.SeparatorMenuItem())

        self.item_update = Gtk.MenuItem(label=f"Version: {VERSION}")
        self.item_update.connect("activate", self._on_update_clicked)
        self.menu.append(self.item_update)
        
        self.menu.append(Gtk.SeparatorMenuItem())
        
        item_refresh = Gtk.MenuItem(label="Refresh Data")
        item_refresh.connect("activate", lambda _: self.refresh_data(force=True))
        self.menu.append(item_refresh)
        
        item_login = Gtk.MenuItem(label="Login / Change Account")
        item_login.connect("activate", lambda _: self.open_login())
        self.menu.append(item_login)
        
        self.menu.append(Gtk.SeparatorMenuItem())
        
        item_logout = Gtk.MenuItem(label="Logout")
        item_logout.connect("activate", lambda _: self.logout())
        self.menu.append(item_logout)
        
        item_quit = Gtk.MenuItem(label="Quit")
        item_quit.connect("activate", lambda _: Gtk.main_quit())
        self.menu.append(item_quit)
        
        self.menu.show_all()
        self.indicator.set_menu(self.menu)

        # Listen for screen unlock (multiple standards to ensure coverage)
        try:
            self.bus = Gio.bus_get_sync(Gio.BusType.SESSION, None)
            
            # GNOME specific
            self.bus.signal_subscribe(
                "org.gnome.ScreenSaver",
                "org.gnome.ScreenSaver",
                "ActiveChanged",
                "/org/gnome/ScreenSaver",
                None,
                Gio.DBusSignalFlags.NONE,
                self._on_screen_saver_changed,
                None
            )
            
            # Freedesktop / Standard fallback
            self.bus.signal_subscribe(
                "org.freedesktop.ScreenSaver",
                "org.freedesktop.ScreenSaver",
                "ActiveChanged",
                None,
                None,
                Gio.DBusSignalFlags.NONE,
                self._on_screen_saver_changed,
                None
            )
        except Exception as e:
            print(f"DBus listener skipped: {e}")

        # Start periodic updates (every 15 minutes)
        GLib.timeout_add_seconds(15 * 60, self.refresh_data)
        
        # UI Heartbeat: Re-apply the label frequently with a "poke" to fix disappearing text
        GLib.timeout_add_seconds(15, self._ui_heartbeat)
        
        # Initial fetch - Call once and don't loop
        GLib.idle_add(lambda: self.refresh_data() and False)

        # Check for updates in background
        threading.Thread(target=self._check_for_updates, daemon=True).start()

    def _check_for_updates(self):
        try:
            print(f"Checking for updates at {REPO_URL}...")
            response = requests.get(REPO_URL, timeout=10)
            if response.status_code == 200:
                data = response.json()
                latest_tag = data.get("tag_name", "").replace("v", "")
                
                if self._is_newer(latest_tag, VERSION):
                    print(f"Update available: {VERSION} -> {latest_tag}")
                    self.update_available = True
                    self.latest_version_data = data
                    GLib.idle_add(lambda: self.item_update.set_label(f"Update to v{latest_tag} Available!"))
                else:
                    print(f"Already on latest version: {VERSION}")
        except Exception as e:
            print(f"Update check failed: {e}")

    def _is_newer(self, latest, current):
        try:
            l_parts = [int(p) for p in latest.split(".")]
            c_parts = [int(p) for p in current.split(".")]
            return l_parts > c_parts
        except:
            return latest != current

    def _on_update_clicked(self, _):
        if not self.update_available or not self.latest_version_data:
            return

        dialog = Gtk.MessageDialog(
            transient_for=None,
            flags=0,
            message_type=Gtk.MessageType.QUESTION,
            buttons=Gtk.ButtonsType.YES_NO,
            text=f"New version v{self.latest_version_data['tag_name']} is available!"
        )
        dialog.format_secondary_text("Would you like to download and install it now?")
        response = dialog.run()
        dialog.destroy()

        if response == Gtk.ResponseType.YES:
            threading.Thread(target=self._perform_update, daemon=True).start()

    def _perform_update(self):
        try:
            GLib.idle_add(lambda: self.item_update.set_label("Updating..."))
            
            # Find .deb asset
            assets = self.latest_version_data.get("assets", [])
            deb_url = next((a["browser_download_url"] for a in assets if a["name"].endswith(".deb")), None)
            
            if not deb_url:
                raise Exception("No .deb package found in the latest release.")

            print(f"Downloading update from {deb_url}...")
            temp_path = "/tmp/copilot-tracker-update.deb"
            
            with requests.get(deb_url, stream=True) as r:
                r.raise_for_status()
                with open(temp_path, 'wb') as f:
                    for chunk in r.iter_content(chunk_size=8192):
                        f.write(chunk)

            print("Installing update via pkexec...")
            # Use pkexec to prompt for password and install the deb
            cmd = f'pkexec dpkg -i {temp_path}'
            process = subprocess.Popen(cmd, shell=True)
            process.wait()

            if process.returncode == 0:
                print("Update installed successfully. Restarting...")
                # Restart the app
                os.execv(sys.executable, ['python3'] + sys.argv)
            else:
                raise Exception(f"Installation failed with exit code {process.returncode}")

        except Exception as e:
            print(f"Update error: {e}")
            GLib.idle_add(lambda: self.item_update.set_label(f"Update Failed: {str(e)[:20]}..."))

    def _on_screen_saver_changed(self, conn, sender, path, interface, signal, params, user_data):
        """Called when screen locks or unlocks"""
        is_active = params.unpack()[0]
        if not is_active: # Unlocked
            print(f"[{datetime.now().strftime('%H:%M:%S')}] Screen unlocked, forcing UI refresh...")
            # Small delay to let the panel settle after wake
            GLib.timeout_add(2000, lambda: self._ui_heartbeat() and False)

    def _ui_heartbeat(self):
        """Forcefully re-set the label by toggling a space to bypass extension caching"""
        label = self.current_label
        # Toggle a trailing space to force the extension to see a 'change'
        if label.endswith(" "):
            new_label = label.rstrip(" ")
        else:
            new_label = label + " "
        
        self._safe_set_label(new_label)
        return True

    def _safe_set_label(self, label):
        """Helper to set label with error handling and logging"""
        self.current_label = label
        def _do_set():
            try:
                # Use a fixed long guide of spaces to ensure the extension reserves enough room
                self.indicator.set_label(label, " " * 35)
                # Re-asserting status helps some extensions redraw
                self.indicator.set_status(AppIndicator.IndicatorStatus.ACTIVE)
            except Exception as e:
                print(f"Error setting label: {e}")
            return False

        GLib.idle_add(_do_set)

    def open_login(self):
        run_login(on_success=lambda: self.refresh_data(force=True))

    def logout(self):
        clear_session()
        self.update_ui_error("Logged Out")

    def refresh_data(self, force=False):
        # Prevent spamming if already fetching or if we just tried recently and failed
        now = time.time()
        if not force and (self.is_fetching or (now - self.last_fetch_time < 30)):
            return True

        print(f"[{datetime.now().strftime('%H:%M:%S')}] Refreshing data...")
        self.is_fetching = True
        self.last_fetch_time = now
        
        # Show immediate feedback
        self._show_fetching_ui()
        
        threading.Thread(target=self._fetch_thread, daemon=True).start()
        return True # Keep timeout alive

    def _show_fetching_ui(self):
        self._safe_set_label("Fetching...")
        self.item_usage.set_label("Usage: Fetching...")
        self.item_billed.set_label("Billed: Fetching...")
        self.item_time.set_label("Last Checked: Fetching...")

    def _fetch_thread(self):
        try:
            data = get_copilot_data()
            GLib.idle_add(self.update_ui, data)
        except Exception as e:
            error_msg = str(e)
            print(f"Error in fetch thread: {error_msg}")
            if "AUTH_EXPIRED" in error_msg:
                GLib.idle_add(self.update_ui_error, "Login Required")
            else:
                GLib.idle_add(self.update_ui_error, "Error")
        finally:
            self.is_fetching = False

    def update_ui(self, data):
        try:
            consumed = float(data['consumed'])
            formatted_consumed = int(consumed) if consumed % 1 == 0 else round(consumed, 1)
            
            usage_str = f"{formatted_consumed}/{data['total']}"
            billed_str = data['billed']
            
            label_text = f"{usage_str} | {billed_str}"
            self._safe_set_label(label_text)
            self.item_usage.set_label(f"Usage: {usage_str} requests")
            self.item_billed.set_label(f"Billed: {billed_str}")
            self.item_time.set_label(f"Last Checked: {datetime.now().strftime('%I:%M %p')}")
        except Exception as e:
            print(f"UI Update Error: {e}")
            self.update_ui_error("Error")

    def update_ui_error(self, message):
        self._safe_set_label(message)
        self.item_usage.set_label(message)
        self.item_billed.set_label("Billed: ...")
        self.item_time.set_label("Last Checked: ...")

def main():
    app = CopilotTrackerApp()
    Gtk.main()

if __name__ == "__main__":
    main()
