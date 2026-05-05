# Projekt-Tracker

Leichtgewichtiges Tracking-System für Features und Bugs, direkt im Repository.

## Dateien

- **`features.md`** — Feature-Backlog mit Status (Offen / In Arbeit / Erledigt)
- **`bugs.md`** — Bug-Liste mit Status (Offen / In Arbeit / Behoben)
- **`decisions/`** — Ein Markdown-Dokument pro bearbeitetem Feature/Bug mit:
  - Lösungsansatz und verworfene Alternativen
  - Umsetzungsdetails und berührte Dateien
  - Stolpersteine und Lessons Learned
  - Follow-ups (neue Bugs/Features die aufgetaucht sind)

## ID-Schema

- Features: **F-001**, F-002, F-003, ...
- Bugs: **B-001**, B-002, B-003, ...

IDs sind unveränderlich — einmal vergeben, nie umnummerieren.

## Workflow

### Neues Feature / neuer Bug

1. Höchste ID ermitteln, nächste ID vergeben
2. In `features.md` bzw. `bugs.md` unter "Offen" eintragen
3. Bei Bedarf direkt mit der Arbeit starten (→ siehe unten)

### Feature / Bug bearbeiten

1. Eintrag von "Offen" nach "In Arbeit" verschieben
2. Decision-Doc anlegen: `decisions/F-XXX-kurzer-slug.md` (Slug aus Titel, Bindestriche, keine Umlaute)
3. Während der Arbeit das Decision-Doc befüllen
4. Nach Abschluss:
   - Decision-Doc: Status → "Erledigt", Datum eintragen
   - Liste: Eintrag nach "Erledigt"/"Behoben", Checkbox abhaken, Link zum Decision-Doc

### Nebenbei gefundene Probleme

Beim Arbeiten an X taucht ein anderer Bug Y auf?

→ **Nicht** still mitfixen  
→ Als neuen Bug anlegen, im Decision-Doc von X unter "Follow-ups" verlinken

## Beispiel

```markdown
## Offen

- [ ] **F-042: Dark Mode für Web-UI** — Dunkles Farbschema als Option
  - Akzeptanzkriterien: Toggle in Settings, alle Seiten unterstützt

## In Arbeit

- [ ] **F-041: Export als CSV** (gestartet 2026-04-28) → [Decision](decisions/F-041-export-csv.md)

## Erledigt

- [x] **F-040: Pause-Button** (2026-04-25) → [Decision](decisions/F-040-pause-button.md)
```

## Dateiformat

- Drei Sektionen: Offen → In Arbeit → Erledigt (bzw. Behoben bei Bugs)
- Checkbox: `[ ]` = offen, `[x]` = erledigt
- Datumsformat: ISO `YYYY-MM-DD`
- Decision-Doc-Link immer relativ: `[Decision](decisions/F-XXX-slug.md)`
