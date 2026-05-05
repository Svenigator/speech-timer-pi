# Speech Timer Pi

Ein Timer für Vorträge und Präsentationen auf dem Raspberry Pi – mit Vollbild-Display, Web-Steuerung, OSC-Integration und einem Companion-Modul für Stream Deck.

![Version](https://img.shields.io/badge/version-3.0.1-blue)
![License](https://img.shields.io/badge/license-MIT-green)
![Platform](https://img.shields.io/badge/platform-Raspberry%20Pi%204%2F5-red)

## Repository-Struktur

```
speech-timer-pi/
├── pi-app/               Flask-Anwendung für den Raspberry Pi
├── companion-module/     Bitfocus-Companion-Modul (Node.js)
├── .github/              CI-Workflow & Issue-Templates
└── docs/                 Handbuch (PDF)
```

## Quick Start – Raspberry Pi

Voraussetzungen: Raspberry Pi 4 oder 5 mit Raspberry Pi OS (Bookworm, 64-bit, mit Desktop).

```bash
# Repository klonen
git clone https://github.com/Svenigator/speech-timer-pi.git
cd speech-timer-pi

# Pi-App-Inhalte an die richtige Stelle kopieren
mkdir -p ~/speech-timer-pi
cp -r pi-app/. ~/speech-timer-pi/

# Installieren
cd ~/speech-timer-pi
bash scripts/install.sh

# Neustart
sudo reboot
```

Nach dem Neustart startet der Browser automatisch im Kiosk-Modus mit dem Timer-Display. Die Web-Steuerung ist unter `http://<Pi-IP>/control` von jedem Gerät im Netzwerk erreichbar.

## Funktionen

### Display
- Vollbild-Timer-Anzeige mit großen, gut lesbaren Ziffern
- Konfigurierbare Warnzonen (z.B. gelb bei 3 Min, rot bei 30 Sek)
- Overtime-Modus mit negativen Zeiten und Blinken
- Umschaltbar zwischen Timer und Echtzeit-Uhr
- Farben und Helligkeit in den Einstellungen anpassbar

### Steuerung
- Web-Oberfläche von jedem Gerät im Netzwerk erreichbar
- Presets für verschiedene Vortragsarten
- Manuelle Zeiteingabe (Minuten : Sekunden)
- **Separate Load/Start-Funktion**: Zeit laden, dann präzise starten
- **Live-Anpassung**: +/-1 und +/-5 Minuten auch während laufendem Timer
- Pause, Stop und Reset

### Integration
- **OSC**: Steuerung und Status-Updates über Open Sound Control
- **Bitfocus Companion**: Ready-to-use-Modul im Ordner `companion-module/`
- Automatische Erkennung von Chromium (funktioniert auf Bullseye und Bookworm)

### System
- Systemd-Service für Autostart
- Zeit- und Zeitzonen-Einstellung direkt im Browser (NTP-aware)
- WLAN-Scanner und -Verbindung über die Weboberfläche

## Companion-Modul

Das Verzeichnis `companion-module/` enthält das vollständige Bitfocus-Companion-Modul. Details siehe [companion-module/HELP.md](companion-module/HELP.md).

Schnellinstallation unter Windows:
```cmd
cd companion-module
install.bat
```

Dann in Companion: neue Instanz vom Typ **Speech Timer Pi** anlegen, IP und Port eintragen — fertig.

## Hardware-Empfehlung

- Raspberry Pi 5 (mit 5V/5A USB-C-Netzteil) oder Pi 4
- HDMI-Ausgabe auf Monitor oder LED-Wand
- Raspberry Pi OS Bookworm 64-bit (Desktop-Variante)
- Ethernet oder WLAN-Verbindung

**Pi 5 speziell**: Braucht ein **5V/5A** Netzteil (das offizielle von Raspberry Pi) und **Mini-HDMI** (nicht Micro-HDMI wie beim Pi 4). HDMI0 ist der Port näher am USB-C-Anschluss.

## Changelog

Siehe [CHANGELOG.md](CHANGELOG.md).

## Lizenz

MIT — siehe [LICENSE](LICENSE).
