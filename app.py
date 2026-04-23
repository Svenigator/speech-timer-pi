"""
OSC-Modul für den Speech Timer – v3

Änderungen gegenüber v2:
- /timer/preset lädt, startet nicht mehr
- /timer/start separater Befehl
- /timer/adjust mit Sekunden-Wert
- Neue Shortcuts: /timer/adjust/+1, /-1, /+5, /-5 (Minuten)
- /display/mode zum Umschalten zwischen Timer/Clock
- Kein Speaker-Feld mehr

Eingehend:
    /timer/load/preset <int>        Preset nach ID laden (kein Start)
    /timer/load/preset/name <str>   Preset nach Name laden (kein Start)
    /timer/load/duration <int>      Sekunden laden (kein Start)
    /timer/start                    Starten oder fortsetzen
    /timer/pause                    Pausieren / Fortsetzen (Toggle)
    /timer/stop                     Stoppen (00:00)
    /timer/reset                    Komplett zurücksetzen
    /timer/adjust <int>             Zeit um Sekunden anpassen
    /timer/adjust/+1                +1 Minute
    /timer/adjust/-1                -1 Minute
    /timer/adjust/+5                +5 Minuten
    /timer/adjust/-5                -5 Minuten
    /display/mode <str>             "timer" oder "clock"
    /display/mode/toggle            Toggle zwischen timer und clock

Ausgehend:
    /timer/state/running            int  1/0
    /timer/state/paused             int  1/0
    /timer/state/stopped            int  1/0
    /timer/state/phase              str  idle/loaded/normal/warning1/warning2/overtime/paused/stopped
    /timer/state/elapsed            int  Sekunden
    /timer/state/remaining          int  Sekunden (negativ = overtime)
    /timer/state/duration           int  Sekunden
    /timer/state/time/formatted     str  "MM:SS" oder "-MM:SS"
    /timer/state/preset             str  Preset-Name
    /timer/state/overtime           int  1/0
    /display/mode                   str  "timer"/"clock"
"""

import threading
import time
from pythonosc import dispatcher, osc_server, udp_client


class OSCManager:
    def __init__(self, timer_controller):
        self.controller = timer_controller
        self.server = None
        self.server_thread = None
        self.client_targets = []
        self.receive_port = 8000
        self.last_sent_state = {}

    # ============================================================
    # Server (empfangen)
    # ============================================================
    def _setup_dispatcher(self):
        disp = dispatcher.Dispatcher()

        # Load (kein automatischer Start)
        disp.map("/timer/load/preset", self._handle_load_preset_id)
        disp.map("/timer/load/preset/name", self._handle_load_preset_name)
        disp.map("/timer/load/duration", self._handle_load_duration)

        # Steuerung
        disp.map("/timer/start", self._handle_start)
        disp.map("/timer/pause", self._handle_pause)
        disp.map("/timer/stop", self._handle_stop)
        disp.map("/timer/reset", self._handle_reset)

        # Zeit-Anpassung
        disp.map("/timer/adjust", self._handle_adjust)
        disp.map("/timer/adjust/+1", lambda a: self.controller.adjust_time(60))
        disp.map("/timer/adjust/-1", lambda a: self.controller.adjust_time(-60))
        disp.map("/timer/adjust/+5", lambda a: self.controller.adjust_time(300))
        disp.map("/timer/adjust/-5", lambda a: self.controller.adjust_time(-300))

        # Display-Mode (muss von außen über Callback bei der App gesetzt werden)
        disp.map("/display/mode", self._handle_display_mode)
        disp.map("/display/mode/toggle", self._handle_display_mode_toggle)

        # Abwärtskompatibilität: alter /timer/preset Befehl lädt UND startet
        disp.map("/timer/preset", self._handle_load_preset_id_and_start)
        disp.map("/timer/preset/name", self._handle_load_preset_name_and_start)
        disp.map("/timer/duration", self._handle_load_duration_and_start)
        disp.map("/timer/speaker", lambda a, *args: None)  # ignoriert

        disp.set_default_handler(self._handle_default)
        return disp

    def start_server(self, port=None):
        if port:
            self.receive_port = port
        self.stop_server()
        disp = self._setup_dispatcher()
        try:
            self.server = osc_server.ThreadingOSCUDPServer(
                ("0.0.0.0", self.receive_port), disp
            )
            self.server_thread = threading.Thread(
                target=self.server.serve_forever, daemon=True
            )
            self.server_thread.start()
            print(f"[OSC] Server läuft auf Port {self.receive_port}")
            return True
        except OSError as e:
            print(f"[OSC] Server konnte nicht gestartet werden: {e}")
            self.server = None
            return False

    def stop_server(self):
        if self.server:
            try:
                self.server.shutdown()
                self.server.server_close()
            except Exception as e:
                print(f"[OSC] Fehler beim Stoppen: {e}")
            self.server = None
            self.server_thread = None

    # ============================================================
    # Client (senden)
    # ============================================================
    def set_targets(self, targets):
        self.client_targets = []
        for t in targets:
            if t.get("enabled", True) and t.get("ip"):
                try:
                    client = udp_client.SimpleUDPClient(t["ip"], int(t["port"]))
                    self.client_targets.append({
                        "ip": t["ip"],
                        "port": int(t["port"]),
                        "client": client,
                        "name": t.get("name", ""),
                    })
                except Exception as e:
                    print(f"[OSC] Konnte Client nicht anlegen ({t['ip']}:{t['port']}): {e}")

    def send(self, address, value):
        if not self.client_targets:
            return
        for target in self.client_targets:
            try:
                target["client"].send_message(address, value)
            except Exception as e:
                print(f"[OSC] Sendefehler an {target['ip']}:{target['port']}: {e}")

    def send_state(self, state):
        if not self.client_targets:
            return

        updates = {
            "/timer/state/running": 1 if state.get("running") else 0,
            "/timer/state/paused": 1 if state.get("paused") else 0,
            "/timer/state/stopped": 1 if state.get("stopped") else 0,
            "/timer/state/phase": state.get("phase", "idle"),
            "/timer/state/elapsed": int(state.get("elapsed", 0)),
            "/timer/state/remaining": int(state.get("remaining", 0)),
            "/timer/state/duration": int(state.get("duration", 0)),
            "/timer/state/time/formatted": self._format_time(state.get("remaining", 0)),
            "/timer/state/preset": state.get("preset_name", ""),
            "/timer/state/overtime": 1 if state.get("overtime") else 0,
        }

        for address, value in updates.items():
            if address in ("/timer/state/remaining",
                          "/timer/state/time/formatted",
                          "/timer/state/elapsed"):
                self.send(address, value)
            elif self.last_sent_state.get(address) != value:
                self.send(address, value)
                self.last_sent_state[address] = value

    @staticmethod
    def _format_time(seconds):
        try:
            s = int(seconds)
        except (TypeError, ValueError):
            return "00:00"
        sign = "-" if s < 0 else ""
        s = abs(s)
        hours = s // 3600
        minutes = (s % 3600) // 60
        secs = s % 60
        if hours > 0:
            return f"{sign}{hours}:{minutes:02d}:{secs:02d}"
        return f"{sign}{minutes:02d}:{secs:02d}"

    # ============================================================
    # Input-Handler
    # ============================================================
    def _handle_load_preset_id(self, address, *args):
        print(f"[OSC] {address} {args}")
        if not args:
            return
        try:
            preset_id = int(args[0])
        except (ValueError, TypeError):
            return
        presets = self.controller.get_presets()
        preset = next((p for p in presets if p["id"] == preset_id), None)
        if preset:
            self._load_preset(preset)
        else:
            print(f"[OSC] Preset ID {preset_id} nicht gefunden")

    def _handle_load_preset_name(self, address, *args):
        print(f"[OSC] {address} {args}")
        if not args:
            return
        name = str(args[0])
        presets = self.controller.get_presets()
        preset = next((p for p in presets if p["name"].lower() == name.lower()), None)
        if preset:
            self._load_preset(preset)
        else:
            print(f"[OSC] Preset '{name}' nicht gefunden")

    def _handle_load_duration(self, address, *args):
        print(f"[OSC] {address} {args}")
        if not args:
            return
        try:
            seconds = int(args[0])
        except (ValueError, TypeError):
            return
        w1 = max(30, seconds // 5)
        w2 = max(10, seconds // 20)
        self.controller.load({
            "duration": seconds,
            "warning1": w1,
            "warning2": w2,
            "preset_name": "OSC Manual",
        })

    # Abwärtskompatibel: /timer/preset lädt UND startet
    def _handle_load_preset_id_and_start(self, address, *args):
        self._handle_load_preset_id(address, *args)
        self.controller.start()

    def _handle_load_preset_name_and_start(self, address, *args):
        self._handle_load_preset_name(address, *args)
        self.controller.start()

    def _handle_load_duration_and_start(self, address, *args):
        self._handle_load_duration(address, *args)
        self.controller.start()

    def _handle_start(self, address, *args):
        print(f"[OSC] {address}")
        self.controller.start()

    def _handle_pause(self, address, *args):
        print(f"[OSC] {address}")
        self.controller.pause()

    def _handle_stop(self, address, *args):
        print(f"[OSC] {address}")
        self.controller.stop()

    def _handle_reset(self, address, *args):
        print(f"[OSC] {address}")
        self.controller.reset()

    def _handle_adjust(self, address, *args):
        print(f"[OSC] {address} {args}")
        if not args:
            return
        try:
            seconds = int(args[0])
        except (ValueError, TypeError):
            return
        self.controller.adjust_time(seconds)

    # Display-Mode: via Callback, das von app.py gesetzt wird
    display_mode_callback = None

    def _handle_display_mode(self, address, *args):
        print(f"[OSC] {address} {args}")
        if not args:
            return
        mode = str(args[0])
        if self.display_mode_callback:
            self.display_mode_callback(mode)

    def _handle_display_mode_toggle(self, address, *args):
        print(f"[OSC] {address}")
        if self.display_mode_callback:
            self.display_mode_callback("toggle")

    def _handle_default(self, address, *args):
        print(f"[OSC] Unbekannte Adresse: {address} {args}")

    def _load_preset(self, preset):
        self.controller.load({
            "duration": preset["duration"],
            "warning1": preset["warning1"],
            "warning2": preset["warning2"],
            "preset_name": preset["name"],
        })
