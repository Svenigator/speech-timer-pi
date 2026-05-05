# F-080 LAN-IP-Konfiguration + F-081 Fallback-Access-Point — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** eth0 im Browser auf DHCP oder statische IP umstellen (F-080) und einen Fallback-WLAN-Hotspot einrichten der bei fehlendem WLAN automatisch startet (F-081).

**Architecture:** Neue API-Endpunkte in `app.py`, UI-Erweiterung im Netzwerk-Tab von `settings.html`/`settings.js`. F-080 nutzt nmcli (Bookworm+) mit dhcpcd-Fallback (Bullseye). F-081 nutzt `nmcli device wifi hotspot`. Ein Background-Thread startet den AP 15s nach App-Start wenn kein WLAN verbunden ist, und überwacht danach periodisch den AP-Status.

**Tech Stack:** Python 3 / Flask / SocketIO (bestehendes Stack), nmcli / dhcpcd (System), Vanilla JS (bestehendes Muster)

---

## Dateien

| Datei | Änderung |
|-------|----------|
| `pi-app/app.py` | `import re` hinzufügen; DEFAULT_CONFIG um `"ap"` erweitern; 6 neue Endpunkte; Helper-Funktionen; AP-Monitor-Thread; main-Block erweitern |
| `pi-app/templates/settings.html` | Zwei neue Cards in `#tab-network` |
| `pi-app/static/js/settings.js` | loadEth0Config, saveEth0Config, loadApConfig, AP-Controls, Tab-Handler erweitern |
| `pi-app/static/css/settings.css` | Badge-Stile für AP-Status |
| `docs/features.md` | F-080 und F-081 als implementiert markieren |

---

## Task 1: Backend — DEFAULT_CONFIG + Helper-Funktionen

**Files:**
- Modify: `pi-app/app.py`

- [ ] **Schritt 1: `import re` und `import logging` hinzufügen**

In `pi-app/app.py`, die Import-Zeilen (Zeilen 12–18) erweitern:

```python
import json
import logging
import os
import re
import subprocess
import threading
import time
from datetime import datetime
from pathlib import Path

log = logging.getLogger(__name__)
```

- [ ] **Schritt 2: DEFAULT_CONFIG um AP-Block erweitern**

In `pi-app/app.py`, den `DEFAULT_CONFIG`-Block (endet bei Zeile 55) um den `"ap"`-Key erweitern. Nach dem `"osc"` Block, vor der schließenden `}`:

```python
    "osc": {
        "enabled": False,
        "receive_port": 8000,
        "targets": [],
    },
    "ap": {
        "ssid": "SpeechTimer",
        "password": "speechtimer",
        "auto_start": True,
    },
}
```

- [ ] **Schritt 3: Helper-Funktionen ans Ende der Helpers-Sektion schreiben**

Nach der Funktion `parse_iwlist` (ca. Zeile 883), vor dem `@socketio.on('connect')`-Handler, folgende Funktionen einfügen:

```python
def _detect_network_manager():
    """True wenn NetworkManager aktiv ist (Bookworm+)."""
    try:
        result = subprocess.run(
            ["systemctl", "is-active", "NetworkManager"],
            capture_output=True, text=True, timeout=5
        )
        return result.stdout.strip() == "active"
    except Exception:
        return False


def _get_eth0_conn_name():
    """Gibt den nmcli-Connection-Namen für eth0 zurück oder None."""
    result = subprocess.run(
        ["nmcli", "-t", "-f", "NAME,DEVICE", "connection", "show", "--active"],
        capture_output=True, text=True, timeout=5
    )
    for line in result.stdout.strip().splitlines():
        parts = line.split(":")
        if len(parts) >= 2 and parts[1] == "eth0":
            return parts[0]
    return None


def _read_eth0_nmcli():
    """Liest eth0-Konfiguration via nmcli."""
    conn = _get_eth0_conn_name()
    base = {"mode": "dhcp", "ip": "", "prefix": 24, "gateway": "", "dns": "",
            "backend": "networkmanager"}
    if not conn:
        base["error"] = "Keine aktive eth0-Connection gefunden"
        return base
    result = subprocess.run(
        ["nmcli", "-t", "connection", "show", conn],
        capture_output=True, text=True, timeout=5
    )
    for line in result.stdout.splitlines():
        if ":" not in line:
            continue
        key, _, val = line.partition(":")
        key = key.strip()
        val = val.strip()
        if key == "ipv4.method":
            base["mode"] = "dhcp" if val == "auto" else "static"
        elif key == "IP4.ADDRESS[1]" and "/" in val:
            ip, prefix = val.rsplit("/", 1)
            base["ip"] = ip.strip()
            try:
                base["prefix"] = int(prefix.strip())
            except ValueError:
                pass
        elif key == "IP4.GATEWAY":
            base["gateway"] = val
        elif key == "IP4.DNS[1]":
            base["dns"] = val
    return base


def _read_eth0_dhcpcd():
    """Liest eth0-Konfiguration aus /etc/dhcpcd.conf."""
    cfg = {"mode": "dhcp", "ip": "", "prefix": 24, "gateway": "", "dns": "",
           "backend": "dhcpcd"}
    try:
        content = Path("/etc/dhcpcd.conf").read_text(encoding="utf-8")
    except FileNotFoundError:
        return cfg
    match = re.search(
        r"# speech-timer-start\n(.*?)# speech-timer-end",
        content, re.DOTALL
    )
    if not match:
        return cfg
    for line in match.group(1).splitlines():
        line = line.strip()
        if line.startswith("static ip_address="):
            addr = line.split("=", 1)[1].strip()
            if "/" in addr:
                ip, prefix = addr.rsplit("/", 1)
                cfg["ip"] = ip
                try:
                    cfg["prefix"] = int(prefix)
                except ValueError:
                    pass
            cfg["mode"] = "static"
        elif line.startswith("static routers="):
            cfg["gateway"] = line.split("=", 1)[1].strip()
        elif line.startswith("static domain_name_servers="):
            cfg["dns"] = line.split("=", 1)[1].strip()
    return cfg


def _apply_eth0_nmcli(conn, mode, ip="", prefix=24, gateway="", dns=""):
    """Wendet eth0-Konfiguration via nmcli an. Gibt (ok, stderr) zurück."""
    if mode == "dhcp":
        cmd = ["sudo", "nmcli", "connection", "modify", conn,
               "ipv4.method", "auto",
               "ipv4.addresses", "",
               "ipv4.gateway", "",
               "ipv4.dns", ""]
    else:
        cmd = ["sudo", "nmcli", "connection", "modify", conn,
               "ipv4.method", "manual",
               "ipv4.addresses", f"{ip}/{prefix}",
               "ipv4.gateway", gateway,
               "ipv4.dns", dns or "8.8.8.8"]
    r = subprocess.run(cmd, capture_output=True, text=True, timeout=10)
    if r.returncode != 0:
        return False, r.stderr
    r = subprocess.run(
        ["sudo", "nmcli", "connection", "up", conn],
        capture_output=True, text=True, timeout=15
    )
    return r.returncode == 0, r.stderr


def _apply_eth0_dhcpcd(mode, ip="", prefix=24, gateway="", dns=""):
    """Wendet eth0-Konfiguration via dhcpcd.conf an. Gibt (ok, stderr) zurück."""
    try:
        content = Path("/etc/dhcpcd.conf").read_text(encoding="utf-8")
    except FileNotFoundError:
        content = ""
    # Alten Speech-Timer-Block entfernen
    content = re.sub(
        r"\n?# speech-timer-start\n.*?# speech-timer-end\n?",
        "",
        content,
        flags=re.DOTALL
    )
    if mode == "static":
        block = (
            f"\n# speech-timer-start\n"
            f"interface eth0\n"
            f"static ip_address={ip}/{prefix}\n"
            f"static routers={gateway}\n"
            f"static domain_name_servers={dns or '8.8.8.8'}\n"
            f"# speech-timer-end\n"
        )
        content = content.rstrip() + block
    r = subprocess.run(
        ["sudo", "tee", "/etc/dhcpcd.conf"],
        input=content, text=True, capture_output=True, timeout=5
    )
    if r.returncode != 0:
        return False, r.stderr
    r = subprocess.run(
        ["sudo", "systemctl", "restart", "dhcpcd"],
        capture_output=True, text=True, timeout=15
    )
    return r.returncode == 0, r.stderr


def _get_ap_running():
    """True wenn ein nmcli-Hotspot auf wlan0 aktiv ist."""
    try:
        r = subprocess.run(
            ["nmcli", "-t", "-f", "NAME,DEVICE,STATE", "connection", "show", "--active"],
            capture_output=True, text=True, timeout=5
        )
        return any(
            line.startswith("Hotspot:wlan0") and "activated" in line
            for line in r.stdout.splitlines()
        )
    except Exception:
        return False


def _get_ap_ip():
    """Gibt die IP-Adresse von wlan0 zurück (AP-IP wenn Hotspot läuft)."""
    try:
        r = subprocess.run(
            ["ip", "-4", "addr", "show", "wlan0"],
            capture_output=True, text=True, timeout=5
        )
        match = re.search(r"inet (\d+\.\d+\.\d+\.\d+)", r.stdout)
        return match.group(1) if match else ""
    except Exception:
        return ""


def _start_ap(ssid, password):
    """Startet nmcli-Hotspot auf wlan0. Gibt (ok, stderr) zurück."""
    r = subprocess.run(
        ["sudo", "nmcli", "device", "wifi", "hotspot",
         "ifname", "wlan0", "ssid", ssid, "password", password],
        capture_output=True, text=True, timeout=25
    )
    return r.returncode == 0, r.stderr


def _stop_ap():
    """Stoppt und löscht den nmcli-Hotspot."""
    subprocess.run(["sudo", "nmcli", "connection", "down", "Hotspot"],
                   capture_output=True, timeout=10)
    subprocess.run(["sudo", "nmcli", "connection", "delete", "Hotspot"],
                   capture_output=True, timeout=10)
```

- [ ] **Schritt 4: Verifizieren dass Python die Datei noch parsen kann**

```bash
python3 -c "import ast; ast.parse(open('pi-app/app.py').read()); print('OK')"
```

Erwartete Ausgabe: `OK`

- [ ] **Schritt 5: Commit**

```bash
git add pi-app/app.py
git commit -m "feat: Netzwerk-Helper-Funktionen für LAN-IP und Fallback-AP"
```

---

## Task 2: Backend — F-080 API: GET/POST /api/network/eth0

**Files:**
- Modify: `pi-app/app.py`

- [ ] **Schritt 1: Zwei neue Endpunkte nach dem `api_network_connect`-Handler einfügen**

Direkt nach der `api_network_connect`-Funktion (ca. Zeile 714), vor dem Kommentar `# ============================================================\n# Helpers`, folgende zwei Funktionen einfügen:

```python
@app.route('/api/network/eth0', methods=['GET'])
def api_get_eth0():
    """Liest aktuelle eth0-Konfiguration (DHCP oder statisch)."""
    try:
        if _detect_network_manager():
            return jsonify(_read_eth0_nmcli())
        else:
            return jsonify(_read_eth0_dhcpcd())
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500


@app.route('/api/network/eth0', methods=['POST'])
def api_set_eth0():
    """Setzt eth0 auf DHCP oder statische IP."""
    data = request.get_json()
    mode = data.get("mode", "dhcp")
    if mode not in ("dhcp", "static"):
        return jsonify({"status": "error", "message": "Ungültiger Mode"}), 400
    ip = data.get("ip", "").strip()
    prefix = int(data.get("prefix", 24))
    gateway = data.get("gateway", "").strip()
    dns = data.get("dns", "8.8.8.8").strip()

    if mode == "static" and (not ip or not gateway):
        return jsonify({"status": "error",
                        "message": "IP-Adresse und Gateway sind Pflichtfelder"}), 400

    try:
        if _detect_network_manager():
            conn = _get_eth0_conn_name()
            if not conn:
                return jsonify({"status": "error",
                                "message": "Keine aktive eth0-Connection gefunden"}), 400
            ok, err = _apply_eth0_nmcli(conn, mode, ip, prefix, gateway, dns)
        else:
            ok, err = _apply_eth0_dhcpcd(mode, ip, prefix, gateway, dns)

        if ok:
            return jsonify({"status": "ok"})
        return jsonify({"status": "error", "message": err or "Unbekannter Fehler"}), 500
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500
```

- [ ] **Schritt 2: Auf dem Pi mit curl testen (DHCP-Read)**

```bash
curl -s http://localhost:5000/api/network/eth0 | python3 -m json.tool
```

Erwartete Ausgabe (Beispiel):
```json
{
    "mode": "dhcp",
    "ip": "192.168.1.100",
    "prefix": 24,
    "gateway": "192.168.1.1",
    "dns": "8.8.8.8",
    "backend": "networkmanager"
}
```

- [ ] **Schritt 3: Statische IP setzen testen (nur auf Pi — trennt kurz die Verbindung)**

```bash
curl -s -X POST http://localhost:5000/api/network/eth0 \
  -H "Content-Type: application/json" \
  -d '{"mode":"static","ip":"192.168.1.200","prefix":24,"gateway":"192.168.1.1","dns":"8.8.8.8"}' \
  | python3 -m json.tool
```

Erwartete Ausgabe: `{"status": "ok"}`

Danach zurück auf DHCP:
```bash
curl -s -X POST http://localhost:5000/api/network/eth0 \
  -H "Content-Type: application/json" \
  -d '{"mode":"dhcp"}' | python3 -m json.tool
```

- [ ] **Schritt 4: Commit**

```bash
git add pi-app/app.py
git commit -m "feat(F-080): API GET/POST /api/network/eth0 - LAN-IP-Konfiguration"
```

---

## Task 3: Backend — F-081 API: AP-Endpunkte

**Files:**
- Modify: `pi-app/app.py`

- [ ] **Schritt 1: Vier AP-Endpunkte nach den eth0-Endpunkten einfügen**

Direkt nach `api_set_eth0` (Task 2), vor dem `# Helpers`-Kommentar:

```python
@app.route('/api/network/ap', methods=['GET'])
def api_get_ap():
    """AP-Status und gespeicherte Konfiguration."""
    config = load_config()
    ap_cfg = config.get("ap", {})
    nm = _detect_network_manager()
    running = _get_ap_running() if nm else False
    return jsonify({
        "nm_available": nm,
        "running": running,
        "ip": _get_ap_ip() if running else "",
        "ssid": ap_cfg.get("ssid", "SpeechTimer"),
        "password": ap_cfg.get("password", "speechtimer"),
        "auto_start": ap_cfg.get("auto_start", True),
    })


@app.route('/api/network/ap/config', methods=['POST'])
def api_ap_config():
    """Speichert SSID, Passwort und auto_start."""
    data = request.get_json()
    ssid = data.get("ssid", "").strip()
    password = data.get("password", "")
    if not ssid:
        return jsonify({"status": "error", "message": "SSID darf nicht leer sein"}), 400
    if len(password) < 8:
        return jsonify({"status": "error",
                        "message": "Passwort muss mindestens 8 Zeichen haben"}), 400
    config = load_config()
    config.setdefault("ap", {})
    config["ap"]["ssid"] = ssid
    config["ap"]["password"] = password
    config["ap"]["auto_start"] = bool(data.get("auto_start", True))
    save_config(config)
    return jsonify({"status": "ok"})


@app.route('/api/network/ap/start', methods=['POST'])
def api_ap_start():
    """Startet den Hotspot manuell."""
    if not _detect_network_manager():
        return jsonify({"status": "error",
                        "message": "NetworkManager nicht verfügbar"}), 400
    config = load_config()
    ap_cfg = config.get("ap", {})
    ssid = ap_cfg.get("ssid", "SpeechTimer")
    password = ap_cfg.get("password", "speechtimer")
    try:
        ok, err = _start_ap(ssid, password)
        if ok:
            return jsonify({"status": "ok", "ip": _get_ap_ip()})
        return jsonify({"status": "error", "message": err or "Hotspot konnte nicht gestartet werden"}), 500
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500


@app.route('/api/network/ap/stop', methods=['POST'])
def api_ap_stop():
    """Stoppt den Hotspot manuell."""
    if not _detect_network_manager():
        return jsonify({"status": "error",
                        "message": "NetworkManager nicht verfügbar"}), 400
    try:
        _stop_ap()
        return jsonify({"status": "ok"})
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500
```

- [ ] **Schritt 2: AP-Status-Endpunkt testen**

```bash
curl -s http://localhost:5000/api/network/ap | python3 -m json.tool
```

Erwartete Ausgabe (wenn kein AP läuft):
```json
{
    "nm_available": true,
    "running": false,
    "ip": "",
    "ssid": "SpeechTimer",
    "password": "speechtimer",
    "auto_start": true
}
```

- [ ] **Schritt 3: AP-Config-Endpunkt testen**

```bash
curl -s -X POST http://localhost:5000/api/network/ap/config \
  -H "Content-Type: application/json" \
  -d '{"ssid":"MeinTimer","password":"geheim123","auto_start":true}' \
  | python3 -m json.tool
```

Erwartete Ausgabe: `{"status": "ok"}`

Validierung testen (Passwort zu kurz):
```bash
curl -s -X POST http://localhost:5000/api/network/ap/config \
  -H "Content-Type: application/json" \
  -d '{"ssid":"Test","password":"kurz"}' | python3 -m json.tool
```

Erwartete Ausgabe: `{"message": "Passwort muss mindestens 8 Zeichen haben", "status": "error"}`

Config zurücksetzen:
```bash
curl -s -X POST http://localhost:5000/api/network/ap/config \
  -H "Content-Type: application/json" \
  -d '{"ssid":"SpeechTimer","password":"speechtimer","auto_start":true}' \
  | python3 -m json.tool
```

- [ ] **Schritt 4: Commit**

```bash
git add pi-app/app.py
git commit -m "feat(F-081): API GET/POST /api/network/ap + start/stop - Hotspot-Endpunkte"
```

---

## Task 4: Backend — AP-Monitor-Thread + App-Startup

**Files:**
- Modify: `pi-app/app.py`

- [ ] **Schritt 1: Monitor-Thread-Funktion nach `timer_loop` einfügen**

Nach der Funktion `timer_loop` (ca. Zeile 306), vor den Routes:

```python
def ap_monitor_thread():
    """
    Startet 15s nach App-Beginn den Fallback-AP wenn kein WLAN verbunden ist.
    Überwacht danach alle 30s den AP-Status (Sync mit tatsächlichem Zustand).
    """
    socketio.sleep(15)

    config = load_config()
    ap_cfg = config.get("ap", {})

    ap_started_by_us = _get_ap_running()  # AP lief evtl. schon vor dem Restart

    if not ap_started_by_us and ap_cfg.get("auto_start", True):
        try:
            result = subprocess.run(
                ["iwgetid", "-r"], capture_output=True, text=True, timeout=5
            )
            ssid = result.stdout.strip()
        except Exception:
            ssid = ""

        if not ssid:
            ok, err = _start_ap(
                ap_cfg.get("ssid", "SpeechTimer"),
                ap_cfg.get("password", "speechtimer")
            )
            if ok:
                ap_started_by_us = True
            else:
                log.warning(f"Fallback-AP konnte nicht gestartet werden: {err}")

    while True:
        socketio.sleep(30)
        if ap_started_by_us and not _get_ap_running():
            # AP wurde extern gestoppt — Zustand synchronisieren
            ap_started_by_us = False
```

- [ ] **Schritt 2: Thread im `__main__`-Block starten**

Den `__main__`-Block (Zeile 892–896) so anpassen:

```python
if __name__ == '__main__':
    config = load_config()
    apply_osc_config(config["osc"])
    socketio.start_background_task(timer_loop)
    socketio.start_background_task(ap_monitor_thread)
    socketio.run(app, host='0.0.0.0', port=5000, debug=False, allow_unsafe_werkzeug=True)
```

- [ ] **Schritt 3: Python-Syntax prüfen**

```bash
python3 -c "import ast; ast.parse(open('pi-app/app.py').read()); print('OK')"
```

Erwartete Ausgabe: `OK`

- [ ] **Schritt 4: App starten und Log prüfen**

```bash
cd pi-app && python3 app.py
```

Nach ~15 Sekunden im Log prüfen — falls kein WLAN verbunden:
```
[INFO] Fallback-AP gestartet
```

Falls WLAN verbunden: Kein AP-Log (Thread läuft still).

- [ ] **Schritt 5: Commit**

```bash
git add pi-app/app.py
git commit -m "feat(F-081): AP-Monitor-Thread - Auto-Start bei fehlendem WLAN"
```

---

## Task 5: UI HTML — Zwei neue Cards im Netzwerk-Tab

**Files:**
- Modify: `pi-app/templates/settings.html`

- [ ] **Schritt 1: LAN-Card nach dem bestehenden WLAN-Dialog einfügen**

Im Netzwerk-Tab (`<section class="tab-content" id="tab-network">`), nach dem schließenden `</div>` des WLAN-Dialog-Blocks (nach Zeile ~168) und vor dem schließenden `</section>`, folgende Cards einfügen:

```html
            <!-- LAN (eth0) -->
            <div class="card" id="card-eth0">
                <h2>LAN (eth0)</h2>
                <div id="eth0-loading">Lade...</div>
                <div id="eth0-config" class="hidden">
                    <div class="form-row">
                        <label>Konfiguration</label>
                        <div class="radio-group">
                            <label><input type="radio" name="eth0-mode" value="dhcp"> DHCP (automatisch)</label>
                            <label><input type="radio" name="eth0-mode" value="static"> Statische IP</label>
                        </div>
                    </div>
                    <div id="eth0-static-fields" class="hidden">
                        <div class="form-row">
                            <label for="eth0-ip">IP-Adresse</label>
                            <input type="text" id="eth0-ip" placeholder="z.B. 192.168.1.100">
                        </div>
                        <div class="form-row">
                            <label for="eth0-prefix">Subnetzmaske</label>
                            <select id="eth0-prefix">
                                <option value="8">/8 — 255.0.0.0</option>
                                <option value="16">/16 — 255.255.0.0</option>
                                <option value="24" selected>/24 — 255.255.255.0</option>
                                <option value="25">/25 — 255.255.255.128</option>
                                <option value="26">/26 — 255.255.255.192</option>
                                <option value="28">/28 — 255.255.255.240</option>
                                <option value="29">/29 — 255.255.255.248</option>
                                <option value="30">/30 — 255.255.255.252</option>
                            </select>
                        </div>
                        <div class="form-row">
                            <label for="eth0-gateway">Gateway</label>
                            <input type="text" id="eth0-gateway" placeholder="z.B. 192.168.1.1">
                        </div>
                        <div class="form-row">
                            <label for="eth0-dns">DNS</label>
                            <input type="text" id="eth0-dns" placeholder="z.B. 8.8.8.8">
                        </div>
                    </div>
                    <div class="info-box">ℹ️ Änderungen trennen kurz die LAN-Verbindung.</div>
                    <button id="btn-save-eth0" class="btn btn-primary" style="margin-top:1rem;">LAN-Konfiguration speichern</button>
                </div>
                <div id="eth0-unavailable" class="hidden info-box">
                    ⚠️ eth0 nicht verfügbar oder NetworkManager/dhcpcd nicht erkannt.
                </div>
            </div>

            <!-- Fallback WLAN-Hotspot -->
            <div class="card" id="card-ap">
                <h2>Fallback WLAN-Hotspot</h2>
                <p style="color:var(--color-secondary);margin-bottom:1rem;">
                    Startet automatisch einen WLAN-Hotspot, wenn beim Booten kein bekanntes WLAN erreichbar ist.
                </p>
                <div id="ap-unavailable" class="hidden info-box">
                    ⚠️ NetworkManager nicht gefunden — Hotspot-Funktion nicht verfügbar.
                </div>
                <div id="ap-config-section">
                    <div class="form-row">
                        <label for="ap-ssid">SSID (Netzwerkname)</label>
                        <input type="text" id="ap-ssid" placeholder="SpeechTimer">
                    </div>
                    <div class="form-row">
                        <label for="ap-password">Passwort (min. 8 Zeichen)</label>
                        <input type="password" id="ap-password" placeholder="speechtimer">
                    </div>
                    <div class="checkbox-row" style="margin-bottom:1rem;">
                        <label>
                            <input type="checkbox" id="ap-auto-start" checked>
                            Automatisch starten wenn kein WLAN erreichbar
                        </label>
                    </div>
                    <div style="margin-bottom:1rem;">
                        <span id="ap-status-badge" class="ap-badge ap-badge-inactive">Inaktiv</span>
                        <span id="ap-ip" style="margin-left:0.5rem;color:var(--color-secondary);font-family:monospace;font-size:0.9rem;"></span>
                    </div>
                    <div style="display:flex;gap:0.5rem;flex-wrap:wrap;">
                        <button id="btn-save-ap" class="btn btn-secondary">Einstellungen speichern</button>
                        <button id="btn-start-ap" class="btn btn-primary">Hotspot starten</button>
                        <button id="btn-stop-ap" class="btn btn-secondary" style="display:none;">Hotspot stoppen</button>
                    </div>
                </div>
            </div>
```

- [ ] **Schritt 2: HTML-Validierung (visuell)**

Seite im Browser öffnen → Netzwerk-Tab anklicken → Beide neuen Cards sollten sichtbar sein. Felder anzeigen ohne JS-Fehler in der Konsole.

- [ ] **Schritt 3: Commit**

```bash
git add pi-app/templates/settings.html
git commit -m "feat: Settings HTML - LAN-IP und Hotspot-Abschnitte in Netzwerk-Tab"
```

---

## Task 6: UI CSS — AP-Badge-Stile

**Files:**
- Modify: `pi-app/static/css/settings.css`

- [ ] **Schritt 1: Bestehende settings.css lesen um passende Stelle zu finden**

```bash
tail -20 pi-app/static/css/settings.css
```

- [ ] **Schritt 2: Badge-Stile ans Ende von settings.css anfügen**

```css
/* ============ AP-Badge ============ */
.ap-badge {
    display: inline-block;
    padding: 0.2rem 0.7rem;
    border-radius: 1rem;
    font-size: 0.85rem;
    font-weight: 600;
}

.ap-badge-active {
    background: #16a34a;
    color: #fff;
}

.ap-badge-inactive {
    background: #475569;
    color: #fff;
}

/* ============ Radio-Gruppe ============ */
.radio-group {
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
}

.radio-group label {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    cursor: pointer;
    font-weight: normal;
}
```

- [ ] **Schritt 3: Im Browser prüfen**

Netzwerk-Tab → AP-Karte → Badge "Inaktiv" soll grau und abgerundet sein. Radio-Buttons sollen untereinander stehen.

- [ ] **Schritt 4: Commit**

```bash
git add pi-app/static/css/settings.css
git commit -m "feat: Settings CSS - AP-Badge und Radio-Gruppe"
```

---

## Task 7: UI JS — LAN-IP und Hotspot-Logik

**Files:**
- Modify: `pi-app/static/js/settings.js`

- [ ] **Schritt 1: Tab-Handler erweitern um eth0 und AP zu laden**

Im Tab-Handler (ca. Zeile 29):
```javascript
// Lazy-Load: Netzwerk-Status laden, wenn Tab geöffnet wird
if (btn.dataset.tab === 'network') {
    loadNetworkStatus();
    loadEth0Config();
    loadApConfig();
}
```

Die Zeile `if (btn.dataset.tab === 'network') loadNetworkStatus();` durch den Block oben ersetzen.

- [ ] **Schritt 2: LAN-IP-Logik ans Ende der JS-Datei einfügen (vor der schließenden `})();`)**

```javascript
    // ============ LAN (eth0) ============
    async function loadEth0Config() {
        const loading = document.getElementById('eth0-loading');
        const configEl = document.getElementById('eth0-config');
        const unavailable = document.getElementById('eth0-unavailable');
        try {
            const res = await fetch('/api/network/eth0');
            const data = await res.json();
            loading.classList.add('hidden');
            if (data.error) {
                unavailable.classList.remove('hidden');
                return;
            }
            configEl.classList.remove('hidden');
            const mode = data.mode || 'dhcp';
            const radio = document.querySelector(`input[name="eth0-mode"][value="${mode}"]`);
            if (radio) radio.checked = true;
            document.getElementById('eth0-static-fields').classList.toggle('hidden', mode !== 'static');
            document.getElementById('eth0-ip').value = data.ip || '';
            const prefixEl = document.getElementById('eth0-prefix');
            if (prefixEl) prefixEl.value = String(data.prefix || 24);
            document.getElementById('eth0-gateway').value = data.gateway || '';
            document.getElementById('eth0-dns').value = data.dns || '';
        } catch (e) {
            if (loading) loading.classList.add('hidden');
            if (unavailable) unavailable.classList.remove('hidden');
        }
    }

    document.querySelectorAll('input[name="eth0-mode"]').forEach(radio => {
        radio.addEventListener('change', () => {
            document.getElementById('eth0-static-fields').classList.toggle(
                'hidden', radio.value !== 'static'
            );
        });
    });

    document.getElementById('btn-save-eth0').addEventListener('click', async () => {
        const modeEl = document.querySelector('input[name="eth0-mode"]:checked');
        if (!modeEl) return;
        const mode = modeEl.value;
        const payload = { mode };
        if (mode === 'static') {
            payload.ip = document.getElementById('eth0-ip').value.trim();
            payload.prefix = parseInt(document.getElementById('eth0-prefix').value, 10);
            payload.gateway = document.getElementById('eth0-gateway').value.trim();
            payload.dns = document.getElementById('eth0-dns').value.trim() || '8.8.8.8';
            if (!payload.ip || !payload.gateway) {
                showToast('IP-Adresse und Gateway sind Pflichtfelder', 'error');
                return;
            }
        }
        try {
            const res = await fetch('/api/network/eth0', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });
            const data = await res.json();
            if (data.status === 'ok') {
                showToast('LAN-Konfiguration gespeichert', 'success');
            } else {
                showToast('Fehler: ' + (data.message || 'unbekannt'), 'error');
            }
        } catch (e) {
            showToast('Fehler: ' + e.message, 'error');
        }
    });

    // ============ Fallback-AP ============
    function updateApStatus(running, ip) {
        const badge = document.getElementById('ap-status-badge');
        const ipEl = document.getElementById('ap-ip');
        const btnStart = document.getElementById('btn-start-ap');
        const btnStop = document.getElementById('btn-stop-ap');
        if (!badge) return;
        if (running) {
            badge.className = 'ap-badge ap-badge-active';
            badge.textContent = 'Hotspot aktiv';
            if (ipEl) ipEl.textContent = ip || '';
            if (btnStart) btnStart.style.display = 'none';
            if (btnStop) btnStop.style.display = '';
        } else {
            badge.className = 'ap-badge ap-badge-inactive';
            badge.textContent = 'Inaktiv';
            if (ipEl) ipEl.textContent = '';
            if (btnStart) btnStart.style.display = '';
            if (btnStop) btnStop.style.display = 'none';
        }
    }

    async function loadApConfig() {
        try {
            const res = await fetch('/api/network/ap');
            const data = await res.json();
            const unavailable = document.getElementById('ap-unavailable');
            const configSection = document.getElementById('ap-config-section');
            if (!data.nm_available) {
                if (unavailable) unavailable.classList.remove('hidden');
                if (configSection) configSection.classList.add('hidden');
                return;
            }
            document.getElementById('ap-ssid').value = data.ssid || 'SpeechTimer';
            document.getElementById('ap-password').value = data.password || 'speechtimer';
            document.getElementById('ap-auto-start').checked = !!data.auto_start;
            updateApStatus(data.running, data.ip);
        } catch (e) {
            showToast('AP-Status nicht abrufbar', 'error');
        }
    }

    document.getElementById('btn-save-ap').addEventListener('click', async () => {
        const ssid = document.getElementById('ap-ssid').value.trim();
        const password = document.getElementById('ap-password').value;
        const autoStart = document.getElementById('ap-auto-start').checked;
        if (!ssid) { showToast('SSID darf nicht leer sein', 'error'); return; }
        if (password.length < 8) { showToast('Passwort muss mind. 8 Zeichen haben', 'error'); return; }
        try {
            const res = await fetch('/api/network/ap/config', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ssid, password, auto_start: autoStart }),
            });
            const data = await res.json();
            if (data.status === 'ok') showToast('Hotspot-Einstellungen gespeichert', 'success');
            else showToast('Fehler: ' + (data.message || ''), 'error');
        } catch (e) {
            showToast('Fehler: ' + e.message, 'error');
        }
    });

    document.getElementById('btn-start-ap').addEventListener('click', async () => {
        try {
            const res = await fetch('/api/network/ap/start', { method: 'POST' });
            const data = await res.json();
            if (data.status === 'ok') {
                updateApStatus(true, data.ip);
                showToast('Hotspot gestartet', 'success');
            } else {
                showToast('Fehler: ' + (data.message || ''), 'error');
            }
        } catch (e) {
            showToast('Fehler: ' + e.message, 'error');
        }
    });

    document.getElementById('btn-stop-ap').addEventListener('click', async () => {
        try {
            const res = await fetch('/api/network/ap/stop', { method: 'POST' });
            const data = await res.json();
            if (data.status === 'ok') {
                updateApStatus(false, '');
                showToast('Hotspot gestoppt', 'success');
            } else {
                showToast('Fehler: ' + (data.message || ''), 'error');
            }
        } catch (e) {
            showToast('Fehler: ' + e.message, 'error');
        }
    });
```

- [ ] **Schritt 3: Netzwerk-Tab im Browser testen**

1. Netzwerk-Tab öffnen
2. LAN-Card: zeigt aktuelle Konfiguration (DHCP/Statisch vorausgefüllt)?
3. Radio auf "Statisch" → Felder erscheinen?
4. Radio auf "DHCP" → Felder verschwinden?
5. AP-Card: zeigt SSID/Passwort/Badge?
6. Browser-Konsole: keine JS-Fehler?

- [ ] **Schritt 4: Commit**

```bash
git add pi-app/static/js/settings.js
git commit -m "feat: Settings JS - LAN-IP und Hotspot-UI-Logik"
```

---

## Task 8: Docs-Update + Final-Commit

**Files:**
- Modify: `docs/features.md`

- [ ] **Schritt 1: F-080 und F-081 als implementiert markieren**

In `docs/features.md`, die beiden offenen Einträge von `- [ ]` auf `- [x]` ändern und unter `## Implementiert (v3.x)` in eine passende Sektion verschieben. Eine neue Sektion `### Netzwerk-Konfiguration` anlegen (nach `### System & Setup`):

```markdown
### Netzwerk-Konfiguration
- [x] **F-080: LAN-IP-Konfiguration** — Ethernet-Interface (eth0) im Einstellungsmenü auf feste IP oder DHCP umstellen. Felder: IP-Adresse, Subnetzmaske, Gateway, DNS. Unterstützt NetworkManager (Bookworm+) und dhcpcd (Bullseye).
- [x] **F-081: Fallback-Access-Point** — Wenn beim Boot kein bekanntes WLAN in Reichweite ist, öffnet der Pi automatisch einen eigenen WLAN-AP (SSID + Passwort konfigurierbar). Darüber ist das Einstellungsmenü erreichbar. AP läuft dauerhaft bis er manuell gestoppt wird.
```

Den Abschnitt `## Offen` und den Netzwerk-Block darunter entfernen (oder leer lassen).

- [ ] **Schritt 2: Commit**

```bash
git add docs/features.md
git commit -m "docs: F-080 und F-081 als implementiert markieren"
```

- [ ] **Schritt 3: Push**

```bash
git push
```

---

## Vollständige End-to-End-Verifikation

Nach allen Tasks auf dem Pi ausführen:

```bash
# 1. App starten
cd /home/pi/speech-timer-pi/pi-app && python3 app.py &

# 2. Alle neuen Endpunkte einmal aufrufen
curl -s http://localhost:5000/api/network/eth0 | python3 -m json.tool
curl -s http://localhost:5000/api/network/ap | python3 -m json.tool

# 3. AP manuell starten und stoppen
curl -s -X POST http://localhost:5000/api/network/ap/start | python3 -m json.tool
sleep 5
curl -s http://localhost:5000/api/network/ap | python3 -m json.tool  # running: true erwartet
curl -s -X POST http://localhost:5000/api/network/ap/stop | python3 -m json.tool
curl -s http://localhost:5000/api/network/ap | python3 -m json.tool  # running: false erwartet

# 4. App neu starten ohne WLAN → nach 15s prüfen ob AP startet
sudo pkill -f app.py
sudo systemctl restart speech-timer
sleep 20
curl -s http://localhost:5000/api/network/ap | python3 -m json.tool
```
