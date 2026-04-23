# Changelog

Alle erwähnenswerten Änderungen an diesem Projekt.

## [3.0.3] – 2026

### Neu
- **Companion-Modul v1.2.0** mit mehreren Verbesserungen:
  - Neue Variablen `hostname`, `ip_primary`, `ip_eth0`, `ip_wlan0`, `ssid` zeigen Netzwerk-Infos vom Pi
  - Neue Info-Button-Presets in Kategorie **„Pi Info"**: Hostname, IP eth0, IP wlan0, Primary IP (reine Anzeige)
  - Neue Action **„Load Preset by ID"** — lädt ein Preset anhand seiner festen ID (statt Dropdown), ideal für stabile Stream-Deck-Buttons
  - Neue Button-Kategorie **„Preset Slots"** mit fertigen Buttons für IDs 1–6, die den Preset-Namen automatisch via Variable vom Pi ziehen
  - Preset-Namen werden als Variablen `preset_name_<ID>`, `preset_time_<ID>`, `preset_duration_<ID>` bereitgestellt
- Pi-API: `/api/network/status` liefert jetzt zusätzlich den `hostname` des Pi

### Fixes
- **Companion: Selbst angelegte Presets waren nach Umbenennung auf dem Pi noch mit altem Namen sichtbar** — das Modul erkennt jetzt neben Anzahl auch Name- und Dauer-Änderungen und aktualisiert seine Definitionen automatisch
- Refresh-Intervall von 30 s auf 10 s reduziert, damit Preset-Änderungen schneller in Companion sichtbar werden

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
