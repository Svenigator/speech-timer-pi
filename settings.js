# companion-module-speech-timer-pi

Bitfocus Companion module for controlling a Speech Timer running on a Raspberry Pi 4.

**Version 1.0.4** – kompatibel mit Companion 4.x (und 3.5+).

## WICHTIG: Installation in 3 Schritten

Ein Companion-Modul ist kein fertiges Paket — es muss einmalig installiert werden.
Der häufigste Fehler („keine Config-Felder sichtbar" oder „Modul erscheint nicht")
kommt daher, dass Schritt 1 vergessen wurde.

### Schritt 1: Voraussetzungen

Du brauchst **Node.js 22** auf dem Rechner, auf dem Companion läuft:
https://nodejs.org — „LTS" herunterladen und installieren.

### Schritt 2: Abhängigkeiten installieren

1. Diese ZIP-Datei entpacken. Es entsteht ein Ordner `companion-module-speech-timer-pi`.
2. Lege diesen Ordner irgendwo hin, z.B. `C:\companion-modules\companion-module-speech-timer-pi\`
3. Im Modul-Ordner das passende Script doppelklicken:
   - **Windows**: `install.bat`
   - **Mac/Linux**: `install.sh` (im Terminal: `bash install.sh`)

Das Script lädt die benötigten Node-Pakete in einen neuen `node_modules`-Ordner.
Dauert etwa 10–30 Sekunden. **Ohne diesen Schritt funktioniert das Modul NICHT.**

### Schritt 3: In Companion einbinden

1. Companion öffnen → **Admin** → **Developer modules path**
2. Den **Eltern-Ordner** auswählen (z.B. `C:\companion-modules\`, NICHT den Modul-Ordner selbst!)
3. **Companion komplett beenden** (auch aus dem System-Tray!) und neu starten
4. **Connections** → **Add connection** → nach „Speech Timer" suchen
5. IP des Raspberry Pi eintragen (z.B. `192.168.1.42`), Port: `5000`

## Alternative: Manuelle Installation

Falls die Scripts nicht laufen, geht's auch von Hand — im Modul-Ordner
ein Terminal öffnen und eingeben:

```
npm install --omit=dev
```

## Konfiguration

| Feld | Beschreibung |
| --- | --- |
| Target IP | IP-Adresse des Pi (z.B. `192.168.1.42`) |
| Port | Port vom Speech Timer (Standard: `5000`) |
| Poll interval | Wie oft der Timer abgefragt wird in ms (Standard: `500`) |

## Fehlersuche

Bei Problemen bitte zuerst [TROUBLESHOOTING.md](TROUBLESHOOTING.md) lesen.

Die häufigsten Ursachen:

1. **`npm install` wurde nicht ausgeführt** → Modul erscheint nicht / Felder fehlen
2. **Falscher Developer-Pfad** → Modul erscheint nicht in der Liste
3. **Companion nicht neu gestartet** → alte Version wird noch geladen
4. **IP vom Pi falsch** → Timeout / „Connection failure" im Log

## Changelog

### 1.0.4
- API-Version auf 1.12.0 aktualisiert (Companion 4.x kompatibel)
- Install-Scripts (`install.bat` / `install.sh`) hinzugefügt
- Klarere Doku zum npm-install-Schritt (häufigste Fehlerursache)

### 1.0.3
- Kompletter Umbau auf CommonJS (passt zum offiziellen Template)
- Single-File-Struktur

### 1.0.0 – 1.0.2
- Erste Versionen (nicht nutzbar, ESM-Problem)

## License

MIT – siehe [LICENSE](LICENSE).
