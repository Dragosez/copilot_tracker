#!/bin/bash
set -e

APP_NAME="copilot-tracker"
# Use version from argument if provided, otherwise default or extract from src/main.py
if [ ! -z "$1" ]; then
    # Remove 'v' prefix if present
    VERSION=$(echo $1 | sed 's/^v//')
    echo "Using provided version: $VERSION"
    # Update VERSION in src/main.py to match
    sed -i "s/^VERSION = \".*\"/VERSION = \"$VERSION\"/" src/main.py
else
    # Extract version from src/main.py if not provided
    VERSION=$(grep "^VERSION =" src/main.py | cut -d '"' -f 2)
    echo "Using version from src/main.py: $VERSION"
fi

BUILD_DIR="build/deb"
STAGED_DIR="$BUILD_DIR/$APP_NAME-$VERSION"

echo "Creating build directory..."
rm -rf $BUILD_DIR
mkdir -p $STAGED_DIR/DEBIAN
mkdir -p $STAGED_DIR/opt/$APP_NAME
mkdir -p $STAGED_DIR/usr/bin
mkdir -p $STAGED_DIR/usr/share/applications
mkdir -p $STAGED_DIR/etc/xdg/autostart

# Copy source files
cp -r src run.py $STAGED_DIR/opt/$APP_NAME/

# Create launcher script
cat <<EOF > $STAGED_DIR/usr/bin/$APP_NAME
#!/bin/bash
python3 /opt/$APP_NAME/run.py "\$@"
EOF
chmod +x $STAGED_DIR/usr/bin/$APP_NAME

# Create Desktop Entry (Menu)
cat <<EOF > $STAGED_DIR/usr/share/applications/$APP_NAME.desktop
[Desktop Entry]
Type=Application
Exec=/usr/bin/$APP_NAME
Name=Copilot Tracker
Comment=Track Copilot Usage
Icon=/opt/$APP_NAME/src/assets/icon.png
Categories=Utility;
Terminal=false
EOF

# Create Autostart Entry
cp $STAGED_DIR/usr/share/applications/$APP_NAME.desktop $STAGED_DIR/etc/xdg/autostart/

# Create Control file (metadata)
cat <<EOF > $STAGED_DIR/DEBIAN/control
Package: $APP_NAME
Version: $VERSION
Section: utils
Priority: optional
Architecture: all
Maintainer: Dragos <dragos@example.com>
Depends: python3, python3-gi, gir1.2-ayatanaappindicator3-0.1, gir1.2-webkit2-4.1, python3-requests, python3-bs4
Description: Native Linux topbar indicator for GitHub Copilot usage.
 Supports wide horizontal text in Ubuntu/GNOME.
EOF

echo "Building .deb package..."
dpkg-deb --build $STAGED_DIR

echo "Package created: $STAGED_DIR.deb"
mv $STAGED_DIR.deb ./$APP_NAME.deb
