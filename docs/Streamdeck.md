# Stream Deck Direkt-Anschluss am Pi

Der Speech Timer kann ein **Elgato Stream Deck direkt am Pi per USB** ansteuern — ohne Companion oder weitere Software dazwischen. Das ist für Vor-Ort-Setups praktisch, wo nur ein Bediener und ein Stream Deck am Timer-Pi nötig sind.

Companion bleibt parallel weiter nutzbar — beide Wege können gleichzeitig laufen.

## Auto-Detection des Modells

Der Controller erkennt das angeschlossene Stream Deck **automatisch** und lädt ein zur Tastenanzahl passendes Default-Layout. Unterstützt sind:

| Modell                 | Tasten | Layout-Modus               |
|------------------------|--------|----------------------------|
| Stream Deck Mini       | 6      | Minimal (Timer + Start/Pause + 2 Presets) |
| Stream Deck Neo        | 8      | Reduziert (Timer + Steuerung + 2 Presets) |
| Stream Deck MK.2/Std.  | 15     | Standard (Timer + 4 Presets + Adjust + Mode) |
| Stream Deck XL         | 32     | Voll (Timer + 16 Presets + Adjust + Info) |

Hot-Plug funktioniert: Stream Deck im Betrieb anschließen oder austauschen — der Service erkennt das neue Modell beim nächsten Reconnect-Zyklus (alle 5 Sekunden).

## ⚠️ Strom-Hinweis (besonders wichtig bei Pi 3B+)

Stream Decks ziehen je nach Modell unterschiedlich viel Strom. Bei einem schwachen Pi-Netzteil kann ein direkt angeschlossenes Stream Deck zu Throttling oder Neustarts führen.

| Modell      | Stromhunger | Direkt am Pi 3B+ ok? |
|-------------|-------------|----------------------|
| Mini (6)    | ~1.5 W      | ✅ Meist ja           |
| MK.2 (15)   | ~2.5 W      | ✅ Wenn gutes Netzteil|
| Neo (8)     | ~2 W        | ✅ Meist ja           |
| XL (32)     | ~5 W        | ⚠️ Aktiver USB-Hub empfohlen |

Throttling-Status prüfen:
```bash
vcgencmd get_throttled
```
Erwartet: `throttled=0x0`. Bei `0x8` oder `0x80008` ist die Stromversorgung zu schwach.

## Installation

Wird vom Haupt-Installer (`scripts/install.sh`) automatisch mit erledigt:

- libhidapi & libusb installiert (für USB-HID-Kommunikation)
- udev-Regel angelegt (User `pi` darf Stream Deck ohne sudo ansprechen)
- Service `speech-timer-streamdeck.service` installiert
- **Auto-Aktivierung nur wenn beim Installieren bereits ein Stream Deck angesteckt ist**

Falls du Stream Deck später nachrüstest:

```bash
sudo systemctl enable --now speech-timer-streamdeck
```

Service-Status prüfen:
```bash
sudo systemctl status speech-timer-streamdeck
```

Live-Logs:
```bash
sudo journalctl -u speech-timer-streamdeck -f
```

## Konfiguration

Beim ersten Start mit angestecktem Stream Deck wird `/home/pi/speech-timer-pi/streamdeck.json` automatisch mit dem Default-Layout angelegt. Du kannst die Datei beliebig anpassen:

```json
{
  "_comment": "...",
  "layouts": {
    "32": {
      "0": { "type": "timer_display" },
      "1": { "type": "timer_display" },
      "4": { "type": "action", "action": "start", "label": "GO!", "color": [0, 200, 0] },
      "5": { "type": "preset_slot", "preset_id": 1 }
    }
  }
}
```

Layouts sind nach **Tastenanzahl** indiziert (Top-Level-Schlüssel `"32"`, `"15"`, `"6"`, etc.). Das hat den Vorteil: Wenn du das Modell wechselst, nimmt der Controller automatisch das richtige Layout. Beide Layouts können gleichzeitig in der gleichen JSON-Datei stehen.

Nach Änderungen den Service neu starten:
```bash
sudo systemctl restart speech-timer-streamdeck
```

### Tasten-Typen

| Type                  | Bedeutung |
|-----------------------|-----------|
| `timer_display`       | Live-Restzeit mit Phasen-Farbe (RUNNING/WARN/OVER!/PAUSED) |
| `preset_name_display` | Name des aktuell geladenen Presets |
| `preset_slot`         | Lädt Preset mit `preset_id` (Klick = laden, kein Auto-Start) |
| `action`              | Triggert eine Aktion (siehe Tabelle unten) |
| `info_hostname`       | Zeigt den Hostname des Pi |
| `info_ip_eth0`        | Zeigt LAN-IP |
| `info_ip_wlan0`       | Zeigt WLAN-IP |
| `blank`               | Leere Taste (Default für nicht definierte Positionen) |

### Actions (für Type `action`)

| action          | Wirkung                                |
|-----------------|----------------------------------------|
| `start`         | Timer starten / fortsetzen             |
| `pause`         | Pause / Fortsetzen (Toggle)            |
| `stop`          | Timer stoppen, auf 00:00               |
| `reset`         | Timer zurücksetzen, Preset entladen    |
| `adjust_+60`    | +1 Minute hinzufügen                   |
| `adjust_-60`    | −1 Minute abziehen                     |
| `adjust_+300`   | +5 Minuten hinzufügen                  |
| `adjust_-300`   | −5 Minuten abziehen                    |
| `mode_toggle`   | Display zwischen Timer und Uhr toggeln |

### Eigene Preset-Slots

Stream Deck XL hat im Default-Layout 16 Preset-Slots. Wenn du nur 4 Presets brauchst, kannst du die anderen 12 Tasten frei umfunktionieren — z.B. zu großen Action-Tasten:

```json
"16": { "type": "action", "action": "start", "label": "GO\nVortrag 1", "color": [0, 150, 0] },
"17": { "type": "action", "action": "start", "label": "GO\nVortrag 2", "color": [0, 150, 0] }
```

## Fehlersuche

**Stream Deck zeigt nichts an / Service startet nicht**

```bash
# Wird das Stream Deck per USB erkannt?
lsusb | grep -i elgato

# udev-Regel aktiv?
ls -la /etc/udev/rules.d/70-streamdeck.rules

# Service-Status
sudo systemctl status speech-timer-streamdeck
sudo journalctl -u speech-timer-streamdeck -n 50
```

**„Permission denied" beim Zugriff aufs Stream Deck**

```bash
# udev-Regeln neu einlesen
sudo udevadm control --reload-rules
sudo udevadm trigger

# Stream Deck einmal aus- und einstecken
```

**Pi startet neu / wird langsam wenn Stream Deck angesteckt**

Stromproblem (siehe oben). Lösung:
- Aktiver USB-Hub mit eigener Stromversorgung dazwischen
- Oder ein besseres Pi-Netzteil (5V/2.5A bei Pi 3B+, 5V/5A bei Pi 5)
