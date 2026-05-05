# Design: Anzeige der Countdown-Endzeit

**Datum:** 2026-05-05  
**Issue:** #2 – Anzeige des Zeitpunkts bei Ablauf des Countdowns auf dem Streamdeck  
**Status:** Approved

## Problem

Wenn ein Countdown läuft, muss der Nutzer aktuell selbst ausrechnen, zu welcher Uhrzeit der Timer enden wird. Das erschwert das Anpassen der Dauer (z.B. „ich muss 4 Minuten abziehen, damit er um 19:00 endet").

## Ziel

Die voraussichtliche Endzeit des laufenden Countdowns wird sowohl auf dem Stream Deck als auch in der Weboberfläche angezeigt — ohne manuelles Umrechnen.

## Architektur

Die Berechnung erfolgt zentral im Backend (`compute_update()` in `app.py`). Das Feld `end_time` wird im WebSocket-Event `timer_update` und im REST-Response `/api/timer/status` mitgeliefert. Alle Clients (Web, Stream Deck) verwenden dieselbe Server-berechnete Endzeit.

## Änderungen

### Backend (`pi-app/app.py`)

In `TimerController.compute_update()` wird ein neues Feld `end_time` berechnet:

| Phase | `end_time` |
|---|---|
| `normal`, `warning1`, `warning2` | `(datetime.now() + timedelta(seconds=remaining)).strftime("%H:%M:%S")` |
| `paused` | `(datetime.now() + timedelta(seconds=remaining)).strftime("%H:%M:%S")` |
| `idle`, `loaded`, `stopped`, `overtime` | `""` (leerer String) |

Import: `timedelta` aus `datetime` ergänzen.

### Stream Deck (`pi-app/streamdeck_controller.py`)

In `ButtonRenderer.render_timer()` wird die unterste Textzeile (Phase-Label) ersetzt:

- **Wenn `end_time` vorhanden** (läuft oder pausiert): untere Zeile zeigt `END HH:MM` (die letzten 5 Zeichen von `end_time`, also ohne Sekunden, wegen begrenztem Platz)
- **Sonst** (idle, loaded, stopped, overtime): bisheriges Verhalten (`READY`, `LOADED`, `STOPPED`, `OVER!`)

Die `timer_component`-Buttons (H/MIN/S auf dem XL-Deck) bleiben unverändert.

### Weboberfläche

**`pi-app/templates/control.html`:** Neues Element unterhalb von `#timer-preview`:

```html
<div id="end-time-display" class="end-time-hint" style="display:none">
  Ende: <span id="end-time-value"></span>
</div>
```

**`pi-app/static/js/control.js`:** Im `timer_update`-Handler:

```js
const endDisplay = document.getElementById('end-time-display');
const endValue = document.getElementById('end-time-value');
if (data.end_time) {
  endValue.textContent = data.end_time;
  endDisplay.style.display = '';
} else {
  endDisplay.style.display = 'none';
}
```

**CSS** (`control.css`): Neue Klasse `.end-time-hint` — kleine, dezente Schrift unterhalb der Timer-Zahl.

## Nicht im Scope

- `display.html` (Publikums-Display) — nur Steuerungsseite und Stream Deck
- `timer_component`-Buttons (XL-Deck) — nur `timer_display`
- Neuer Stream-Deck-Button-Typ — kein Layout-Eingriff nötig

## Fehlerverhalten

- Bei `overtime` (Timer überschritten): `end_time = ""` — kein Wert angezeigt, da die Endzeit in der Vergangenheit liegt
- Bei `paused`: Endzeit wird auf Basis der aktuellen Restzeit angezeigt (gibt an, wann der Timer enden würde, wenn jetzt fortgesetzt)
