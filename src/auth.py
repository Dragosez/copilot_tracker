import gi
gi.require_version('Gtk', '3.0')
gi.require_version('WebKit2', '4.1')
from gi.repository import Gtk, WebKit2, GLib
from .config import save_session

class LoginWindow(Gtk.Window):
    def __init__(self, on_success_callback):
        super().__init__(title="Login to GitHub")
        self.set_default_size(800, 900)
        self.on_success_callback = on_success_callback
        self.success_triggered = False

        # WebKit Setup
        self.webview = WebKit2.WebView()
        self.webview.load_uri("https://github.com/login")
        
        # Monitor cookies
        cookie_manager = self.webview.get_context().get_cookie_manager()
        cookie_manager.connect("changed", self._on_cookies_changed)

        # Scrolled window for the webview
        scrolled = Gtk.ScrolledWindow()
        scrolled.add(self.webview)
        self.add(scrolled)
        self.show_all()

    def _on_cookies_changed(self, cookie_manager):
        if self.success_triggered:
            return
        cookie_manager.get_cookies("https://github.com", None, self._on_get_cookies)

    def _on_get_cookies(self, cookie_manager, result):
        if self.success_triggered:
            return
            
        cookies = cookie_manager.get_cookies_finish(result)
        for cookie in cookies:
            if cookie.get_name() == "user_session":
                session_value = cookie.get_value()
                if session_value:
                    self.success_triggered = True
                    print("Session cookie captured!")
                    save_session(session_value)
                    
                    # Close and Cleanup
                    GLib.idle_add(self.destroy)
                    
                    if self.on_success_callback:
                        # Use a small delay to ensure the window is gone and resources are freed.
                        # We MUST return False from the timer callback to prevent it from repeating.
                        GLib.timeout_add(500, lambda: self.on_success_callback() and False)
                    break

def run_login(on_success=None):
    # Don't start a new Gtk.main(), use the existing one from main.py
    LoginWindow(on_success)
