# Speech Timer Pi – Pi-App

Die Flask-Anwendung, die auf dem Raspberry Pi läuft.

## Installation

Komplett-Installation auf frischem Raspberry Pi OS:

```bash
cd pi-app
bash scripts/install.sh
```

Das Script erledigt:
- System-Pakete installieren (Python, Chromium, unclutter, WLAN-Tools)
- Python Virtual Environment + Dependencies
- systemd-Service für Autostart anlegen
- Sudoers-Regeln für Zeit/Netzwerk-Befehle
- Chromium-Kiosk-Autostart konfigurieren

## Manueller Start (zum Entwickeln)

```bash
cd pi-app
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
python3 app.py
```

Dann im Browser: `http://localhost:5000`

## Routen-Übersicht

### Web-Seiten
- `GET  /` – Vollbild-Display
- `GET  /control` – Steuerungsseite
- `GET  /settings` – Einstellungsmenü

### Timer-API
- `POST /api/timer/load` – Preset laden (startet nicht)
- `POST /api/timer/start` – Starten oder fortsetzen
- `POST /api/timer/pause` – Pause/Resume (toggle)
- `POST /api/timer/stop` – Stopp auf 00:00
- `POST /api/timer/reset` – Komplett zurücksetzen
- `POST /api/timer/adjust` – Zeit ±Sekunden anpassen
- `GET  /api/timer/status` – Aktueller Status als JSON

### Display-Mode-API
- `POST /api/display/mode` – Modus setzen (timer/clock)
- `POST /api/display/mode/toggle` – Zwischen Modi umschalten

### Presets-API
- `GET  /api/presets` – Alle Presets
- `POST /api/presets` – Presets speichern
- `DELETE /api/presets/<id>` – Einzelnes Preset löschen

### System-API
- `GET  /api/system/time`, `POST /api/system/time`
- `POST /api/system/ntp`
- `POST /api/system/timezone`

### Netzwerk-API
- `GET  /api/network/scan`
- `GET  /api/network/status`
- `POST /api/network/connect`

## OSC-Adressen

Siehe [Hauptdokumentation](../docs/Speech-Timer-Handbuch.pdf), Kapitel 7.

## Konfiguration

Alle Einstellungen werden in `config.json` gespeichert (wird beim ersten Start automatisch angelegt). Die Datei ist absichtlich nicht im Repository — siehe `.gitignore`.
