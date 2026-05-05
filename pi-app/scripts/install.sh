#!/bin/bash
#
# Speech Timer - Installations-Script für Raspberry Pi 4/5
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
    echo "Nutze: cd ~/speech-timer-pi && bash scripts/install.sh"
    exit 1
fi

PROJECT_DIR="/home/pi/speech-timer-pi"

# Falls nicht im Projektverzeichnis, dorthin wechseln
if [ ! -f "$PROJECT_DIR/app.py" ]; then
    echo "FEHLER: $PROJECT_DIR/app.py nicht gefunden."
    echo ""
    echo "Das Script erwartet die Pi-App unter $PROJECT_DIR."
    echo "Wenn du das Repo geklont hast, kopiere nur den Inhalt des"
    echo "pi-app/-Ordners dorthin, z.B.:"
    echo ""
    echo "  cp -r ~/speech-timer-pi-repo/pi-app/. ~/speech-timer-pi/"
    echo ""
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
    wpasupplicant \
    curl

# Chromium-Paket je nach OS-Version ermitteln:
# - Bullseye: chromium-browser (RPi-Foundation-Fork)
# - Bookworm/Trixie: chromium (Debian-Standard)
# Wir prüfen mit `apt-cache policy`, ob es einen echten Installations-Kandidaten
# gibt – `apt-cache show` liefert auch False-Positives für virtuelle Pakete.
echo "[1b/6] Suche Chromium-Paket..."

has_install_candidate() {
    local pkg="$1"
    # Extrahiere die 'Candidate:'-Zeile und prüfe, ob sie nicht '(none)' ist
    apt-cache policy "$pkg" 2>/dev/null \
        | awk -v p="$pkg" '/^[[:space:]]*Candidate:/ { if ($2 != "(none)") found=1 } END { exit !found }'
}

CHROMIUM_BIN=""

# Falls Chromium bereits installiert ist, nutzen wir es einfach
if command -v chromium > /dev/null 2>&1; then
    echo "  -> chromium ist bereits installiert"
    CHROMIUM_BIN="chromium"
elif command -v chromium-browser > /dev/null 2>&1; then
    echo "  -> chromium-browser ist bereits installiert"
    CHROMIUM_BIN="chromium-browser"
# Sonst: das richtige Paket aussuchen. 'chromium' zuerst, da auf Bookworm+Trixie Standard.
elif has_install_candidate chromium; then
    echo "  -> Installiere chromium (Bookworm/Trixie)"
    sudo apt-get install -y chromium
    CHROMIUM_BIN="chromium"
elif has_install_candidate chromium-browser; then
    echo "  -> Installiere chromium-browser (Bullseye)"
    sudo apt-get install -y chromium-browser
    CHROMIUM_BIN="chromium-browser"
else
    echo "  !! Weder chromium noch chromium-browser verfügbar!"
    echo "     Prüfe deine apt-Quellen (z.B. mit 'apt-cache policy chromium')."
    echo "     Manuell installieren mit: sudo apt install chromium"
    exit 1
fi

# Sanity check: Das Binary muss tatsächlich im Pfad sein
if ! command -v "$CHROMIUM_BIN" > /dev/null 2>&1; then
    echo "  !! '$CHROMIUM_BIN' wurde gemeldet, aber das Binary fehlt!"
    echo "     Bitte prüfe mit: which chromium chromium-browser"
    exit 1
fi
echo "  -> Nutze: $(command -v "$CHROMIUM_BIN")"

# Kiosk-Script an erkanntes Binary anpassen
sed -i "s|^CHROMIUM_BIN=.*|CHROMIUM_BIN=\"$CHROMIUM_BIN\"|" "$PROJECT_DIR/scripts/kiosk.sh"
echo "  -> kiosk.sh angepasst: nutzt $CHROMIUM_BIN"

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
    echo "  -> Socket.IO-Datei bereits vorhanden, überspringe Download"
else
    SOCKETIO_URLS=(
        "https://cdn.socket.io/${SOCKETIO_VERSION}/socket.io.min.js"
        "https://cdn.jsdelivr.net/npm/socket.io-client@${SOCKETIO_VERSION}/dist/socket.io.min.js"
        "https://cdnjs.cloudflare.com/ajax/libs/socket.io/${SOCKETIO_VERSION}/socket.io.min.js"
    )

    DOWNLOAD_OK=false
    for URL in "${SOCKETIO_URLS[@]}"; do
        echo "  -> Versuche: $URL"
        if curl -fsSL --max-time 30 -o "$SOCKETIO_FILE.tmp" "$URL" 2>/dev/null; then
            FILE_SIZE=$(stat -c%s "$SOCKETIO_FILE.tmp" 2>/dev/null || echo 0)
            if [ "$FILE_SIZE" -gt 30000 ]; then
                mv "$SOCKETIO_FILE.tmp" "$SOCKETIO_FILE"
                echo "  -> Socket.IO geladen ($FILE_SIZE Bytes)"
                DOWNLOAD_OK=true
                break
            else
                rm -f "$SOCKETIO_FILE.tmp"
                echo "  -> Datei zu klein, nächste Quelle"
            fi
        fi
    done

    if [ "$DOWNLOAD_OK" = false ]; then
        echo ""
        echo "  !! WARNUNG: Socket.IO konnte nicht geladen werden!"
        echo "     Später manuell:"
        echo "     curl -o $SOCKETIO_FILE \\"
        echo "       https://cdn.socket.io/${SOCKETIO_VERSION}/socket.io.min.js"
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
# 3b. WLAN-Land setzen (verhindert rfkill-Block des Interfaces)
# ============================================================
echo "[3b/6] Setze WLAN-Regulatory-Domain..."
if command -v raspi-config > /dev/null 2>&1; then
    CURRENT_COUNTRY=$(grep -o 'cfg80211.ieee80211_regdom=[A-Z]*' /boot/firmware/cmdline.txt 2>/dev/null | cut -d= -f2 || true)
    if [ -z "$CURRENT_COUNTRY" ]; then
        sudo raspi-config nonint do_wifi_country DE
        echo "  -> WLAN-Land auf DE gesetzt (kann in raspi-config geändert werden)"
    else
        echo "  -> WLAN-Land bereits gesetzt: $CURRENT_COUNTRY"
    fi
    sudo rfkill unblock wifi 2>/dev/null || true
else
    echo "  !! raspi-config nicht gefunden – WLAN-Land bitte manuell setzen:"
    echo "     sudo raspi-config  →  Localisation Options → WLAN Country"
fi

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
# 5b. Stream Deck: udev-Regel + Service (optional)
# ============================================================
echo "[5b/6] Konfiguriere Stream Deck Support (optional)..."

# Systempakete für Stream Deck (libhidapi für USB-HID-Zugriff)
sudo apt-get install -y libhidapi-libusb0 libusb-1.0-0 libjpeg-dev zlib1g-dev

# udev-Regel: 'pi'-User darf Stream Deck ohne sudo ansprechen
UDEV_RULE="/etc/udev/rules.d/70-streamdeck.rules"
sudo tee "$UDEV_RULE" > /dev/null <<'EOF'
# Elgato Stream Deck - Zugriff für plugdev/pi
SUBSYSTEM=="usb", ATTRS{idVendor}=="0fd9", MODE="0666", GROUP="plugdev"
KERNEL=="hidraw*", ATTRS{idVendor}=="0fd9", MODE="0666", GROUP="plugdev"
EOF

# pi zur plugdev-Gruppe hinzufügen (ist meist schon drin, schadet aber nicht)
sudo usermod -aG plugdev pi 2>/dev/null || true

# udev-Regeln neu einlesen
sudo udevadm control --reload-rules
sudo udevadm trigger

# systemd-Service für Stream Deck Controller installieren (aber NICHT starten)
# Service startet automatisch wenn Stream Deck angesteckt ist und der Pi bootet.
# Manuell aktivieren mit: sudo systemctl enable speech-timer-streamdeck
if [ -f systemd/speech-timer-streamdeck.service ]; then
    sudo cp systemd/speech-timer-streamdeck.service /etc/systemd/system/
    sudo systemctl daemon-reload
    # Auto-Enable nur wenn Stream Deck erkannt wird (Vendor-ID 0fd9)
    if lsusb 2>/dev/null | grep -qi "0fd9"; then
        echo "  -> Stream Deck erkannt, Service wird aktiviert"
        sudo systemctl enable speech-timer-streamdeck.service
        sudo systemctl start speech-timer-streamdeck.service
    else
        echo "  -> Kein Stream Deck angesteckt - Service ist installiert,"
        echo "     wird nicht automatisch gestartet."
        echo "     Aktivieren mit: sudo systemctl enable --now speech-timer-streamdeck"
    fi
fi

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
echo "Display:    http://$IP:5000/"
echo "Steuerung:  http://$IP:5000/control"
echo "Einstell.:  http://$IP:5000/settings"
echo ""
echo "Beim nächsten Neustart öffnet sich der"
echo "Browser automatisch im Kiosk-Modus."
echo ""
echo "Jetzt neu starten mit:  sudo reboot"
echo ""
