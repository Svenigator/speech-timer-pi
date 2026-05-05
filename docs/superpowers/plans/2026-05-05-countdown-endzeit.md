# Countdown-Endzeit-Anzeige Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Zeige die voraussichtliche Endzeit eines laufenden Countdowns auf dem Stream Deck (untere Zeile von timer_display) und im Web-Control (unter der Timer-Vorschau), beide mit Blinken bei warning2/overtime.

**Architecture:** Das Feld `end_time` wird zentral in `compute_update()` berechnet und via WebSocket + REST an alle Clients geliefert. Der Stream Deck Controller implementiert Blinken zeitgesteuert im Run-Loop. Die Web-UI wendet CSS-Animationen via JS an.

**Tech Stack:** Python 3 / Flask / Flask-SocketIO, Pillow (Stream Deck Rendering), Vanilla JS, CSS Animations

---

## File Map

| Datei | Änderungen |
|---|---|
| `pi-app/app.py` | `compute_update()`: `end_time` berechnen; `api_get_display()`: blink settings hinzufügen |
| `pi-app/streamdeck_controller.py` | `TimerAPI.get_display()`; `StreamDeckController.__init__()`: blink state; `run_loop()`: blink toggle + display config poll; `update_all_keys()`: blink blank; `render_timer()`: END-Label |
| `pi-app/templates/control.html` | `#timer-preview` in `.timer-main` wrappen; `#end-time-display` hinzufügen; `window.initialBlink` |
| `pi-app/static/css/control.css` | `.timer-main`, `.end-time-hint`, `@keyframes blink/blink-fast`, Blink-Regeln |
| `pi-app/static/js/control.js` | `blinkOnWarning/Overtime` state; end_time anzeigen; blink auf `#timer-preview` + `#end-time-display` |

---

## Task 1: Backend — end_time in compute_update()

**Files:**
- Modify: `pi-app/app.py`

> Kein Test-Framework vorhanden. Verifikation erfolgt via curl nach dem Start.

- [ ] **Schritt 1: timedelta-Import ergänzen**

In `pi-app/app.py`, Zeile 19, ändere die datetime-Import-Zeile:

```python
from datetime import datetime, timedelta
```

- [ ] **Schritt 2: end_time in compute_update() berechnen**

In `TimerController.compute_update()` (Zeile 204), füge `end_time` direkt vor dem `return`-Statement ein. Der vollständige return-Block sieht dann so aus:

```python
            if phase in ("normal", "warning1", "warning2", "paused"):
                end_dt = datetime.now() + timedelta(seconds=max(0, remaining))
                end_time = end_dt.strftime("%H:%M:%S")
            else:
                end_time = ""

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
                "end_time": end_time,
            }
```

- [ ] **Schritt 3: blink settings zu /api/display GET hinzufügen**

In `api_get_display()` (Zeile 500), ersetze den gesamten Handler:

```python
@app.route('/api/display', methods=['GET'])
def api_get_display():
    config = load_config()
    result = dict(config["display"])
    result["blink_on_warning"] = config["system"].get("blink_on_warning", True)
    result["blink_on_overtime"] = config["system"].get("blink_on_overtime", True)
    return jsonify(result)
```

- [ ] **Schritt 4: Manuell prüfen**

App starten und prüfen:

```bash
# Timer laden und starten, dann:
curl http://localhost:5000/api/timer/status | python3 -m json.tool | grep end_time
# Erwartet: "end_time": "HH:MM:SS" (Endzeit in der Zukunft)

curl http://localhost:5000/api/display | python3 -m json.tool | grep blink
# Erwartet: "blink_on_overtime": true, "blink_on_warning": true
```

- [ ] **Schritt 5: Commit**

```bash
git add pi-app/app.py
git commit -m "feat: end_time in timer status + blink config in /api/display"
```

---

## Task 2: Stream Deck — END HH:MM als untere Zeile

**Files:**
- Modify: `pi-app/streamdeck_controller.py`

- [ ] **Schritt 1: render_timer() anpassen**

In `ButtonRenderer.render_timer()` (Zeile 290), ersetze die gesamte Methode:

```python
    def render_timer(self, state):
        phase = state.get("phase", "idle")
        bg = get_phase_color(phase)
        end_time = state.get("end_time", "")

        def draw(d, img):
            w, h = img.size
            if phase in ("idle", "loaded"):
                text = format_time(state.get("duration", 0))
            elif phase == "stopped":
                text = "00:00"
            else:
                text = format_time(state.get("remaining", 0))

            font_size = FONT_LARGE_SIZE if len(text) <= 6 else FONT_MEDIUM_SIZE + 4
            self._draw_centered_text(
                d, text, (w // 2, h // 2 - 6),
                self._get_font(font_size), COLOR_TEXT
            )
            if end_time:
                bottom_label = "END " + end_time[:5]  # "HH:MM" aus "HH:MM:SS"
            else:
                bottom_label = {
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
                d, bottom_label, (w // 2, h - 16),
                self._get_font(FONT_SMALL_SIZE), COLOR_TEXT
            )

        return self._make_image(bg, draw)
```

- [ ] **Schritt 2: Commit**

```bash
git add pi-app/streamdeck_controller.py
git commit -m "feat: END HH:MM als untere Zeile auf timer_display wenn Timer läuft"
```

---

## Task 3: Stream Deck — Blinking

**Files:**
- Modify: `pi-app/streamdeck_controller.py`

- [ ] **Schritt 1: TimerAPI.get_display() hinzufügen**

In der `TimerAPI`-Klasse (nach `get_network()`, Zeile 577), neue Methode einfügen:

```python
    def get_display(self):
        return self._request("GET", "/api/display")
```

- [ ] **Schritt 2: Blink-State zu StreamDeckController.__init__() hinzufügen**

In `StreamDeckController.__init__()` (Zeile 610), die `__init__`-Methode um drei Attribute ergänzen. Der vollständige `__init__` sieht dann so aus:

```python
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
        self.display_config = {}
        self._blink_visible = True
        self._last_blink_toggle = 0.0
```

- [ ] **Schritt 3: run_loop() — display config poll + blink toggle**

In `StreamDeckController.run_loop()` (Zeile 733), ersetze die gesamte Methode:

```python
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
                display_cfg = self.api.get_display()
                if display_cfg is not None:
                    self.display_config = display_cfg
                last_meta = now

            # Blink-State berechnen
            phase = self.state.get("phase", "idle")
            blink_on_warning = self.display_config.get("blink_on_warning", True)
            blink_on_overtime = self.display_config.get("blink_on_overtime", True)

            if phase == "warning2" and blink_on_warning:
                blink_interval = 0.5
            elif phase == "overtime" and blink_on_overtime:
                blink_interval = 0.25
            else:
                blink_interval = None

            if blink_interval is None:
                self._blink_visible = True
            elif now - self._last_blink_toggle >= blink_interval:
                self._blink_visible = not self._blink_visible
                self._last_blink_toggle = now

            try:
                self.update_all_keys()
            except Exception as e:
                log.error(f"Stream Deck nicht mehr erreichbar: {e}")
                break
            time.sleep(0.1)
```

- [ ] **Schritt 4: update_all_keys() — blink blank für timer_display und timer_component**

In `StreamDeckController.update_all_keys()` (Zeile 685), ersetze nur die beiden if-Zweige für `timer_display` und `timer_component`:

```python
                if kind == "timer_display":
                    if not self._blink_visible:
                        img = self.renderer.render_blank()
                    else:
                        img = self.renderer.render_timer(self.state)
                elif kind == "timer_component":
                    if not self._blink_visible:
                        img = self.renderer.render_blank()
                    else:
                        img = self.renderer.render_timer_component(
                            self.state, config.get("component", "seconds")
                        )
```

- [ ] **Schritt 5: Commit**

```bash
git add pi-app/streamdeck_controller.py
git commit -m "feat: Stream Deck blinkt bei warning2/overtime (timer_display + timer_component)"
```

---

## Task 4: Web — HTML + CSS

**Files:**
- Modify: `pi-app/templates/control.html`
- Modify: `pi-app/static/css/control.css`

- [ ] **Schritt 1: control.html — timer-preview wrappen + end-time-display + initialBlink**

In `pi-app/templates/control.html`, ersetze den gesamten `<section class="card status-card">` Block:

```html
        <!-- Status-Karte -->
        <section class="card status-card">
            <div class="timer-main">
                <div class="timer-preview" id="timer-preview">00:00</div>
                <div id="end-time-display" class="end-time-hint" style="display:none">Ende: <span id="end-time-value"></span></div>
            </div>
            <div class="status-info">
                <div><strong>Vorlage:</strong> <span id="current-preset">—</span></div>
                <div><strong>Status:</strong> <span id="current-status">Bereit</span></div>
            </div>
        </section>
```

Und ergänze im `<script>`-Block vor `control.js` die blink-Initialwerte:

```html
    <script>
        window.initialPresets = {{ config.presets | tojson }};
        window.initialMode = {{ config.display.mode | tojson }};
        window.initialBlink = {
            blink_on_warning: {{ config.system.blink_on_warning | tojson }},
            blink_on_overtime: {{ config.system.blink_on_overtime | tojson }}
        };
    </script>
```

- [ ] **Schritt 2: control.css — timer-main, end-time-hint, @keyframes, blink-Regeln**

Ersetze in `pi-app/static/css/control.css` den `.timer-preview`-Block (Zeile 118–127) durch:

```css
.timer-main {
    display: flex;
    flex-direction: column;
    align-items: center;
    min-width: 180px;
    text-align: center;
}

.timer-preview {
    font-size: 3.5rem;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
    color: var(--color-text);
    transition: color 0.2s ease;
}

.end-time-hint {
    font-size: 0.9rem;
    color: var(--color-secondary);
    font-variant-numeric: tabular-nums;
    margin-top: 0.25rem;
}
```

Und am Ende der Datei (vor dem `@media`-Block) einfügen:

```css
/* Blink-Animationen (analog zu display.css) */
@keyframes blink {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.3; }
}

@keyframes blink-fast {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.2; }
}

.timer-preview.blinking,
.end-time-hint.blinking {
    animation: blink 1s ease-in-out infinite;
}

.timer-preview.blinking-fast,
.end-time-hint.blinking-fast {
    animation: blink-fast 0.4s ease-in-out infinite;
}
```

- [ ] **Schritt 3: Commit**

```bash
git add pi-app/templates/control.html pi-app/static/css/control.css
git commit -m "feat: end-time-display Element + Blink-CSS in control-Seite"
```

---

## Task 5: Web — JavaScript

**Files:**
- Modify: `pi-app/static/js/control.js`

- [ ] **Schritt 1: blinkOnWarning/Overtime state initialisieren**

In `control.js`, direkt nach den bestehenden `let`-Deklarationen (Zeile 18–23), einfügen:

```js
    let blinkOnWarning = (window.initialBlink || {}).blink_on_warning !== false;
    let blinkOnOvertime = (window.initialBlink || {}).blink_on_overtime !== false;
```

- [ ] **Schritt 2: end_time anzeigen + blink anwenden im timer_update Handler**

Im `timer_update`-Handler (Zeile 205), direkt vor der abschließenden `updateButtons()`-Zeile einfügen:

```js
        // Endzeit anzeigen
        const endDisplay = document.getElementById('end-time-display');
        const endValue = document.getElementById('end-time-value');
        if (data.end_time) {
            endValue.textContent = data.end_time;
            endDisplay.style.display = '';
        } else {
            endDisplay.style.display = 'none';
        }

        // Blinken auf timer-preview und end-time-display
        timerPreview.classList.remove('blinking', 'blinking-fast');
        endDisplay.classList.remove('blinking', 'blinking-fast');
        if (data.phase === 'warning2' && blinkOnWarning) {
            timerPreview.classList.add('blinking');
            endDisplay.classList.add('blinking');
        } else if (data.phase === 'overtime' && blinkOnOvertime) {
            timerPreview.classList.add('blinking-fast');
            endDisplay.classList.add('blinking-fast');
        }
```

- [ ] **Schritt 3: display_config_update Handler — blink state aktualisieren**

Den bestehenden `display_config_update`-Handler (Zeile 257) ersetzen:

```js
    socket.on('display_config_update', function(cfg) {
        if (cfg.mode && cfg.mode !== currentMode) {
            currentMode = cfg.mode;
            updateModeButton();
        }
        if (typeof cfg.blink_on_warning === 'boolean') blinkOnWarning = cfg.blink_on_warning;
        if (typeof cfg.blink_on_overtime === 'boolean') blinkOnOvertime = cfg.blink_on_overtime;
    });
```

- [ ] **Schritt 4: Manuell testen**

1. App starten: `cd pi-app && python3 app.py`
2. Browser öffnen: `http://localhost:5000/control`
3. Ein Preset laden → Timer-Vorschau zeigt Gesamtdauer, keine Endzeit
4. Timer starten → Unterhalb der Vorschau erscheint „Ende: HH:MM:SS"
5. Timer pausieren → Endzeit bleibt sichtbar
6. Timer stoppen → Endzeit verschwindet
7. Testweise `warning2`-Phase herbeiführen (kurze Dauer einstellen, fast abgelaufen) → Vorschau + Endzeit blinken langsam
8. `overtime` → blinken schnell

- [ ] **Schritt 5: Commit**

```bash
git add pi-app/static/js/control.js
git commit -m "feat: Endzeit + Blinken im Web-Control (control.js)"
```

---

## Task 6: GitHub Issue schliessen

- [ ] **Issue #2 schliessen**

```bash
gh issue close 2 --comment "Implemented: end time shown on Stream Deck (timer_display bottom label) and web control (below timer preview), with blinking in sync with warning2/overtime phases."
```
