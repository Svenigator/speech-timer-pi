# Bugs — Speech Timer Pi

Bug-Tracking für das Speech Timer Pi Projekt.

## Offen

<!-- Format: - [ ] **B-XXX: Titel** — Kurzbeschreibung
           - Reproduktion: ...
           - Umgebung: ...
-->

- [ ] **B-001: Stream Deck zeigt keine IP-Adressen** — Nach Update auf v3.0.5 werden die IP-Tasten (eth0/wlan0) leer angezeigt
  - Reproduktion: Stream Deck XL angeschlossen, Service `speech-timer-streamdeck` läuft, Tasten 30+31 bleiben leer
  - Umgebung: Pi 5, Trixie 64-bit, v3.0.5
  - Verdacht: `render_info()` erkennt IP-Format nicht, oder Network-API liefert falsches Format

## In Arbeit

<!-- Format: - [ ] **B-XXX: Titel** (gestartet YYYY-MM-DD) → [Decision](decisions/B-XXX-slug.md)
           - Reproduktion: ...
-->

*Keine Bugs in Arbeit.*

## Behoben

<!-- Format: - [x] **B-XXX: Titel** (YYYY-MM-DD) → [Decision](decisions/B-XXX-slug.md) -->

*Keine behobenen Bugs.*
