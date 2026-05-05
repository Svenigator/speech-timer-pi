# Design: F-080 LAN-IP-Konfiguration + F-081 Fallback-Access-Point

**Datum:** 2026-05-05  
**Features:** F-080, F-081  
**Status:** Approved

---

## Überblick

Zwei neue Netzwerk-Features für den Speech Timer Pi, beide integriert in die bestehende Settings-Seite:

- **F-080:** eth0 im Browser auf DHCP oder statische IP umstellen (NetworkManager + dhcpcd)
- **F-081:** Fallback-WLAN-Hotspot — Pi öffnet automatisch einen AP wenn kein bekanntes WLAN erreichbar ist

---

## Architektur

Beide Features erweitern `app.py` um neue API-Endpunkte und `settings.html`/`settings.js` um neue UI-Abschnitte. Kein neues Python-Modul nötig.

### Neue API-Endpunkte

```
GET  /api/network/eth0          Aktuelle eth0-Konfiguration lesen
POST /api/network/eth0          DHCP oder statische IP setzen

GET  /api/network/ap            AP-Status + gespeicherte Konfiguration
POST /api/network/ap/config     SSID / Passwort speichern
POST /api/network/ap/start      AP manuell starten
POST /api/network/ap/stop       AP manuell stoppen
```

### Config-Erweiterung (`config.json`)

```json
"ap": {
  "ssid": "SpeechTimer",
  "password": "speechtimer",
  "auto_start": true
}
```

`DEFAULT_CONFIG` in `app.py` erhält diesen Block als Default.

---

## F-080: LAN-IP-Konfiguration (eth0)

### Backend

**Detection:** Beim Aufruf der Endpunkte wird geprüft welcher Netzwerk-Stack aktiv ist:

```python
def _detect_network_manager() -> bool:
    result = subprocess.run(
        ["systemctl", "is-active", "NetworkManager"],
        capture_output=True, text=True, timeout=5
    )
    return result.stdout.strip() == "active"
```

**`GET /api/network/eth0`** liest die aktuelle Konfiguration:

- NetworkManager-Pfad: `nmcli -t -f NAME,DEVICE connection show --active` → Connection für eth0 finden, dann `nmcli connection show <name>` für `ipv4.method`, `IP4.ADDRESS`, `IP4.GATEWAY`, `IP4.DNS`
- dhcpcd-Pfad: `/etc/dhcpcd.conf` parsen — Static-Block für eth0 zwischen Marker-Kommentaren suchen

Rückgabe:
```json
{
  "mode": "dhcp",           // oder "static"
  "ip": "192.168.1.100",
  "prefix": 24,
  "gateway": "192.168.1.1",
  "dns": "8.8.8.8",
  "backend": "networkmanager"  // oder "dhcpcd"
}
```

**`POST /api/network/eth0`** wendet die Konfiguration an:

Payload:
```json
{
  "mode": "static",
  "ip": "192.168.1.100",
  "prefix": 24,
  "gateway": "192.168.1.1",
  "dns": "8.8.8.8"
}
```

*NetworkManager-Pfad (Bookworm+):*
1. Aktive Connection für eth0 finden
2. Bei DHCP:
   ```
   nmcli connection modify <conn> ipv4.method auto \
     ipv4.addresses "" ipv4.gateway "" ipv4.dns ""
   nmcli connection up <conn>
   ```
3. Bei statisch:
   ```
   nmcli connection modify <conn> ipv4.method manual \
     ipv4.addresses <ip>/<prefix> ipv4.gateway <gw> ipv4.dns <dns>
   nmcli connection up <conn>
   ```

*dhcpcd-Pfad (Bullseye):*
- Static-Block in `/etc/dhcpcd.conf` zwischen Marker-Kommentaren schreiben/ersetzen:
  ```
  # speech-timer-start
  interface eth0
  static ip_address=192.168.1.100/24
  static routers=192.168.1.1
  static domain_name_servers=8.8.8.8
  # speech-timer-end
  ```
- Bei DHCP: Block zwischen den Markern entfernen
- `sudo systemctl restart dhcpcd`

Fehler (kein eth0, kein NetworkManager/dhcpcd) werden als HTTP 400/500 mit Fehlermeldung zurückgegeben.

### UI (settings.html / settings.js)

Neuer Abschnitt **"LAN (eth0)"** in den Settings:

- Radio-Buttons: `DHCP (automatisch)` / `Statische IP`
- Felder (nur sichtbar wenn Statisch gewählt):
  - IP-Adresse (Text-Input, Validierung: valide IPv4)
  - Subnetzmaske (Dropdown: /8 bis /30, Default /24)
  - Gateway (Text-Input)
  - DNS (Text-Input, Default 8.8.8.8)
- Button: `Speichern`
- Beim Laden der Seite: aktuelle Konfiguration per `GET /api/network/eth0` laden und Felder vorbelegen
- Erfolg/Fehler als Toast-Notification (bestehendes Muster aus settings.js)
- Hinweis: "Änderungen trennen kurz die LAN-Verbindung"

---

## F-081: Fallback-Access-Point

### Backend

**AP starten/stoppen** via nmcli:

```python
# Starten
subprocess.run([
    "sudo", "nmcli", "device", "wifi", "hotspot",
    "ifname", "wlan0",
    "ssid", ssid,
    "password", password
], ...)

# Stoppen
subprocess.run(["sudo", "nmcli", "connection", "down", "Hotspot"], ...)
subprocess.run(["sudo", "nmcli", "connection", "delete", "Hotspot"], ...)
```

**Status-Tracking:** App-globale Variable `_ap_running: bool` — wird gesetzt/gelöscht wenn start/stop aufgerufen wird. Zusätzlich beim Start der App aus dem echten nmcli-Status initialisiert.

**`GET /api/network/ap`** gibt zurück:
```json
{
  "running": false,
  "ssid": "SpeechTimer",
  "auto_start": true,
  "ip": "10.42.0.1",        // AP-IP wenn running
  "nm_available": true       // false → Hinweis im UI
}
```

**`POST /api/network/ap/config`** speichert SSID/Passwort/auto_start in `config.json`.

**`POST /api/network/ap/start`** und **`/stop`** starten/stoppen den AP und setzen `_ap_running`.

### Auto-Start-Thread

Startet als Background-Task in `socketio.start_background_task()`, 15s nach App-Start:

```
1. Warte 15s
2. Falls _ap_running → exit (AP läuft schon)
3. Falls iwgetid -r eine SSID zurückgibt → wlan0 verbunden → exit
4. Falls config.ap.auto_start = true → AP starten, _ap_running = true
5. Danach alle 30s:
   a. Falls _ap_running:
      - iwgetid -r prüfen
      - Falls SSID vorhanden → AP stoppen, _ap_running = false
      b. (kein Auto-Neustart — einmal gestoppt bleibt gestoppt bis manuell)
```

Der Thread unterscheidet "AP läuft" von "kein Netzwerk" über `_ap_running`, nicht über `iwgetid` (da iwgetid im AP-Modus leer ist).

### UI (settings.html / settings.js)

Neuer Abschnitt **"Fallback WLAN-Hotspot"** in den Settings:

- SSID-Feld (Text-Input, Default: `SpeechTimer`)
- Passwort-Feld (Text-Input, Default: `speechtimer`, min. 8 Zeichen)
- Checkbox: `Automatisch starten wenn kein WLAN erreichbar`
- Status-Badge: `Hotspot aktiv` (grün) / `Inaktiv` (grau)
- AP-IP anzeigen wenn aktiv (z.B. `10.42.0.1`)
- Button: `Hotspot starten` / `Hotspot stoppen` (je nach Status)
- Hinweistext wenn `nm_available: false`: "NetworkManager nicht gefunden — Hotspot nicht verfügbar"

---

## Dateien die geändert werden

| Datei | Änderung |
|-------|----------|
| `pi-app/app.py` | 6 neue API-Endpunkte, Helper-Funktionen, Auto-Start-Thread, DEFAULT_CONFIG-Erweiterung |
| `pi-app/templates/settings.html` | 2 neue Abschnitte (LAN-IP, Hotspot) |
| `pi-app/static/js/settings.js` | UI-Logik für beide Abschnitte |
| `pi-app/static/css/settings.css` | Minimale Style-Ergänzungen falls nötig |
| `docs/features.md` | F-080 und F-081 als implementiert markieren |

---

## Fehlerbehandlung

- eth0 nicht vorhanden → API gibt 400 zurück, UI zeigt Hinweis
- NetworkManager UND dhcpcd nicht verfügbar → 400 + Hinweis
- nmcli-Befehl schlägt fehl → stderr in Fehlermeldung zurückgeben
- AP-Start schlägt fehl (z.B. wlan0 nicht vorhanden) → _ap_running bleibt false, Fehlermeldung im UI
- Auto-Start-Thread: alle Fehler werden geloggt, Thread läuft weiter

---

## Nicht im Scope

- WLAN-IP-Konfiguration (nur eth0)
- IPv6-Konfiguration
- Mehrere DNS-Server über UI
- Automatischer AP-Neustart nach Verbindungsverlust (einmal gestoppt = gestoppt)
- hostapd/dnsmasq-Unterstützung für Bullseye beim AP (nur nmcli)
