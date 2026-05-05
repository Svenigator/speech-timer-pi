# Features — Speech Timer Pi

Feature-Backlog für das Speech Timer Pi Projekt.

---

## Implementiert (v3.x)

### Display
- [x] **F-001: Vollbild-Timer-Anzeige** — Große, gut lesbare Ziffern im Kiosk-Modus
- [x] **F-002: Warnzonen** — Zwei konfigurierbare Warnstufen (z.B. gelb bei 3 Min, rot bei 30 Sek)
- [x] **F-003: Overtime-Modus** — Negative Zeiten mit konfigurierbarem Blinken
- [x] **F-004: Blink-Effekte** — Separat konfigurierbar für Warnung und Overtime
- [x] **F-005: Display-Mode-Toggle** — Umschaltung zwischen Timer und Echtzeit-Uhr
- [x] **F-006: Anpassbare Farben** — Hintergrund, Text, Warning1, Warning2, Overtime frei wählbar
- [x] **F-007: Helligkeit** — Steuerung über Web-UI (RPi-Backlight + HDMI via xrandr)
- [x] **F-008: Schriftgröße** — Konfigurierbar in den Einstellungen

### Timer-Steuerung
- [x] **F-010: Load/Start getrennt** — Preset laden und separat starten (kein Auto-Start)
- [x] **F-011: State-Machine** — Klare Zustände: idle / loaded / running / paused / stopped
- [x] **F-012: Pause/Resume** — Toggle-Funktion, Elapsed-Zeit wird korrekt fortgeführt
- [x] **F-013: Stop** — Timer stoppt bei 00:00, Preset bleibt geladen
- [x] **F-014: Reset** — Vollständiger Reset, Preset wird entladen
- [x] **F-015: Live-Zeitanpassung** — +/-1 Min und +/-5 Min auch während laufendem Timer
- [x] **F-016: Manuelle Zeiteingabe** — Beliebige Minuten:Sekunden eingeben und laden

### Presets
- [x] **F-020: Preset-Verwaltung** — Erstellen, Bearbeiten, Löschen über Web-UI
- [x] **F-021: Preset-Felder** — Name, Dauer, Warning1, Warning2 pro Preset
- [x] **F-022: Feste Preset-IDs** — IDs bleiben stabil, auch wenn Presets umbenannt werden
- [x] **F-023: Standard-Presets** — Kurzvortrag, Standard Vortrag, Langer Vortrag, Diskussion

### Web-Oberfläche
- [x] **F-030: Control-Seite** — Steuerung von jedem Gerät im Netzwerk (`/control`)
- [x] **F-031: Settings-Seite** — Einstellungen für Display, Presets, OSC, System (`/settings`)
- [x] **F-032: Display-Seite** — Vollbild-Anzeige für den Pi (`/`)
- [x] **F-033: Echtzeit-Updates** — Socket.IO pusht Timer-Updates alle 100 ms
- [x] **F-034: Lokal gehostetes Socket.IO** — Funktioniert ohne Internetzugang

### OSC-Integration
- [x] **F-040: OSC-Empfang** — Timer-Steuerung über Open Sound Control (Port konfigurierbar)
- [x] **F-041: OSC-Senden** — Status-Updates an konfigurierte Ziele (alle 500 ms)
- [x] **F-042: Display-Mode per OSC** — `/display/mode` und `/display/mode/toggle`
- [x] **F-043: OSC-Test** — Test-Nachricht über Web-UI senden
- [x] **F-044: Mehrere OSC-Ziele** — Beliebig viele IP:Port-Kombinationen konfigurierbar

### Bitfocus Companion Modul
- [x] **F-050: Companion-Modul** — Ready-to-use Integration für Bitfocus Companion
- [x] **F-051: Actions** — Load Preset, Load by ID, Load Manual, Start, Pause, Stop, Reset, Adjust Time, Display Mode
- [x] **F-052: Feedbacks** — Timer-Phase als Farbe, Boolean-Feedbacks für jeden Zustand
- [x] **F-053: Variablen** — Restzeit, Phase, Preset-Name, Netzwerk-Infos (Hostname, IP, SSID)
- [x] **F-054: Preset-Variablen** — `preset_name_<ID>`, `preset_time_<ID>`, `preset_duration_<ID>` dynamisch
- [x] **F-055: Auto-Refresh** — Preset-Liste aktualisiert sich alle 10 s bei Änderungen auf dem Pi
- [x] **F-056: Button-Presets** — Fertige Buttons: Display, Control, Adjust, Display Mode, Pi Info, Preset Slots

### Stream Deck Direkt (ohne Companion)
- [x] **F-060: Direkter SD-Anschluss** — Stream Deck direkt per USB am Pi, kein Companion nötig
- [x] **F-061: Auto-Detection Modell** — Mini (6), Neo (8), MK.2 (15), XL (32) automatisch erkannt
- [x] **F-062: Hot-Plug** — USB-Anschluss/-Wechsel im Betrieb ohne Service-Restart
- [x] **F-063: Live-Anzeige** — Restzeit mit Phasen-Farbe (grün/gelb/rot/blink) auf Tasten
- [x] **F-064: Layouts** — Standard-Layouts pro Tastenanzahl, überschreibbar via `streamdeck.json`
- [x] **F-065: Systemd-Service** — `speech-timer-streamdeck.service` für Autostart

### System & Setup
- [x] **F-070: Autostart** — Systemd-Service und Kiosk-Modus starten automatisch
- [x] **F-071: Kiosk-Modus** — Chromium startet fullscreen auf dem Pi-Display
- [x] **F-072: Install-Skript** — Ein-Befehl-Installation via `install.sh`
- [x] **F-073: Chromium-Auto-Detection** — Erkennt verfügbares Chromium-Paket (Bookworm/Bullseye/Trixie)
- [x] **F-074: Zeitzone** — Einstellen direkt im Browser via timedatectl
- [x] **F-075: Uhrzeit** — Manuell setzen im Browser (NTP wird automatisch deaktiviert)
- [x] **F-076: NTP-Toggle** — NTP ein/ausschalten über Web-UI
- [x] **F-077: WLAN-Scanner** — Verfügbare Netzwerke anzeigen, Verbindung herstellen
- [x] **F-078: Netzwerk-Adapter-Übersicht** — Alle Interfaces mit IPv4/IPv6 und UP/DOWN-Status

### Netzwerk-Konfiguration
- [x] **F-080: LAN-IP-Konfiguration** — Ethernet-Interface (eth0) im Einstellungsmenü auf feste IP oder DHCP umstellen. Felder: IP-Adresse, Subnetzmaske, Gateway, DNS. Unterstützt NetworkManager (Bookworm+) und dhcpcd (Bullseye).
- [x] **F-081: Fallback-Access-Point** — Wenn beim Boot kein bekanntes WLAN in Reichweite ist, öffnet der Pi automatisch einen eigenen WLAN-AP (SSID + Passwort konfigurierbar). Darüber ist das Einstellungsmenü erreichbar. AP läuft dauerhaft bis er manuell gestoppt wird.

---

## Offen

*Keine offenen Features.*

---

## In Arbeit

*Keine Features in Arbeit.*
