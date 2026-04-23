# Changelog

Alle erwähnenswerten Änderungen an diesem Projekt.

## [3.0.2] – 2026

### Neu
- **Alle Netzwerk-Adapter in den Einstellungen**: Die Netzwerk-Seite zeigt jetzt alle aktiven Interfaces (Ethernet, WLAN, USB, ...) mit IPv4- und IPv6-Adressen und ihrem UP/DOWN-Status. Vorher war nur die erste IP sichtbar.

### Fixes
- **Chromium-Erkennung unter Trixie (Debian 13) repariert**: Der Installer nutzt jetzt `apt-cache policy` statt `apt-cache show`, um echte Installations-Kandidaten zu finden. Unter Trixie ist nur `chromium` (Debian-Standard) verfügbar, nicht `chromium-browser` (RPi-Foundation-Fork) – das wird jetzt korrekt erkannt.
- Installer prüft zusätzlich via `command -v`, ob Chromium bereits installiert ist, bevor es apt bemüht.
- Klarerer Fehlertext, wenn kein Chromium gefunden wird, mit Hinweis auf manuelle Diagnose

## [3.0.1] – 2026

### Fixes
- Repository-Struktur repariert: Pi-App liegt jetzt in `pi-app/`, Companion-Modul in `companion-module/`, CI-Workflow unter `.github/workflows/`
- Duplikate und fehlerhafte Datei-Inhalte aus dem Repo entfernt
- Companion-Modul auf Version 1.1.0 angehoben (Display-Mode-Actions & -Feedbacks)
- Socket.IO-Client wird lokal gehostet statt per CDN (funktioniert ohne Internet)
- Fallback-Route `/socket.io/socket.io.js` für alte Browser-Cache-Zustände
- `kiosk.sh`: Chromium-Binary wird automatisch erkannt (Bookworm vs. Bullseye)
- `install.sh`: Prüft verfügbares Chromium-Paket und installiert das richtige

## [3.0.0] – 2026

### Neu
- **Getrenntes Laden und Starten**: Presets werden geladen, starten aber nicht automatisch. Der Timer startet erst, wenn die Start-Taste gedrückt wird.
- **Live-Zeit-Anpassung**: +/-1 Min und +/-5 Min auch während der Timer läuft
- **Display-Mode-Toggle**: Umschaltung zwischen Timer und Echtzeit-Uhr auf dem Display
- **OSC-Integration**: Timer kann über Open Sound Control gesteuert werden und sendet Status-Updates
- **Companion-Modul**: Ready-to-use-Integration für Bitfocus Companion (Stream Deck)

### Entfernt
- Redner-Feld (nicht mehr benötigt, da Presets jetzt ohne Redner-Zuordnung arbeiten)

### Fixes
- NTP wird beim manuellen Zeit-Setzen automatisch deaktiviert (sonst überschrieb NTP die gesetzte Zeit sofort wieder)
- Timer-State-Machine klarer strukturiert (idle / loaded / running / paused / stopped)

## [2.x]

Vorgänger-Version mit Auto-Start bei Preset-Auswahl.

## [1.x]

Erste Version mit grundlegenden Timer-Funktionen.
