#!/bin/bash
#
# Speech Timer - Installations-Script für Raspberry Pi 4
# Richtet alle benötigten Dienste und Dateien ein
#

set -e

echo "==================================="
echo "  Speech Timer - Installation"
echo "==================================="
echo ""

# Prüfen ob als pi-User oder mit sudo ausgeführt
if [ "$(whoami)" != "pi" ] && [ "$EUID" -ne 0 ]; then
    echo "Dieses Script sollte als 'pi' User ausgeführt werden."
    echo "Nutze: cd ~/speech-timer-pi && ./scripts/install.sh"
    exit 1
fi

PROJECT_DIR="/home/pi/speech-timer-pi"

# Falls nicht im Projektverzeichnis, dorthin wechseln
if [ ! -f "$PROJECT_DIR/app.py" ]; then
    echo "FEHLER: Projektverzeichnis $PROJECT_DIR nicht gefunden."
    echo "Bitte kopiere zunächst alle Dateien nach $PROJECT_DIR"
    exit 1
fi

cd "$PROJECT_DIR"

# ============================================================
# 1. System-Pakete aktualisieren
# ============================================================
echo "[1/6] Aktualisiere System-Pakete..."
sudo apt-get update

# Standard-Pakete installieren
sudo apt-get install -y \
    python3 python3-pip python3-venv \
    unclutter \
    xdotool \
    wireless-tools \
    wpasupplicant

# Chromium-Paket je nach OS-Version ermitteln:
# - Bullseye und älter: chromium-browser
# - Bookworm und neuer: chromium
echo "[1b/6] Suche Chromium-Paket..."
if apt-cache show chromium-browser > /dev/null 2>&1; then
    echo "  → Installiere chromium-browser (Bullseye oder älter)"
    sudo apt-get install -y chromium-browser
    CHROMIUM_BIN="chromium-browser"
elif apt-cache show chromium > /dev/null 2>&1; then
    echo "  → Installiere chromium (Bookworm oder neuer)"
    sudo apt-get install -y chromium
    CHROMIUM_BIN="chromium"
else
    echo "  ✗ Weder chromium noch chromium-browser verfügbar!"
    echo "    Bitte manuell installieren und kiosk.sh anpassen."
    exit 1
fi

# Kiosk-Script an erkanntes Binary anpassen
sed -i "s|^CHROMIUM_BIN=.*|CHROMIUM_BIN=\"$CHROMIUM_BIN\"|" "$PROJECT_DIR/scripts/kiosk.sh"
echo "  → kiosk.sh angepasst: nutzt $CHROMIUM_BIN"

# ============================================================
# 2. Python Virtual Environment
# ============================================================
echo "[2/6] Erstelle Python Virtual Environment..."
if [ ! -d "venv" ]; then
    python3 -m venv venv
fi
source venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt

# ============================================================
# 2b. Socket.IO Client-Bibliothek lokal speichern
# ============================================================
echo "[2b/6] Lade Socket.IO-Client-Bibliothek..."
SOCKETIO_FILE="$PROJECT_DIR/static/js/socket.io.min.js"
SOCKETIO_VERSION="4.7.5"

if [ -f "$SOCKETIO_FILE" ]; then
    echo "  → Socket.IO-Datei bereits vorhanden, überspringe Download"
else
    SOCKETIO_URLS=(
        "https://cdn.socket.io/${SOCKETIO_VERSION}/socket.io.min.js"
        "https://cdn.jsdelivr.net/npm/socket.io-client@${SOCKETIO_VERSION}/dist/socket.io.min.js"
        "https://cdnjs.cloudflare.com/ajax/libs/socket.io/${SOCKETIO_VERSION}/socket.io.min.js"
    )

    DOWNLOAD_OK=false
    for URL in "${SOCKETIO_URLS[@]}"; do
        echo "  → Versuche: $URL"
        if curl -fsSL --max-time 30 -o "$SOCKETIO_FILE.tmp" "$URL" 2>/dev/null; then
            # Prüfe ob Datei sinnvoll groß ist (sollte > 30 KB sein)
            FILE_SIZE=$(stat -c%s "$SOCKETIO_FILE.tmp" 2>/dev/null || echo 0)
            if [ "$FILE_SIZE" -gt 30000 ]; then
                mv "$SOCKETIO_FILE.tmp" "$SOCKETIO_FILE"
                echo "  ✓ Socket.IO erfolgreich geladen ($FILE_SIZE Bytes)"
                DOWNLOAD_OK=true
                break
            else
                rm -f "$SOCKETIO_FILE.tmp"
                echo "  ✗ Datei zu klein, versuche nächste Quelle"
            fi
        fi
    done

    if [ "$DOWNLOAD_OK" = false ]; then
        echo ""
        echo "  ⚠️  WARNUNG: Socket.IO konnte nicht geladen werden!"
        echo "     Bitte später manuell herunterladen:"
        echo "     wget -O $SOCKETIO_FILE \\"
        echo "       https://cdn.socket.io/${SOCKETIO_VERSION}/socket.io.min.js"
        echo ""
        echo "  Oder die Datei per USB übertragen nach:"
        echo "     $SOCKETIO_FILE"
        echo ""
        echo "  Ohne diese Datei zeigt der Timer permanent 00:00."
        echo ""
    fi
fi

# ============================================================
# 3. Script-Berechtigungen
# ============================================================
echo "[3/6] Setze Script-Berechtigungen..."
chmod +x scripts/kiosk.sh
chmod +x scripts/install.sh

# ============================================================
# 4. Sudoers-Eintrag für systemrelevante Befehle
# ============================================================
echo "[4/6] Konfiguriere sudo-Rechte..."
SUDOERS_FILE="/etc/sudoers.d/speech-timer"
sudo tee "$SUDOERS_FILE" > /dev/null <<EOF
# Speech Timer benötigt diese Befehle ohne Passwort
pi ALL=(ALL) NOPASSWD: /usr/bin/date, /usr/sbin/hwclock, /usr/bin/timedatectl
pi ALL=(ALL) NOPASSWD: /usr/sbin/iwlist, /usr/bin/wpa_cli
pi ALL=(ALL) NOPASSWD: /usr/bin/tee /etc/wpa_supplicant/wpa_supplicant.conf
pi ALL=(ALL) NOPASSWD: /usr/bin/tee /sys/class/backlight/rpi_backlight/brightness
EOF
sudo chmod 0440 "$SUDOERS_FILE"

# ============================================================
# 5. Systemd-Service installieren
# ============================================================
echo "[5/6] Installiere Systemd-Service..."
sudo cp systemd/speech-timer.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable speech-timer.service
sudo systemctl start speech-timer.service

# ============================================================
# 6. Autostart für Kiosk-Modus
# ============================================================
echo "[6/6] Konfiguriere Kiosk-Autostart..."
AUTOSTART_DIR="/home/pi/.config/autostart"
mkdir -p "$AUTOSTART_DIR"
cp systemd/speech-timer-kiosk.desktop "$AUTOSTART_DIR/"

# LXDE-Autostart alternativ (ältere Pi OS Versionen)
LXDE_AUTOSTART="/home/pi/.config/lxsession/LXDE-pi/autostart"
if [ -f "$LXDE_AUTOSTART" ]; then
    if ! grep -q "kiosk.sh" "$LXDE_AUTOSTART"; then
        echo "@$PROJECT_DIR/scripts/kiosk.sh" >> "$LXDE_AUTOSTART"
    fi
fi

# ============================================================
# Fertig
# ============================================================
IP=$(hostname -I | awk '{print $1}')
echo ""
echo "==================================="
echo "  Installation abgeschlossen!"
echo "==================================="
echo ""
echo "Der Speech Timer Service läuft jetzt."
echo ""
echo "🖥️  Display:    http://$IP:5000/"
echo "🎛️  Steuerung: http://$IP:5000/control"
echo "⚙️  Einstell.: http://$IP:5000/settings"
echo ""
echo "Beim nächsten Neustart öffnet sich der"
echo "Browser automatisch im Kiosk-Modus."
echo ""
echo "Jetzt neu starten mit:  sudo reboot"
echo ""
