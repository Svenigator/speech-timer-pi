#!/usr/bin/env python3
"""
OSC-Manager für den Speech Timer.
- Empfängt OSC-Befehle (Start/Pause/Stop/Reset/Preset/…)
- Sendet Status-Updates an konfigurierte Ziele
- Wird von app.py genutzt, ist aber optional (läuft nur wenn in config aktiviert)
"""

import threading

try:
    from pythonosc import dispatcher, osc_server, udp_client
    OSC_AVAILABLE = True
except ImportError:
    OSC_AVAILABLE = False


class OSCManager:
    def __init__(self, timer_controller):
        self.timer = timer_controller
        self.server = None
        self.server_thread = None
        self.client_targets = []  # [{ip, port}]
        self.clients = []
        self.display_mode_callback = None

        # Letzter gesendeter Zustand, um Spam zu vermeiden
        self._last_sent = {}

    # ============================================================
    # Server (eingehend)
    # ============================================================
    def start_server(self, port=8000):
        if not OSC_AVAILABLE:
            return False
        if self.server is not None:
            self.stop_server()

        disp = dispatcher.Dispatcher()
        disp.map("/timer/start", self._on_start)
        disp.map("/timer/pause", self._on_pause)
        disp.map("/timer/stop", self._on_stop)
        disp.map("/timer/reset", self._on_reset)
        disp.map("/timer/preset", self._on_preset_id)
        disp.map("/timer/preset/name", self._on_preset_name)
        disp.map("/timer/duration", self._on_duration)
        disp.map("/timer/adjust", self._on_adjust)
        disp.map("/display/mode", self._on_display_mode)
        disp.map("/display/mode/toggle", self._on_display_mode_toggle)

        try:
            self.server = osc_server.ThreadingOSCUDPServer(("0.0.0.0", port), disp)
        except OSError as e:
            print(f"OSC server konnte nicht starten auf Port {port}: {e}")
            self.server = None
            return False

        self.server_thread = threading.Thread(target=self.server.serve_forever, daemon=True)
        self.server_thread.start()
        print(f"OSC server läuft auf Port {port}")
        return True

    def stop_server(self):
        if self.server is not None:
            try:
                self.server.shutdown()
                self.server.server_close()
            except Exception:
                pass
            self.server = None
            self.server_thread = None

    # ============================================================
    # Clients (ausgehend)
    # ============================================================
    def set_targets(self, targets):
        """targets: Liste von {ip, port}-Dicts."""
        self.client_targets = []
        self.clients = []
        if not OSC_AVAILABLE:
            return
        for t in targets:
            ip = t.get("ip", "").strip()
            try:
                port = int(t.get("port", 0))
            except (ValueError, TypeError):
                continue
            if not ip or port <= 0:
                continue
            try:
                client = udp_client.SimpleUDPClient(ip, port)
                self.clients.append(client)
                self.client_targets.append({"ip": ip, "port": port})
            except Exception as e:
                print(f"OSC-Client {ip}:{port} konnte nicht erstellt werden: {e}")

    def send(self, address, value=None):
        """Sendet an alle konfigurierten Ziele."""
        if not self.clients:
            return
        for client in self.clients:
            try:
                if value is None:
                    client.send_message(address, [])
                else:
                    client.send_message(address, value)
            except Exception as e:
                print(f"OSC send failed: {e}")

    def send_state(self, update):
        """Sendet den aktuellen Timer-Zustand an alle Ziele (wird von app.py alle 0.5s aufgerufen)."""
        if not self.clients:
            return

        # Nur senden, was sich geändert hat (weniger Netzwerk-Spam)
        def changed(key, value):
            if self._last_sent.get(key) != value:
                self._last_sent[key] = value
                return True
            return False

        if changed("running", update["running"]):
            self.send("/timer/state/running", 1 if update["running"] else 0)
        if changed("paused", update["paused"]):
            self.send("/timer/state/paused", 1 if update["paused"] else 0)
        if changed("phase", update["phase"]):
            self.send("/timer/state/phase", update["phase"])
        if changed("overtime", update["overtime"]):
            self.send("/timer/state/overtime", 1 if update["overtime"] else 0)
        if changed("preset_name", update["preset_name"]):
            self.send("/timer/state/preset", update["preset_name"])

        # Zeit-Infos: immer senden, da sie sich jede Sekunde ändern
        remaining = int(update["remaining"])
        elapsed = int(update["elapsed"])
        duration = int(update["duration"])
        self.send("/timer/state/remaining", remaining)
        self.send("/timer/state/elapsed", elapsed)
        self.send("/timer/state/duration", duration)
        self.send("/timer/state/time/formatted", self._format_time(remaining))

    def _format_time(self, seconds):
        sign = "-" if seconds < 0 else ""
        s = abs(seconds)
        h = s // 3600
        m = (s % 3600) // 60
        sec = s % 60
        if h > 0:
            return f"{sign}{h}:{m:02d}:{sec:02d}"
        return f"{sign}{m:02d}:{sec:02d}"

    # ============================================================
    # OSC-Handler (eingehend)
    # ============================================================
    def _on_start(self, *args):
        self.timer.start()

    def _on_pause(self, *args):
        self.timer.pause()

    def _on_stop(self, *args):
        self.timer.stop()

    def _on_reset(self, *args):
        self.timer.reset()

    def _on_preset_id(self, address, *args):
        if not args:
            return
        try:
            preset_id = int(args[0])
        except (ValueError, TypeError):
            return
        presets = self.timer.get_presets()
        preset = next((p for p in presets if p["id"] == preset_id), None)
        if preset:
            self.timer.load({
                "duration": preset["duration"],
                "warning1": preset["warning1"],
                "warning2": preset["warning2"],
                "preset_name": preset["name"],
            })
            self.timer.start()

    def _on_preset_name(self, address, *args):
        if not args:
            return
        name = str(args[0])
        presets = self.timer.get_presets()
        preset = next((p for p in presets if p["name"].lower() == name.lower()), None)
        if preset:
            self.timer.load({
                "duration": preset["duration"],
                "warning1": preset["warning1"],
                "warning2": preset["warning2"],
                "preset_name": preset["name"],
            })
            self.timer.start()

    def _on_duration(self, address, *args):
        if not args:
            return
        try:
            duration = int(args[0])
        except (ValueError, TypeError):
            return
        if duration <= 0:
            return
        self.timer.load({
            "duration": duration,
            "warning1": max(30, duration // 10),
            "warning2": max(10, duration // 30),
            "preset_name": "OSC",
        })
        self.timer.start()

    def _on_adjust(self, address, *args):
        if not args:
            return
        try:
            seconds = int(args[0])
        except (ValueError, TypeError):
            return
        self.timer.adjust_time(seconds)

    def _on_display_mode(self, address, *args):
        if not args:
            return
        mode = str(args[0])
        if self.display_mode_callback:
            self.display_mode_callback(mode)

    def _on_display_mode_toggle(self, *args):
        if self.display_mode_callback:
            self.display_mode_callback("toggle")
