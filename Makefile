INSTALL_DIR = $(HOME)/.local/share/copilot-tracker
BIN_DIR = $(HOME)/.local/bin
AUTOSTART_DIR = $(HOME)/.config/autostart
APPS_DIR = $(HOME)/.local/share/applications

.PHONY: install
install:
	@echo "Installing system dependencies..."
	@sudo apt-get install -y python3-gi gir1.2-ayatanaappindicator3-0.1 gir1.2-webkit2-4.1 python3-requests python3-bs4 || (echo "Apt failed, trying to continue with what we have..." && true)
	@echo "Creating directories..."
	@mkdir -p $(INSTALL_DIR)
	@mkdir -p $(BIN_DIR)
	@mkdir -p $(AUTOSTART_DIR)
	@mkdir -p $(APPS_DIR)
	@echo "Copying files..."
	@cp -r src run.py $(INSTALL_DIR)/
	@echo "Creating executable..."
	@echo '#!/bin/bash\npython3 $(INSTALL_DIR)/run.py "$$@"' > $(BIN_DIR)/copilot-tracker
	@chmod +x $(BIN_DIR)/copilot-tracker
	@echo "Creating desktop entries..."
	@echo "[Desktop Entry]\nType=Application\nExec=$(BIN_DIR)/copilot-tracker\nHidden=false\nNoDisplay=false\nX-GNOME-Autostart-enabled=true\nName=Copilot Tracker\nComment=Track Copilot Usage\nIcon=$(INSTALL_DIR)/src/assets/icon.png" > $(AUTOSTART_DIR)/copilot-tracker.desktop
	@echo "[Desktop Entry]\nType=Application\nExec=$(BIN_DIR)/copilot-tracker\nName=Copilot Tracker\nComment=Track Copilot Usage\nIcon=$(INSTALL_DIR)/src/assets/icon.png\nCategories=Utility;\nTerminal=false" > $(APPS_DIR)/copilot-tracker.desktop
	@echo "Installation complete! Run 'copilot-tracker' to start, or find it in your app menu."

.PHONY: uninstall
uninstall:
	@rm -rf $(INSTALL_DIR)
	@rm -f $(BIN_DIR)/copilot-tracker
	@rm -f $(AUTOSTART_DIR)/copilot-tracker.desktop
	@rm -f $(APPS_DIR)/copilot-tracker.desktop
	@echo "Uninstalled."

.PHONY: deb
deb:
	@bash scripts/build_deb.sh $(VERSION)
