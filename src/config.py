import os
import json

CONFIG_DIR = os.path.expanduser("~/.config/copilot-tracker")
CONFIG_FILE = os.path.join(CONFIG_DIR, "config.json")

def ensure_config_dir():
    if not os.path.exists(CONFIG_DIR):
        os.makedirs(CONFIG_DIR)

def save_session(cookie_value):
    ensure_config_dir()
    data = {"user_session": cookie_value}
    with open(CONFIG_FILE, "w") as f:
        json.dump(data, f)

def load_session():
    if not os.path.exists(CONFIG_FILE):
        return None
    try:
        with open(CONFIG_FILE, "r") as f:
            data = json.load(f)
            return data.get("user_session")
    except:
        return None

def clear_session():
    if os.path.exists(CONFIG_FILE):
        os.remove(CONFIG_FILE)
