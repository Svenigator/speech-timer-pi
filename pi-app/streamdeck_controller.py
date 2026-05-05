#!/usr/bin/env python3
"""
Stream Deck Controller für den Speech Timer Pi.

Verbindet ein USB-angeschlossenes Elgato Stream Deck (XL, MK.2, Mini, +,
Neo, Pedal) direkt mit der lokalen Speech-Timer-App via HTTP.

Funktionen:
- Auto-Detection des Stream-Deck-Modells beim Start
- Modell-spezifisches Default-Layout (Tastenanzahl-bewusst)
- Live-Anzeige der Restzeit mit Phasen-Farbe
- Status-Anzeige (Phase, Preset-Name)
- Preset-Slots zum Direkt-Laden
- Steuer-Tasten: Start, Pause, Stop, Reset, Mode-Toggle, Adjust
- Hot-Plug: USB neu einstecken funktioniert ohne Service-Restart
- Layouts pro Modell in /home/pi/speech-timer-pi/streamdeck.json überschreibbar
"""

import json
import logging
import signal
import sys
import threading
import time
from pathlib import Path

import requests
from PIL import ImageDraw, ImageFont
from StreamDeck.DeviceManager import DeviceManager
from StreamDeck.ImageHelpers import PILHelper

# ============================================================
# Konfiguration
# ============================================================
BASE_DIR = Path(__file__).parent.resolve()
CONFIG_FILE = BASE_DIR / "streamdeck.json"
API_BASE = "http://localhost:5000"

STATUS_POLL_HZ = 4
RECONNECT_SECONDS = 5

FONT_REGULAR = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
FONT_LARGE_SIZE = 32
FONT_MEDIUM_SIZE = 18
FONT_SMALL_SIZE = 12

COLOR_BG = (10, 10, 10)
COLOR_TEXT = (255, 255, 255)
COLOR_NORMAL = (40, 100, 60)
COLOR_WARNING1 = (200, 140, 0)
COLOR_WARNING2 = (200, 30, 30)
COLOR_OVERTIME = (255, 0, 0)
COLOR_PAUSED = (60, 80, 180)
COLOR_STOPPED = (80, 80, 80)
COLOR_IDLE = (40, 40, 60)
COLOR_ACCENT = (0, 120, 200)
COLOR_DANGER = (180, 30, 30)
COLOR_SECONDARY = (60, 60, 100)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
)
log = logging.getLogger("streamdeck")


# ============================================================
# Default-Layouts pro Modell
# Tastenanzahl ist der Schlüssel. So funktioniert auch ein neues Modell,
# das wir noch nicht namentlich kennen, solange die Tastenanzahl bekannt ist.
# ============================================================

# 6 Tasten = Stream Deck Mini (3 Spalten × 2 Reihen)
LAYOUT_6_KEYS = {
    "0": {"type": "timer_display"},
    "1": {"type": "action", "action": "start", "label": "START", "color": COLOR_NORMAL},
    "2": {"type": "action", "action": "pause", "label": "PAUSE", "color": COLOR_PAUSED},
    "3": {"type": "preset_slot", "preset_id": 1},
    "4": {"type": "preset_slot", "preset_id": 2},
    "5": {"type": "action", "action": "reset", "label": "RESET", "color": COLOR_BG},
}

# 8 Tasten = Stream Deck Neo / Pedal (selten, aber abgedeckt)
LAYOUT_8_KEYS = {
    "0": {"type": "timer_display"},
    "1": {"type": "preset_name_display"},
    "2": {"type": "action", "action": "start", "label": "START", "color": COLOR_NORMAL},
    "3": {"type": "action", "action": "pause", "label": "PAUSE", "color": COLOR_PAUSED},
    "4": {"type": "preset_slot", "preset_id": 1},
    "5": {"type": "preset_slot", "preset_id": 2},
    "6": {"type": "action", "action": "stop",  "label": "STOP",  "color": COLOR_STOPPED},
    "7": {"type": "action", "action": "reset", "label": "RESET", "color": COLOR_BG},
}

# 15 Tasten = Stream Deck MK.2 / Standard (5 Spalten × 3 Reihen)
LAYOUT_15_KEYS = {
    # Reihe 0
    "0":  {"type": "timer_display"},
    "1":  {"type": "timer_display"},
    "2":  {"type": "preset_name_display"},
    "3":  {"type": "action", "action": "start", "label": "START", "color": COLOR_NORMAL},
    "4":  {"type": "action", "action": "pause", "label": "PAUSE", "color": COLOR_PAUSED},
    # Reihe 1: Presets
    "5":  {"type": "preset_slot", "preset_id": 1},
    "6":  {"type": "preset_slot", "preset_id": 2},
    "7":  {"type": "preset_slot", "preset_id": 3},
    "8":  {"type": "preset_slot", "preset_id": 4},
    "9":  {"type": "action", "action": "stop",  "label": "STOP",  "color": COLOR_STOPPED},
    # Reihe 2: Adjust + System
    "10": {"type": "action", "action": "adjust_-60", "label": "-1 MIN", "color": COLOR_SECONDARY},
    "11": {"type": "action", "action": "adjust_+60", "label": "+1 MIN", "color": COLOR_NORMAL},
    "12": {"type": "action", "action": "reset",       "label": "RESET", "color": COLOR_BG},
    "13": {"type": "action", "action": "mode_toggle", "label": "MODE", "color": COLOR_ACCENT},
    "14": {"type": "info_hostname"},
}

# 32 Tasten = Stream Deck XL (8 Spalten × 4 Reihen)
LAYOUT_32_KEYS = {
    # Reihe 0: Timer-Komponenten + Hauptsteuerung
    "0": {"type": "timer_component", "component": "hours"},
    "1": {"type": "timer_component", "component": "minutes"},
    "2": {"type": "timer_component", "component": "seconds"},
    "3": {"type": "preset_name_display"},
    "4": {"type": "action", "action": "start", "label": "START", "color": COLOR_NORMAL},
    "5": {"type": "action", "action": "pause", "label": "PAUSE", "color": COLOR_PAUSED},
    "6": {"type": "action", "action": "stop",  "label": "STOP",  "color": COLOR_STOPPED},
    "7": {"type": "action", "action": "reset", "label": "RESET", "color": COLOR_BG},
    # Reihe 1: Presets 1-8
    "8":  {"type": "preset_slot", "preset_id": 1},
    "9":  {"type": "preset_slot", "preset_id": 2},
    "10": {"type": "preset_slot", "preset_id": 3},
    "11": {"type": "preset_slot", "preset_id": 4},
    "12": {"type": "preset_slot", "preset_id": 5},
    "13": {"type": "preset_slot", "preset_id": 6},
    "14": {"type": "preset_slot", "preset_id": 7},
    "15": {"type": "preset_slot", "preset_id": 8},
    # Reihe 2: Presets 9-16
    "16": {"type": "preset_slot", "preset_id": 9},
    "17": {"type": "preset_slot", "preset_id": 10},
    "18": {"type": "preset_slot", "preset_id": 11},
    "19": {"type": "preset_slot", "preset_id": 12},
    "20": {"type": "preset_slot", "preset_id": 13},
    "21": {"type": "preset_slot", "preset_id": 14},
    "22": {"type": "preset_slot", "preset_id": 15},
    "23": {"type": "preset_slot", "preset_id": 16},
    # Reihe 3: Adjust + System + Info
    "24": {"type": "action", "action": "adjust_-300", "label": "-5 MIN", "color": COLOR_SECONDARY},
    "25": {"type": "action", "action": "adjust_-60",  "label": "-1 MIN", "color": COLOR_SECONDARY},
    "26": {"type": "action", "action": "adjust_+60",  "label": "+1 MIN", "color": COLOR_NORMAL},
    "27": {"type": "action", "action": "adjust_+300", "label": "+5 MIN", "color": COLOR_NORMAL},
    "28": {"type": "action", "action": "mode_toggle", "label": "MODE", "color": COLOR_ACCENT},
    "29": {"type": "info_hostname"},
    "30": {"type": "info_ip_eth0"},
    "31": {"type": "info_ip_wlan0"},
}

# Mapping: Tastenanzahl -> Default-Layout
DEFAULT_LAYOUTS = {
    6:  ("Stream Deck Mini",   LAYOUT_6_KEYS),
    8:  ("Stream Deck Neo",    LAYOUT_8_KEYS),
    15: ("Stream Deck MK.2",   LAYOUT_15_KEYS),
    32: ("Stream Deck XL",     LAYOUT_32_KEYS),
}


# ============================================================
# Helpers
# ============================================================
def format_time(seconds):
    sign = "-" if seconds < 0 else ""
    s = int(abs(seconds))
    h = s // 3600
    m = (s % 3600) // 60
    sec = s % 60
    if h > 0:
        return f"{sign}{h}:{m:02d}:{sec:02d}"
    return f"{sign}{m:02d}:{sec:02d}"


def get_phase_color(phase):
    return {
        "normal": COLOR_NORMAL,
        "warning1": COLOR_WARNING1,
        "warning2": COLOR_WARNING2,
        "overtime": COLOR_OVERTIME,
        "paused": COLOR_PAUSED,
        "stopped": COLOR_STOPPED,
        "idle": COLOR_IDLE,
        "loaded": COLOR_ACCENT,
    }.get(phase, COLOR_BG)


def load_config():
    """Lädt streamdeck.json oder None wenn die Datei fehlt/kaputt ist."""
    if not CONFIG_FILE.exists():
        return None
    try:
        with open(CONFIG_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    except (json.JSONDecodeError, IOError) as e:
        log.error(f"Konnte {CONFIG_FILE} nicht lesen: {e}")
        return None


def save_config(config):
    with open(CONFIG_FILE, "w", encoding="utf-8") as f:
        json.dump(config, f, indent=2, ensure_ascii=False)


def get_layout_for(num_keys, serial=None):
    """
    Sucht passendes Layout. Reihenfolge:
    1. Serial-spezifisches Layout aus streamdeck.json unter "layouts.<serial>"
    2. Custom-Layout nach Tastenanzahl unter "layouts.<N>"
    3. Default-Layout aus DEFAULT_LAYOUTS (wird in streamdeck.json persistiert)
    4. Leeres Layout wenn nichts passt
    """
    config = load_config() or {}
    layouts = config.get("layouts", {})

    # 1. Serial-spezifisches Layout?
    if serial and serial in layouts:
        log.info(f"Serial-Layout für {serial} geladen")
        return layouts[serial]

    # 2. Direkter Treffer nach Tastenanzahl?
    custom = layouts.get(str(num_keys))
    if custom and isinstance(custom, dict):
        log.info(f"Custom-Layout für {num_keys} Tasten geladen")
        return custom

    # 3. Default?
    default_entry = DEFAULT_LAYOUTS.get(num_keys)
    if default_entry:
        model_name, default_layout = default_entry
        log.info(f"Default-Layout für {model_name} ({num_keys} Tasten) wird benutzt")
        layouts[str(num_keys)] = default_layout
        config["layouts"] = layouts
        config.setdefault("_comment", (
            "Layouts pro Tastenanzahl oder Serial-Nummer. "
            "Serial hat Vorrang vor Tastenanzahl. "
            "Tastenpositionen sind 0-indexiert, von oben links nach unten rechts. "
            "Typen: timer_display, timer_component, preset_slot, action, "
            "preset_name_display, info_hostname, info_ip_eth0, info_ip_wlan0, blank."
        ))
        save_config(config)
        return default_layout

    log.warning(f"Kein Layout für {num_keys} Tasten - alle Tasten bleiben leer")
    return {}


# ============================================================
# Button-Renderer
# ============================================================
class ButtonRenderer:
    def __init__(self, deck):
        self.deck = deck
        self.image_format = deck.key_image_format()
        self.size = self.image_format["size"]
        self._font_cache = {}

    def _get_font(self, size):
        if size not in self._font_cache:
            try:
                self._font_cache[size] = ImageFont.truetype(FONT_REGULAR, size)
            except (OSError, IOError):
                self._font_cache[size] = ImageFont.load_default()
        return self._font_cache[size]

    def _draw_centered_text(self, draw, text, position, font, color):
        if not text:
            return
        bbox = draw.textbbox((0, 0), text, font=font)
        w = bbox[2] - bbox[0]
        h = bbox[3] - bbox[1]
        x = position[0] - w // 2
        y = position[1] - h // 2
        draw.text((x, y), text, font=font, fill=color)

    def _make_image(self, bg_color, render_fn):
        img = PILHelper.create_image(self.deck, background=bg_color)
        draw = ImageDraw.Draw(img)
        render_fn(draw, img)
        return PILHelper.to_native_format(self.deck, img)

    def render_blank(self):
        return self._make_image(COLOR_BG, lambda d, i: None)

    def render_timer(self, state):
        phase = state.get("phase", "idle")
        bg = get_phase_color(phase)

        def draw(d, img):
            w, h = img.size
            if phase in ("idle", "loaded"):
                text = format_time(state.get("duration", 0))
            elif phase == "stopped":
                text = "00:00"
            else:
                text = format_time(state.get("remaining", 0))

            # Font dynamisch verkleinern bei langen Strings (HH:MM:SS)
            font_size = FONT_LARGE_SIZE if len(text) <= 6 else FONT_MEDIUM_SIZE + 4
            self._draw_centered_text(
                d, text, (w // 2, h // 2 - 6),
                self._get_font(font_size), COLOR_TEXT
            )
            phase_label = {
                "normal": "RUNNING",
                "warning1": "WARN 1",
                "warning2": "WARN 2",
                "overtime": "OVER!",
                "paused": "PAUSED",
                "stopped": "STOPPED",
                "idle": "READY",
                "loaded": "LOADED",
            }.get(phase, phase.upper())
            self._draw_centered_text(
                d, phase_label, (w // 2, h - 16),
                self._get_font(FONT_SMALL_SIZE), COLOR_TEXT
            )

        return self._make_image(bg, draw)

    def render_timer_component(self, state, component):
        phase = state.get("phase", "idle")
        bg = get_phase_color(phase)

        if phase in ("idle", "loaded"):
            total = int(abs(state.get("duration", 0)))
        elif phase == "stopped":
            total = 0
        else:
            total = int(abs(state.get("remaining", 0)))

        h = total // 3600
        m = (total % 3600) // 60
        s = total % 60

        if component == "hours":
            value = str(h)
            label = "H"
        elif component == "minutes":
            value = f"{m:02d}"
            label = "MIN"
        else:
            value = f"{s:02d}"
            label = "S"

        def draw(d, img):
            w, h_ = img.size
            self._draw_centered_text(
                d, value, (w // 2, h_ // 2 - 8),
                self._get_font(FONT_LARGE_SIZE), COLOR_TEXT
            )
            self._draw_centered_text(
                d, label, (w // 2, h_ - 16),
                self._get_font(FONT_SMALL_SIZE), COLOR_TEXT
            )

        return self._make_image(bg, draw)

    def render_preset_name(self, state):
        phase = state.get("phase", "idle")
        bg = get_phase_color(phase) if phase != "idle" else COLOR_IDLE
        preset_name = state.get("preset_name") or "--"

        def draw(d, img):
            w, h = img.size
            self._draw_centered_text(
                d, "VORLAGE", (w // 2, 14),
                self._get_font(FONT_SMALL_SIZE), COLOR_TEXT
            )
            words = preset_name.split()

            # Schriftgröße dynamisch: bei langen Namen kleiner
            font_size = FONT_MEDIUM_SIZE
            if len(preset_name) > 15:
                font_size = FONT_SMALL_SIZE + 2

            font = self._get_font(font_size)

            if len(words) > 1:
                # Beste Zwei-Zeilen-Aufteilung suchen
                best_split = 1
                best_diff = 999
                for i in range(1, len(words)):
                    a = " ".join(words[:i])
                    b = " ".join(words[i:])
                    diff = abs(len(a) - len(b))
                    if diff < best_diff:
                        best_diff = diff
                        best_split = i
                line1 = " ".join(words[:best_split])
                line2 = " ".join(words[best_split:])
                self._draw_centered_text(d, line1, (w // 2, h // 2), font, COLOR_TEXT)
                self._draw_centered_text(d, line2, (w // 2, h // 2 + 22), font, COLOR_TEXT)
            else:
                short = preset_name
                if len(preset_name) > 13:
                    short = preset_name[:12] + "."
                self._draw_centered_text(d, short, (w // 2, h // 2 + 6),
                                          font, COLOR_TEXT)

        return self._make_image(bg, draw)

    def render_preset_slot(self, preset_id, presets, current_preset_name):
        preset = next((p for p in presets if p.get("id") == preset_id), None)
        if not preset:
            def draw(d, img):
                w, h = img.size
                self._draw_centered_text(
                    d, f"#{preset_id}", (w // 2, h // 2 - 8),
                    self._get_font(FONT_MEDIUM_SIZE), (80, 80, 80)
                )
                self._draw_centered_text(
                    d, "leer", (w // 2, h // 2 + 14),
                    self._get_font(FONT_SMALL_SIZE), (80, 80, 80)
                )
            return self._make_image((20, 20, 20), draw)

        is_active = preset.get("name") == current_preset_name
        bg = COLOR_ACCENT if is_active else (30, 60, 100)

        def draw(d, img):
            w, h = img.size
            # Slot-Nummer oben
            self._draw_centered_text(
                d, f"#{preset_id}", (w // 2, 11),
                self._get_font(FONT_SMALL_SIZE), (200, 200, 200)
            )

            # Preset-Name: aufteilen in zwei Zeilen falls nötig
            name = preset["name"]
            font_size = FONT_MEDIUM_SIZE
            line1, line2 = name, ""

            if len(name) > 8:
                # Versuche an Leerzeichen zu splitten
                words = name.split()
                if len(words) > 1:
                    # Aufteilen so dass beide Zeilen ähnlich lang
                    best_split = 1
                    best_diff = 999
                    for i in range(1, len(words)):
                        a = " ".join(words[:i])
                        b = " ".join(words[i:])
                        diff = abs(len(a) - len(b))
                        if diff < best_diff:
                            best_diff = diff
                            best_split = i
                    line1 = " ".join(words[:best_split])
                    line2 = " ".join(words[best_split:])
                    # Schriftgröße reduzieren wenn eine Zeile noch zu lang
                    if max(len(line1), len(line2)) > 10:
                        font_size = FONT_SMALL_SIZE + 2
                else:
                    # Ein einzelnes langes Wort - kürzen mit Punkt
                    if len(name) > 11:
                        line1 = name[:10] + "."
                    font_size = FONT_SMALL_SIZE + 2

            font = self._get_font(font_size)
            if line2:
                self._draw_centered_text(d, line1, (w // 2, h // 2 - 4), font, COLOR_TEXT)
                self._draw_centered_text(d, line2, (w // 2, h // 2 + 16), font, COLOR_TEXT)
            else:
                self._draw_centered_text(d, line1, (w // 2, h // 2 + 4), font, COLOR_TEXT)

            # Dauer unten
            duration_str = format_time(preset.get("duration", 0))
            self._draw_centered_text(
                d, duration_str, (w // 2, h - 14),
                self._get_font(FONT_SMALL_SIZE), (210, 210, 210)
            )

        return self._make_image(bg, draw)

    def render_action(self, label, color):
        # Tuples aus JSON kommen als Listen zurück - PIL braucht Tuple
        if isinstance(color, list):
            color = tuple(color)

        def draw(d, img):
            w, h = img.size
            font = self._get_font(FONT_MEDIUM_SIZE)
            lines = label.split("\n") if "\n" in label else [label]
            line_height = 22
            total_h = len(lines) * line_height
            start_y = (h - total_h) // 2 + line_height // 2
            for i, line in enumerate(lines):
                self._draw_centered_text(
                    d, line, (w // 2, start_y + i * line_height),
                    font, COLOR_TEXT
                )

        return self._make_image(color, draw)

    def render_info(self, label, value):
        def draw(d, img):
            w, h = img.size
            # Label oben
            self._draw_centered_text(
                d, label, (w // 2, 14),
                self._get_font(FONT_SMALL_SIZE), (180, 180, 180)
            )
            if not value:
                self._draw_centered_text(
                    d, "--", (w // 2, h // 2 + 4),
                    self._get_font(FONT_MEDIUM_SIZE), (120, 120, 120)
                )
                return

            # IP-Adressen erkennen (drei Punkte = IPv4)
            if value.count(".") == 3:
                parts = value.split(".")
                # Immer zweizeilig: x.y. / z.w
                line1 = f"{parts[0]}.{parts[1]}."
                line2 = f"{parts[2]}.{parts[3]}"
                self._draw_centered_text(
                    d, line1, (w // 2, h // 2 - 4),
                    self._get_font(FONT_SMALL_SIZE + 2), COLOR_TEXT
                )
                self._draw_centered_text(
                    d, line2, (w // 2, h // 2 + 16),
                    self._get_font(FONT_SMALL_SIZE + 2), COLOR_TEXT
                )
                return

            # Hostname oder anderes - mit dynamischer Schriftgrößen-Anpassung
            font_size = FONT_MEDIUM_SIZE
            display_value = value
            if len(display_value) > 12:
                font_size = FONT_SMALL_SIZE + 2
            if len(display_value) > 16:
                display_value = display_value[:15] + "."
            self._draw_centered_text(
                d, display_value, (w // 2, h // 2 + 6),
                self._get_font(font_size), COLOR_TEXT
            )

        return self._make_image((40, 40, 50), draw)


# ============================================================
# API-Klient
# ============================================================
class TimerAPI:
    def __init__(self, base=API_BASE, timeout=2):
        self.base = base
        self.timeout = timeout
        self._session = requests.Session()

    def _request(self, method, path, **kwargs):
        try:
            r = self._session.request(method, self.base + path,
                                       timeout=self.timeout, **kwargs)
            if r.status_code == 200:
                try:
                    return r.json()
                except ValueError:
                    return {}
            log.warning(f"{method} {path} → HTTP {r.status_code}")
        except requests.exceptions.RequestException as e:
            log.debug(f"{method} {path} → {e}")
        return None

    def get_status(self):
        return self._request("GET", "/api/timer/status")

    def get_presets(self):
        return self._request("GET", "/api/presets")

    def get_network(self):
        return self._request("GET", "/api/network/status")

    def start(self):
        return self._request("POST", "/api/timer/start")

    def pause(self):
        return self._request("POST", "/api/timer/pause")

    def stop(self):
        return self._request("POST", "/api/timer/stop")

    def reset(self):
        return self._request("POST", "/api/timer/reset")

    def adjust(self, seconds):
        return self._request("POST", "/api/timer/adjust",
                              json={"seconds": int(seconds)})

    def load_preset(self, preset):
        return self._request("POST", "/api/timer/load", json={
            "duration": preset["duration"],
            "warning1": preset.get("warning1", 60),
            "warning2": preset.get("warning2", 30),
            "preset_name": preset["name"],
        })

    def display_mode_toggle(self):
        return self._request("POST", "/api/display/mode/toggle")


# ============================================================
# Stream Deck Manager
# ============================================================
class StreamDeckController:
    def __init__(self, deck, layout, api):
        self.deck = deck
        self.layout = layout
        self.api = api
        self.renderer = ButtonRenderer(deck)
        self.lock = threading.Lock()
        self._last_render = {}
        self._stop = False
        self.state = {}
        self.presets = []
        self.network = {}

    def open(self):
        # Deck wird bereits offen übergeben — nur initialisieren
        self.deck.reset()
        self.deck.set_brightness(70)
        self.deck.set_key_callback(self.on_key)
        log.info(f"Stream Deck geöffnet: {self.deck.deck_type()} mit "
                 f"{self.deck.key_count()} Tasten")

    def close(self):
        try:
            self.deck.reset()
            self.deck.close()
        except Exception:
            pass

    def on_key(self, deck, key, pressed):
        if not pressed:
            return
        config = self.layout.get(str(key))
        if not config:
            return

        kind = config.get("type")
        log.info(f"Key {key} pressed ({kind})")

        try:
            if kind == "action":
                self._handle_action(config.get("action", ""))
            elif kind == "preset_slot":
                preset_id = config.get("preset_id")
                preset = next((p for p in self.presets if p.get("id") == preset_id), None)
                if preset:
                    self.api.load_preset(preset)
                else:
                    log.warning(f"Preset #{preset_id} existiert nicht")
        except Exception as e:
            log.error(f"Fehler beim Verarbeiten von Key {key}: {e}")

    def _handle_action(self, action):
        if action == "start":
            self.api.start()
        elif action == "pause":
            self.api.pause()
        elif action == "stop":
            self.api.stop()
        elif action == "reset":
            self.api.reset()
        elif action == "mode_toggle":
            self.api.display_mode_toggle()
        elif action.startswith("adjust_"):
            try:
                secs = int(action.replace("adjust_", ""))
                self.api.adjust(secs)
            except ValueError:
                log.error(f"Ungültige adjust-Action: {action}")

    def _render_key(self, key, image):
        if self._last_render.get(key) is image:
            return
        with self.lock:
            self.deck.set_key_image(key, image)
            self._last_render[key] = image

    def update_all_keys(self):
        for key in range(self.deck.key_count()):
            config = self.layout.get(str(key), {"type": "blank"})
            kind = config.get("type")
            try:
                if kind == "timer_display":
                    img = self.renderer.render_timer(self.state)
                elif kind == "timer_component":
                    img = self.renderer.render_timer_component(
                        self.state, config.get("component", "seconds")
                    )
                elif kind == "preset_name_display":
                    img = self.renderer.render_preset_name(self.state)
                elif kind == "preset_slot":
                    img = self.renderer.render_preset_slot(
                        config.get("preset_id"),
                        self.presets,
                        self.state.get("preset_name", "")
                    )
                elif kind == "action":
                    img = self.renderer.render_action(
                        config.get("label", ""),
                        config.get("color", COLOR_BG)
                    )
                elif kind == "info_hostname":
                    img = self.renderer.render_info("HOST",
                                                     self.network.get("hostname", ""))
                elif kind == "info_ip_eth0":
                    img = self.renderer.render_info("LAN",
                                                     self._find_ip("eth0", "ethernet"))
                elif kind == "info_ip_wlan0":
                    img = self.renderer.render_info("WLAN",
                                                     self._find_ip("wlan0", "wifi"))
                else:
                    img = self.renderer.render_blank()
            except Exception as e:
                log.error(f"Render-Fehler Key {key}: {e}")
                continue
            self._render_key(key, img)  # USB-Fehler propagieren nach oben

    def _find_ip(self, name, type_):
        for iface in self.network.get("interfaces", []):
            if iface.get("name") == name or iface.get("type") == type_:
                ipv4 = iface.get("ipv4") or []
                if ipv4:
                    return ipv4[0]
        return ""

    def run_loop(self, stop_event=None):
        last_status = 0
        last_meta = 0
        period_status = 1.0 / STATUS_POLL_HZ
        period_meta = 5.0

        while not self._stop and (stop_event is None or not stop_event.is_set()):
            now = time.time()

            if now - last_status >= period_status:
                status = self.api.get_status()
                if status is not None:
                    self.state = status
                last_status = now

            if now - last_meta >= period_meta:
                presets = self.api.get_presets()
                if presets is not None:
                    self.presets = presets
                network = self.api.get_network()
                if network is not None:
                    self.network = network
                last_meta = now

            try:
                self.update_all_keys()
            except Exception as e:
                log.error(f"Stream Deck nicht mehr erreichbar: {e}")
                break
            time.sleep(0.1)

    def stop(self):
        self._stop = True


# ============================================================
# Multi-Deck Main
# ============================================================
_active_threads: dict[str, threading.Thread] = {}
_active_lock = threading.Lock()


def run_deck_thread(deck, serial, stop_event, api):
    """Verwaltet ein einzelnes bereits geöffnetes Stream Deck bis zur Trennung."""
    log.info(f"Deck {serial} ({deck.deck_type()}) wird verwaltet")
    try:
        num_keys = deck.key_count()
        layout = get_layout_for(num_keys, serial)
        if not layout:
            log.error(f"Kein Layout für Deck {serial} ({num_keys} Tasten) — "
                      f"streamdeck.json manuell konfigurieren")
            return

        controller = StreamDeckController(deck, layout, api)
        controller.open()
        try:
            controller.run_loop(stop_event)
        finally:
            controller.close()
    except Exception as e:
        log.error(f"Fehler bei Deck {serial}: {e}", exc_info=True)
        try:
            deck.close()
        except Exception:
            pass

    log.info(f"Deck {serial} getrennt")
    with _active_lock:
        _active_threads.pop(serial, None)


def main():
    log.info("Stream Deck Controller startet...")
    api = TimerAPI()
    stop_event = threading.Event()

    def shutdown(signum, frame):
        log.info(f"Signal {signum} empfangen, fahre herunter...")
        stop_event.set()

    signal.signal(signal.SIGINT, shutdown)
    signal.signal(signal.SIGTERM, shutdown)

    while not stop_event.is_set():
        try:
            available = DeviceManager().enumerate()
        except Exception as e:
            log.error(f"Enumerierungs-Fehler: {e}")
            stop_event.wait(RECONNECT_SECONDS)
            continue

        if not available:
            log.info(f"Kein Stream Deck gefunden, warte {RECONNECT_SECONDS}s...")

        for deck in available:
            try:
                deck.open()
                serial = deck.get_serial_number()
            except Exception as e:
                log.debug(f"Deck konnte nicht geöffnet werden: {e}")
                try:
                    deck.close()
                except Exception:
                    pass
                continue

            with _active_lock:
                existing = _active_threads.get(serial)
                if existing and existing.is_alive():
                    # Bereits verwaltet — unser frisch geöffnetes Handle schließen
                    try:
                        deck.close()
                    except Exception:
                        pass
                    continue

                log.info(f"Neues Deck erkannt: {deck.deck_type()} "
                         f"({deck.key_count()} Tasten, Serial: {serial})")
                t = threading.Thread(
                    target=run_deck_thread,
                    args=(deck, serial, stop_event, api),
                    daemon=True,
                    name=f"deck-{serial}",
                )
                _active_threads[serial] = t
                t.start()

        stop_event.wait(RECONNECT_SECONDS)

    log.info("Stream Deck Controller beendet")


if __name__ == "__main__":
    sys.exit(main() or 0)
