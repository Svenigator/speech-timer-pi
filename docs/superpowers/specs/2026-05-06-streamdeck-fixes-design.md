# Spec: Stream Deck Fixes – 2026-05-06

## Scope

Vier unabhängige Korrekturen am Stream Deck Controller und Timer-Backend.

---

## Fix 1 – Vorzeichen bei Overtime in timer_component

**Problem:** `render_timer_component()` verwendet `abs(remaining)`, wodurch das Minuszeichen bei Overtime verloren geht. Betrifft nur das XL-Layout (32 Tasten), das H/MIN/S auf separate Buttons aufteilt.

**Lösung:** Wenn `remaining < 0` (Phase "overtime"), wird der führende nicht-null Component mit `-` prefixiert:
- Stunden > 0 → Hours-Button zeigt `-H`
- Stunden = 0, Minuten > 0 → Minutes-Button zeigt `-MM`
- Stunden = 0, Minuten = 0 → Seconds-Button zeigt `-SS`

Die anderen Components zeigen weiterhin ihren Wert ohne Prefix.

**Änderung:** Nur `render_timer_component()` in `streamdeck_controller.py`.

---

## Fix 2 – Hostname-Rendering passt sich der Button-Breite an

**Problem:** Schriftgröße wird per Zeichenanzahl-Schwellwert gewählt (>12 Zeichen → kleiner). Bei `DejaVuSans-Bold 18px` überschreitet schon "speechtimer" (11 Zeichen) die Button-Breite (~96px auf XL, ~72px auf MK.2).

**Lösung:** Auto-Sizing: Startgröße `FONT_MEDIUM_SIZE` (18px), dann per `draw.textbbox()` messen und Größe in 2px-Schritten reduzieren bis der Text in `image_width - 8px` Rand passt. Minimum: `FONT_SMALL_SIZE` (12px). Texte die selbst bei Minimum nicht passen werden auf 15 Zeichen + `.` gekürzt (wie bisher).

**Änderung:** Nur der Hostname-Rendering-Zweig in `render_info()` in `streamdeck_controller.py`.

---

## Fix 3 – Endzeit auf dem Vorlagen-Button (preset_name_display)

**Verhalten:**
- Läuft der Timer normal/warning1/warning2: Endzeit = `jetzt + remaining` (projizierte Uhrzeit, aktualisiert sich laufend, auch im Pause-Zustand)
- Overtime: Endzeit = Uhrzeit als `remaining` erstmals 0 unterschritt (fixer Zeitstempel)
- Stopped / Idle / Loaded: keine Endzeit

**Backend-Änderungen (`app.py`):**
- `TimerController.state` bekommt Feld `overtime_at: str | None` (HH:MM)
- `load()` und `reset()` setzen `overtime_at = None`
- In `compute_update()`: wenn `remaining < 0` und `overtime_at` noch nicht gesetzt → jetzt setzen: `overtime_at = (datetime.now() + timedelta(seconds=remaining)).strftime("%H:%M")` (rechnet zurück auf den Zeitpunkt remaining=0)
- `end_time` im API-Response:
  - Phase "overtime": → `overtime_at`
  - Phase "paused" mit `remaining < 0` (Pause im Overtime): → `overtime_at`
  - Phase "paused" mit `remaining >= 0`, "normal", "warning1", "warning2": → projizierte Uhrzeit `now + remaining`
  - Sonst (stopped/idle/loaded): → `""`

**Frontend-Änderung (`streamdeck_controller.py`):**
- `render_preset_name()`: wenn `state.get("end_time")` nicht leer → kleine Uhrzeit-Zeile am unteren Rand des Buttons (Format "HH:MM", gleicher Stil wie bestehende Label-Zeilen)

---

## Fix 4 – Reset auf Original-Vorlagezeit

**Problem:** `adjust_time()` ändert `duration` direkt. `reset()` setzt `elapsed = 0` und `start_time = None`, aber `duration` bleibt verändert – der Timer startet nach Reset mit der angepassten Zeit statt der Original-Vorlagezeit.

**Lösung:**
- `TimerController.state` bekommt Feld `original_duration: int`
- `load()` setzt `original_duration = duration`
- `reset()` setzt `duration = original_duration` (zusätzlich zu den bestehenden Resets)
- `adjust_time()` bleibt unverändert

**Änderung:** Nur `TimerController` in `app.py`.

---

## Nicht im Scope

- Layouts für Mini/Neo (6/8 Tasten) – haben keinen `timer_component`-Button
- Neue Button-Typen oder Layout-Änderungen
- Änderungen am Web-Interface (`control.html`, `control.js`)
