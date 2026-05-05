#!/bin/bash
#
# Speech Timer - Kiosk Autostart Script
# Startet den Chromium-Browser im Vollbild-Modus und zeigt die Display-Seite
#

# Chromium-Binary: wird vom install.sh automatisch gesetzt.
# Bei Bookworm: chromium, bei Bullseye und älter: chromium-browser
CHROMIUM_BIN="chromium"

# Fallback: Wenn das gesetzte Binary nicht existiert, suche Alternative
if ! command -v "$CHROMIUM_BIN" > /dev/null 2>&1; then
    if command -v chromium-browser > /dev/null 2>&1; then
        CHROMIUM_BIN="chromium-browser"
    elif command -v chromium > /dev/null 2>&1; then
        CHROMIUM_BIN="chromium"
    else
        echo "FEHLER: Kein Chromium-Browser installiert!"
        exit 1
    fi
fi

# Warte bis die Flask-App erreichbar ist
MAX_WAIT=60
COUNT=0
while ! curl -s http://localhost:5000/ > /dev/null; do
    sleep 1
    COUNT=$((COUNT + 1))
    if [ $COUNT -ge $MAX_WAIT ]; then
        echo "Flask-Server nach ${MAX_WAIT}s nicht erreichbar!"
        exit 1
    fi
done

# Wayland oder X11?
SESSION="${XDG_SESSION_TYPE:-x11}"

if [ "$SESSION" = "wayland" ]; then
    # Wayland: Cursor über Cursor-Theme-Größe 0 verstecken
    export XCURSOR_SIZE=0
    export XCURSOR_THEME=none
    PLATFORM_FLAGS="--ozone-platform=wayland --enable-features=UseOzonePlatform"
else
    # X11: Energiesparmodus deaktivieren + unclutter
    xset s off 2>/dev/null
    xset s noblank 2>/dev/null
    xset -dpms 2>/dev/null
    unclutter -idle 1 -root &
    PLATFORM_FLAGS=""
fi

# Eventuelle Absturz-Meldungen verhindern
USER_DATA_DIR="/home/pi/.config/chromium"
sed -i 's/"exited_cleanly":false/"exited_cleanly":true/' \
    "$USER_DATA_DIR/Default/Preferences" 2>/dev/null
sed -i 's/"exit_type":"Crashed"/"exit_type":"Normal"/' \
    "$USER_DATA_DIR/Default/Preferences" 2>/dev/null

# Chromium im Kiosk-Modus starten
"$CHROMIUM_BIN" \
    --kiosk \
    --noerrdialogs \
    --disable-infobars \
    --disable-translate \
    --disable-features=TranslateUI \
    --disable-session-crashed-bubble \
    --check-for-update-interval=31536000 \
    --autoplay-policy=no-user-gesture-required \
    --incognito \
    $PLATFORM_FLAGS \
    http://localhost:5000/
