import os
import sys
import threading
import time
from datetime import datetime

import gi
gi.require_version('Gtk', '3.0')
gi.require_version('AyatanaAppIndicator3', '0.1')
from gi.repository import Gtk, AyatanaAppIndicator3 as AppIndicator, GLib, Gdk

from .scraper import get_copilot_data
from .auth import run_login
from .config import clear_session

# Constants
APP_ID = "copilot-tracker"
# Guide string should be longer than any possible label to reserve enough space in the topbar
GUIDE_STR = " 0000.0/000 • $000.00 " 
ICON_PATH = os.path.abspath(os.path.join(os.path.dirname(__file__), "assets", "tray-icon.png"))

class CopilotTrackerApp:
    def __init__(self):
        self.is_fetching = False
        self.last_fetch_time = 0
        
        self.indicator = AppIndicator.Indicator.new(
            APP_ID,
            ICON_PATH,
            AppIndicator.IndicatorCategory.APPLICATION_STATUS
        )
        self.indicator.set_status(AppIndicator.IndicatorStatus.ACTIVE)
        
        # Initial label
        self.indicator.set_label(" Loading...", GUIDE_STR)
        
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

        # Start periodic updates (every 15 minutes)
        GLib.timeout_add_seconds(15 * 60, self.refresh_data)
        
        # Initial fetch - Call once and don't loop
        GLib.idle_add(lambda: self.refresh_data() and False)

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

        print("Refreshing data...")
        self.is_fetching = True
        self.last_fetch_time = now
        
        # Show immediate feedback in both Topbar and Menu
        GLib.idle_add(self._show_fetching_ui)
        
        threading.Thread(target=self._fetch_thread, daemon=True).start()
        return True # Keep timeout alive

    def _show_fetching_ui(self):
        self.indicator.set_label(" Fetching...", GUIDE_STR)
        self.item_usage.set_label("Usage: Fetching...")
        self.item_billed.set_label("Billed: Fetching...")
        self.item_time.set_label("Last Checked: Fetching...")

    def _fetch_thread(self):
        try:
            data = get_copilot_data()
            GLib.idle_add(self.update_ui, data)
        except Exception as e:
            error_msg = str(e)
            print(f"Error: {error_msg}")
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
            
            label_text = f" {usage_str} • {billed_str}"
            self.indicator.set_label(label_text, GUIDE_STR)
            self.item_usage.set_label(f"Usage: {usage_str} requests")
            self.item_billed.set_label(f"Billed: {billed_str}")
            self.item_time.set_label(f"Last Checked: {datetime.now().strftime('%I:%M %p')}")
        except Exception as e:
            print(f"UI Update Error: {e}")
            self.update_ui_error("Error")

    def update_ui_error(self, message):
        self.indicator.set_label(f" {message}", GUIDE_STR)
        self.item_usage.set_label(message)
        self.item_billed.set_label("Billed: ...")
        self.item_time.set_label("Last Checked: ...")

def main():
    app = CopilotTrackerApp()
    Gtk.main()

if __name__ == "__main__":
    main()
