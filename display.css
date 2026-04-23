#!/usr/bin/env python3
"""
Speech Timer für Raspberry Pi 4 – v3
Änderungen gegenüber v2:
- Presets/Manual-Eingabe laden den Timer, starten ihn aber NICHT
- Start/Pause/Stop/Reset mit klar getrennten Funktionen
- Zeit-Anpassung (+/- x Sekunden) auch während laufendem Timer
- Display-Modus: Timer oder Echtzeit-Uhr (umschaltbar)
- Kein Redner-Feld mehr
"""

import json
import os
import subprocess
import threading
import time
from datetime import datetime
from pathlib import Path

from flask import Flask, jsonify, render_template, request, send_from_directory
from flask_socketio import SocketIO, emit

from osc_manager import OSCManager

BASE_DIR = Path(__file__).parent.resolve()
CONFIG_FILE = BASE_DIR / "config.json"

DEFAULT_CONFIG = {
    "presets": [
        {"id": 1, "name": "Kurzvortrag", "duration": 300, "warning1": 60, "warning2": 30},
        {"id": 2, "name": "Standard Vortrag", "duration": 900, "warning1": 180, "warning2": 60},
        {"id": 3, "name": "Langer Vortrag", "duration": 1800, "warning1": 300, "warning2": 120},
        {"id": 4, "name": "Diskussion", "duration": 600, "warning1": 120, "warning2": 30},
    ],
    "display": {
        "background_color": "#000000",
        "text_color": "#FFFFFF",
        "warning1_color": "#FFAA00",
        "warning2_color": "#FF0000",
        "overtime_color": "#FF0000",
        "font_size": 40,
        "brightness": 100,
        "mode": "timer",  # "timer" oder "clock"
    },
    "system": {
        "timezone": "Europe/Berlin",
        "blink_on_warning": True,
        "blink_on_overtime": True,
    },
    "osc": {
        "enabled": False,
        "receive_port": 8000,
        "targets": [],
    },
}

app = Flask(__name__)
app.config['SECRET_KEY'] = 'speech-timer-pi-secret-key-2026'
socketio = SocketIO(app, cors_allowed_origins="*", async_mode='threading')


# ============================================================
# Timer Controller
# ============================================================
class TimerController:
    """
    State-Machine mit drei Phasen:
      - idle:    kein Preset geladen (duration == 0)
      - loaded:  Preset geladen, Timer noch nicht gestartet
      - running: Timer läuft
      - paused:  Timer pausiert
      - stopped: Timer wurde gestoppt (auf 00:00), Preset noch geladen
    """

    def __init__(self):
        self.state = {
            "running": False,
            "paused": False,
            "stopped": False,      # nach Stop-Button: zeigt 00:00 an
            "start_time": None,
            "elapsed": 0,
            "duration": 0,
            "warning1": 0,
            "warning2": 0,
            "preset_name": "",
            "overtime": False,
        }
        self.lock = threading.Lock()

    def load(self, data):
        """Lädt Preset/Zeit, startet aber NICHT."""
        with self.lock:
            self.state["duration"] = int(data.get("duration", 300))
            self.state["warning1"] = int(data.get("warning1", 60))
            self.state["warning2"] = int(data.get("warning2", 30))
            self.state["preset_name"] = data.get("preset_name", "")
            self.state["start_time"] = None
            self.state["elapsed"] = 0
            self.state["running"] = False
            self.state["paused"] = False
            self.state["stopped"] = False
            self.state["overtime"] = False

    def start(self):
        """Startet den Timer oder setzt ihn fort (nach Pause)."""
        with self.lock:
            if self.state["duration"] <= 0:
                return  # Nichts zu starten
            if self.state["stopped"]:
                # Nach Stop → Neustart von vorn
                self.state["start_time"] = time.time()
                self.state["elapsed"] = 0
                self.state["running"] = True
                self.state["paused"] = False
                self.state["stopped"] = False
                self.state["overtime"] = False
            elif not self.state["running"]:
                # Erststart
                self.state["start_time"] = time.time()
                self.state["elapsed"] = 0
                self.state["running"] = True
                self.state["paused"] = False
                self.state["overtime"] = False
            elif self.state["paused"]:
                # Fortsetzen
                self.state["start_time"] = time.time()
                self.state["paused"] = False

    def pause(self):
        """Pausiert oder setzt fort (Toggle)."""
        with self.lock:
            if not self.state["running"]:
                return
            if self.state["paused"]:
                # Fortsetzen
                self.state["start_time"] = time.time()
                self.state["paused"] = False
            else:
                # Pause
                self.state["elapsed"] += time.time() - self.state["start_time"]
                self.state["paused"] = True

    def stop(self):
        """Stoppt und setzt auf 00:00 (Preset bleibt geladen)."""
        with self.lock:
            self.state["running"] = False
            self.state["paused"] = False
            self.state["stopped"] = True
            self.state["elapsed"] = self.state["duration"]  # Timer zeigt 00:00
            self.state["overtime"] = False

    def reset(self):
        """Stoppt den Timer und entlädt das Preset komplett."""
        with self.lock:
            self.state["running"] = False
            self.state["paused"] = False
            self.state["stopped"] = False
            self.state["elapsed"] = 0
            self.state["duration"] = 0
            self.state["warning1"] = 0
            self.state["warning2"] = 0
            self.state["preset_name"] = ""
            self.state["overtime"] = False

    def adjust_time(self, seconds):
        """
        Ändert die Restzeit (+/- Sekunden). Funktioniert auch während
        der Timer läuft. Bei negativer neuer Restzeit wird auf 0 begrenzt.
        """
        with self.lock:
            seconds = int(seconds)
            # Wenn wir gerade stopped sind, Duration neu setzen & elapsed reset
            if self.state["stopped"]:
                self.state["duration"] = max(0, self.state["duration"] + seconds)
                self.state["elapsed"] = self.state["duration"]
                return

            # Sonst einfach Gesamtdauer anpassen
            new_duration = self.state["duration"] + seconds
            if new_duration < 0:
                new_duration = 0
            self.state["duration"] = new_duration

            # Overtime-Flag zurücksetzen, falls wir dadurch aus dem Overtime kommen
            if self.state["running"] and not self.state["paused"]:
                current_elapsed = time.time() - self.state["start_time"] + self.state["elapsed"]
                if current_elapsed < self.state["duration"]:
                    self.state["overtime"] = False

    def status(self):
        with self.lock:
            return dict(self.state)

    def get_presets(self):
        config = load_config()
        return config["presets"]

    def compute_update(self):
        with self.lock:
            if self.state["stopped"]:
                # Timer steht auf 00:00
                phase = "stopped"
                elapsed = self.state["duration"]
                remaining = 0
            elif self.state["duration"] <= 0:
                # Kein Preset geladen
                phase = "idle"
                elapsed = 0
                remaining = 0
            elif self.state["running"] and not self.state["paused"]:
                elapsed = time.time() - self.state["start_time"] + self.state["elapsed"]
                remaining = self.state["duration"] - elapsed
                if remaining < 0:
                    phase = "overtime"
                    self.state["overtime"] = True
                elif remaining <= self.state["warning2"]:
                    phase = "warning2"
                elif remaining <= self.state["warning1"]:
                    phase = "warning1"
                else:
                    phase = "normal"
            elif self.state["paused"]:
                elapsed = self.state["elapsed"]
                remaining = self.state["duration"] - elapsed
                phase = "paused"
            else:
                # loaded, noch nicht gestartet
                elapsed = 0
                remaining = self.state["duration"]
                phase = "loaded"

            return {
                "running": self.state["running"],
                "paused": self.state["paused"],
                "stopped": self.state["stopped"],
                "elapsed": elapsed,
                "remaining": remaining,
                "duration": self.state["duration"],
                "phase": phase,
                "preset_name": self.state["preset_name"],
                "overtime": self.state["overtime"],
                "current_time": datetime.now().strftime("%H:%M:%S"),
            }


timer = TimerController()
osc_manager = OSCManager(timer)


def _osc_display_mode(mode):
    """Wird vom OSCManager aufgerufen, wenn /display/mode oder /display/mode/toggle kommt."""
    config = load_config()
    if mode == "toggle":
        current = config["display"].get("mode", "timer")
        mode = "clock" if current == "timer" else "timer"
    if mode not in ("timer", "clock"):
        return
    config["display"]["mode"] = mode
    save_config(config)
    socketio.emit('display_config_update', config["display"])
    osc_manager.send("/display/mode", mode)


osc_manager.display_mode_callback = _osc_display_mode


# ============================================================
# Konfig
# ============================================================
def load_config():
    if not CONFIG_FILE.exists():
        save_config(DEFAULT_CONFIG)
        return DEFAULT_CONFIG.copy()
    try:
        with open(CONFIG_FILE, 'r', encoding='utf-8') as f:
            config = json.load(f)
        for key, value in DEFAULT_CONFIG.items():
            if key not in config:
                config[key] = value
            elif isinstance(value, dict):
                for sub_key, sub_val in value.items():
                    if sub_key not in config[key]:
                        config[key][sub_key] = sub_val
        return config
    except (json.JSONDecodeError, IOError):
        return DEFAULT_CONFIG.copy()


def save_config(config):
    with open(CONFIG_FILE, 'w', encoding='utf-8') as f:
        json.dump(config, f, indent=2, ensure_ascii=False)


# ============================================================
# Timer-Thread
# ============================================================
def timer_loop():
    last_osc_send = 0
    while True:
        update = timer.compute_update()
        socketio.emit('timer_update', update)
        now = time.time()
        if now - last_osc_send >= 0.5:
            osc_manager.send_state(update)
            last_osc_send = now
        socketio.sleep(0.1)


# ============================================================
# Routes
# ============================================================
@app.route('/')
def index():
    config = load_config()
    return render_template('display.html', config=config)


@app.route('/control')
def control():
    config = load_config()
    return render_template('control.html', config=config)


@app.route('/settings')
def settings():
    config = load_config()
    timezones = get_timezones()
    current_time = datetime.now().strftime("%Y-%m-%dT%H:%M")
    return render_template('settings.html', config=config,
                         timezones=timezones, current_time=current_time)


# Notfall-Fallback: Falls jemand noch auf die alte URL /socket.io/socket.io.js
# zugreift (z.B. wegen Browser-Cache), liefere die lokale Datei statt 400.
@app.route('/socket.io/socket.io.js')
def socketio_fallback():
    static_dir = BASE_DIR / "static" / "js"
    if (static_dir / "socket.io.min.js").exists():
        return send_from_directory(str(static_dir), "socket.io.min.js")
    return "Socket.IO client not found", 404


# ============================================================
# API - Timer
# ============================================================
@app.route('/api/timer/load', methods=['POST'])
def api_timer_load():
    """Lädt Preset/Zeit ohne zu starten."""
    data = request.get_json()
    timer.load(data)
    return jsonify({"status": "loaded"})


@app.route('/api/timer/start', methods=['POST'])
def api_timer_start():
    """Startet oder setzt fort."""
    timer.start()
    return jsonify({"status": "started"})


@app.route('/api/timer/pause', methods=['POST'])
def api_timer_pause():
    """Toggle Pause."""
    timer.pause()
    return jsonify({"status": "ok", "paused": timer.status()["paused"]})


@app.route('/api/timer/stop', methods=['POST'])
def api_timer_stop():
    """Stoppt und setzt auf 00:00."""
    timer.stop()
    return jsonify({"status": "stopped"})


@app.route('/api/timer/reset', methods=['POST'])
def api_timer_reset():
    """Kompletter Reset."""
    timer.reset()
    return jsonify({"status": "reset"})


@app.route('/api/timer/adjust', methods=['POST'])
def api_timer_adjust():
    """Zeit anpassen (+/- Sekunden)."""
    data = request.get_json()
    seconds = int(data.get("seconds", 0))
    timer.adjust_time(seconds)
    return jsonify({"status": "ok", "new_duration": timer.status()["duration"]})


@app.route('/api/timer/status', methods=['GET'])
def api_timer_status():
    return jsonify(timer.compute_update())


# ============================================================
# API - Display Mode (Timer/Clock Toggle)
# ============================================================
@app.route('/api/display/mode', methods=['POST'])
def api_display_mode():
    """Schaltet zwischen Timer und Clock um."""
    data = request.get_json()
    mode = data.get("mode", "timer")
    if mode not in ("timer", "clock"):
        return jsonify({"status": "error", "message": "Ungültiger Mode"}), 400
    config = load_config()
    config["display"]["mode"] = mode
    save_config(config)
    socketio.emit('display_config_update', config["display"])
    # Auch OSC benachrichtigen
    osc_manager.send("/display/mode", mode)
    return jsonify({"status": "ok", "mode": mode})


@app.route('/api/display/mode/toggle', methods=['POST'])
def api_display_mode_toggle():
    config = load_config()
    current = config["display"].get("mode", "timer")
    new_mode = "clock" if current == "timer" else "timer"
    config["display"]["mode"] = new_mode
    save_config(config)
    socketio.emit('display_config_update', config["display"])
    osc_manager.send("/display/mode", new_mode)
    return jsonify({"status": "ok", "mode": new_mode})


# ============================================================
# API - Presets
# ============================================================
@app.route('/api/presets', methods=['GET'])
def api_get_presets():
    config = load_config()
    return jsonify(config["presets"])


@app.route('/api/presets', methods=['POST'])
def api_save_presets():
    data = request.get_json()
    config = load_config()
    config["presets"] = data.get("presets", [])
    save_config(config)
    return jsonify({"status": "saved"})


@app.route('/api/presets/<int:preset_id>', methods=['DELETE'])
def api_delete_preset(preset_id):
    config = load_config()
    config["presets"] = [p for p in config["presets"] if p["id"] != preset_id]
    save_config(config)
    return jsonify({"status": "deleted"})


# ============================================================
# API - Display
# ============================================================
@app.route('/api/display', methods=['GET'])
def api_get_display():
    config = load_config()
    return jsonify(config["display"])


@app.route('/api/display', methods=['POST'])
def api_save_display():
    data = request.get_json()
    config = load_config()
    config["display"].update(data)
    save_config(config)
    socketio.emit('display_config_update', config["display"])
    if "brightness" in data:
        set_brightness(data["brightness"])
    return jsonify({"status": "saved"})


# ============================================================
# API - OSC
# ============================================================
@app.route('/api/osc', methods=['GET'])
def api_get_osc():
    config = load_config()
    return jsonify({
        **config["osc"],
        "server_running": osc_manager.server is not None,
        "num_targets": len(osc_manager.client_targets),
    })


@app.route('/api/osc', methods=['POST'])
def api_save_osc():
    data = request.get_json()
    config = load_config()
    config["osc"]["enabled"] = bool(data.get("enabled", False))
    config["osc"]["receive_port"] = int(data.get("receive_port", 8000))
    config["osc"]["targets"] = data.get("targets", [])
    save_config(config)
    apply_osc_config(config["osc"])
    return jsonify({
        "status": "saved",
        "server_running": osc_manager.server is not None,
        "num_targets": len(osc_manager.client_targets),
    })


@app.route('/api/osc/test', methods=['POST'])
def api_osc_test():
    data = request.get_json() or {}
    address = data.get("address", "/timer/test")
    value = data.get("value", "hello")
    if not osc_manager.client_targets:
        return jsonify({"status": "error", "message": "Keine OSC-Ziele konfiguriert"})
    osc_manager.send(address, value)
    return jsonify({
        "status": "ok",
        "sent_to": [f"{t['ip']}:{t['port']}" for t in osc_manager.client_targets],
    })


def apply_osc_config(osc_config):
    if osc_config.get("enabled"):
        osc_manager.start_server(port=osc_config.get("receive_port", 8000))
        osc_manager.set_targets(osc_config.get("targets", []))
    else:
        osc_manager.stop_server()
        osc_manager.set_targets([])


# ============================================================
# API - Systemzeit (mit NTP-Fix!)
# ============================================================
@app.route('/api/system/time', methods=['GET'])
def api_get_time():
    return jsonify({
        "datetime": datetime.now().strftime("%Y-%m-%dT%H:%M:%S"),
        "timezone": get_current_timezone(),
        "ntp_active": is_ntp_active(),
    })


@app.route('/api/system/time', methods=['POST'])
def api_set_time():
    """
    Setzt die Systemzeit. Dabei muss NTP deaktiviert werden,
    sonst wird die Zeit sofort wieder überschrieben.
    """
    data = request.get_json()
    new_time = data.get("datetime")
    if not new_time:
        return jsonify({"status": "error", "message": "Kein Zeitwert übergeben"}), 400
    try:
        new_time = new_time.replace("T", " ")
        if len(new_time) == 16:
            new_time += ":00"

        # 1. NTP vorübergehend deaktivieren (sonst wird Zeit sofort überschrieben)
        subprocess.run(
            ["sudo", "timedatectl", "set-ntp", "false"],
            capture_output=True, text=True, timeout=5
        )

        # 2. Zeit setzen via timedatectl (robuster als date)
        result = subprocess.run(
            ["sudo", "timedatectl", "set-time", new_time],
            capture_output=True, text=True, timeout=5
        )
        if result.returncode != 0:
            # Fallback auf date
            result = subprocess.run(
                ["sudo", "date", "-s", new_time],
                capture_output=True, text=True, timeout=5
            )
            if result.returncode != 0:
                return jsonify({"status": "error", "message": result.stderr or result.stdout}), 500

        # 3. Hardware-Clock synchronisieren (falls vorhanden)
        subprocess.run(["sudo", "hwclock", "-w"], capture_output=True, timeout=5)

        return jsonify({"status": "ok", "ntp_disabled": True})
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500


@app.route('/api/system/ntp', methods=['POST'])
def api_set_ntp():
    """NTP an/aus schalten."""
    data = request.get_json()
    enabled = bool(data.get("enabled", True))
    try:
        result = subprocess.run(
            ["sudo", "timedatectl", "set-ntp", "true" if enabled else "false"],
            capture_output=True, text=True, timeout=5
        )
        if result.returncode != 0:
            return jsonify({"status": "error", "message": result.stderr}), 500
        return jsonify({"status": "ok", "ntp_enabled": enabled})
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500


@app.route('/api/system/timezone', methods=['POST'])
def api_set_timezone():
    data = request.get_json()
    tz = data.get("timezone")
    if not tz:
        return jsonify({"status": "error", "message": "Keine Zeitzone übergeben"}), 400
    try:
        result = subprocess.run(
            ["sudo", "timedatectl", "set-timezone", tz],
            capture_output=True, text=True, timeout=5
        )
        if result.returncode != 0:
            return jsonify({"status": "error", "message": result.stderr}), 500
        config = load_config()
        config["system"]["timezone"] = tz
        save_config(config)
        return jsonify({"status": "ok"})
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500


@app.route('/api/system/blink', methods=['POST'])
def api_system_blink():
    """Speichert Blink-Einstellungen."""
    data = request.get_json()
    config = load_config()
    if "blink_on_warning" in data:
        config["system"]["blink_on_warning"] = bool(data["blink_on_warning"])
    if "blink_on_overtime" in data:
        config["system"]["blink_on_overtime"] = bool(data["blink_on_overtime"])
    save_config(config)
    # Auch ans Display senden (für Live-Update)
    socketio.emit('display_config_update', {
        "blink_on_warning": config["system"]["blink_on_warning"],
        "blink_on_overtime": config["system"]["blink_on_overtime"],
    })
    return jsonify({"status": "ok"})


# ============================================================
# API - Netzwerk
# ============================================================
@app.route('/api/network/scan', methods=['GET'])
def api_network_scan():
    try:
        result = subprocess.run(
            ["sudo", "iwlist", "wlan0", "scan"],
            capture_output=True, text=True, timeout=15
        )
        networks = parse_iwlist(result.stdout)
        return jsonify({"networks": networks})
    except Exception as e:
        return jsonify({"status": "error", "message": str(e), "networks": []}), 500


@app.route('/api/network/status', methods=['GET'])
def api_network_status():
    try:
        ssid_result = subprocess.run(
            ["iwgetid", "-r"], capture_output=True, text=True, timeout=5
        )
        ssid = ssid_result.stdout.strip()
        ip_result = subprocess.run(
            ["hostname", "-I"], capture_output=True, text=True, timeout=5
        )
        ip = ip_result.stdout.strip().split()[0] if ip_result.stdout.strip() else ""
        return jsonify({
            "ssid": ssid,
            "ip": ip,
            "connected": bool(ssid and ip),
        })
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500


@app.route('/api/network/connect', methods=['POST'])
def api_network_connect():
    data = request.get_json()
    ssid = data.get("ssid")
    password = data.get("password", "")
    if not ssid:
        return jsonify({"status": "error", "message": "Keine SSID übergeben"}), 400
    try:
        conf_path = "/etc/wpa_supplicant/wpa_supplicant.conf"
        if password:
            network_block = (
                f'\nnetwork={{\n    ssid="{ssid}"\n    psk="{password}"\n'
                f'    key_mgmt=WPA-PSK\n}}\n'
            )
        else:
            network_block = (
                f'\nnetwork={{\n    ssid="{ssid}"\n    key_mgmt=NONE\n}}\n'
            )
        subprocess.run(
            ["sudo", "tee", "-a", conf_path],
            input=network_block, text=True, capture_output=True, timeout=5
        )
        subprocess.run(["sudo", "wpa_cli", "-i", "wlan0", "reconfigure"],
                      capture_output=True, timeout=5)
        return jsonify({"status": "ok", "message": "Netzwerk hinzugefügt"})
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500


# ============================================================
# Helpers
# ============================================================
def get_timezones():
    try:
        result = subprocess.run(
            ["timedatectl", "list-timezones"],
            capture_output=True, text=True, timeout=5
        )
        return result.stdout.strip().split("\n")
    except Exception:
        return ["Europe/Berlin", "Europe/Vienna", "Europe/Zurich",
                "Europe/London", "UTC", "America/New_York"]


def get_current_timezone():
    try:
        result = subprocess.run(
            ["timedatectl", "show", "-p", "Timezone", "--value"],
            capture_output=True, text=True, timeout=5
        )
        return result.stdout.strip()
    except Exception:
        return "Europe/Berlin"


def is_ntp_active():
    """Prüft, ob NTP synchronisation aktiv ist."""
    try:
        result = subprocess.run(
            ["timedatectl", "show", "-p", "NTP", "--value"],
            capture_output=True, text=True, timeout=5
        )
        return result.stdout.strip().lower() == "yes"
    except Exception:
        return False


def set_brightness(value):
    try:
        path = "/sys/class/backlight/rpi_backlight/brightness"
        if os.path.exists(path):
            scaled = int((int(value) / 100) * 255)
            subprocess.run(
                ["sudo", "tee", path],
                input=str(scaled), text=True, capture_output=True, timeout=5
            )
            return True
        subprocess.run(
            ["xrandr", "--output", "HDMI-1", "--brightness", str(int(value) / 100)],
            capture_output=True, timeout=5
        )
        return True
    except Exception:
        return False


def parse_iwlist(output):
    networks = []
    current = None
    for line in output.split("\n"):
        line = line.strip()
        if line.startswith("Cell "):
            if current:
                networks.append(current)
            current = {"ssid": "", "quality": 0, "encrypted": False}
        elif line.startswith("ESSID:") and current is not None:
            ssid = line.split(":", 1)[1].strip().strip('"')
            current["ssid"] = ssid
        elif line.startswith("Quality=") and current is not None:
            try:
                q = line.split("=")[1].split(" ")[0]
                num, den = q.split("/")
                current["quality"] = int((int(num) / int(den)) * 100)
            except (ValueError, IndexError):
                pass
        elif line.startswith("Encryption key:") and current is not None:
            current["encrypted"] = "on" in line
    if current:
        networks.append(current)
    seen = set()
    unique = []
    for n in networks:
        if n["ssid"] and n["ssid"] not in seen:
            seen.add(n["ssid"])
            unique.append(n)
    unique.sort(key=lambda x: x["quality"], reverse=True)
    return unique


@socketio.on('connect')
def on_connect():
    emit('connected', {"status": "ok"})


if __name__ == '__main__':
    config = load_config()
    apply_osc_config(config["osc"])
    socketio.start_background_task(timer_loop)
    socketio.run(app, host='0.0.0.0', port=5000, debug=False, allow_unsafe_werkzeug=True)
