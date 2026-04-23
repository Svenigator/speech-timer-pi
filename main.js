# Troubleshooting

## "Es erscheinen gar keine Eingabefelder im Connection-Dialog"

Das war ein Bug in v1.0.0–1.0.2 durch ESM-Import (`import`-Syntax). v1.0.3+ nutzt
CommonJS (`require`) wie das offizielle Template — jetzt sollten die Felder erscheinen.

Falls das Problem mit v1.0.3 weiterhin besteht:

1. **Developer modules path prüfen**: Admin → Developer modules path muss auf den
   **Eltern-Ordner** zeigen (z.B. `C:\companion-modules\`), NICHT auf
   `C:\companion-modules\companion-module-speech-timer-pi\`.

2. **Ordnername prüfen**: Der Ordner muss exakt `companion-module-speech-timer-pi`
   heißen (nicht `companion-module-speechtimer-v3` oder ähnlich).

3. **Companion komplett neu starten** (nicht nur Fenster schließen — auch aus dem
   System-Tray beenden, ggf. Task Manager checken).

4. **Log prüfen**: Im Companion-UI unten auf die Log-Leiste klicken. Beim Hinzufügen
   der Connection sollte eine Zeile wie `speech-timer-pi: Connecting to ...`
   erscheinen. Falls stattdessen ein Fehler wie `Cannot find module ...` oder
   `SyntaxError` auftaucht, das ist der eigentliche Fehler.

5. **Companion-Version checken**: Das Modul braucht Companion 3.5+ mit Node 22.

## Verbindungs-Architektur

Das Modul verbindet Companion mit dem Speech Timer auf dem Pi:

```
┌─────────────────────┐                    ┌──────────────────────┐
│  Companion-Rechner  │   HTTP Polling     │  Raspberry Pi        │
│  (z.B. 192.168.1.50)│ ─────────────────► │  (z.B. 192.168.1.42) │
│                     │                    │  Port 5000           │
└─────────────────────┘                    └──────────────────────┘
```

Companion schickt alle 500ms eine Anfrage an `http://<PI-IP>:5000/api/timer/status`
und bekommt den aktuellen Timer-Zustand zurück. Commands (Start/Stop/…) werden
per HTTP POST an den Pi gesendet.

## Schritt-für-Schritt-Diagnose (Verbindung)

### Schritt 1: Ist der Speech Timer überhaupt erreichbar?

Vom Companion-Rechner aus im Browser öffnen:

```
http://<PI-IP>:5000/control
```

**Lädt die Controller-Seite?**
- Ja → Netzwerk ist ok, weiter bei Schritt 2
- Nein → Problem liegt bei Pi/Netzwerk, nicht am Companion-Modul

Falls Nein:

1. Läuft der Speech Timer Service auf dem Pi?
   ```
   sudo systemctl status speech-timer
   ```

2. Was ist die tatsächliche IP des Pi?
   ```
   hostname -I
   ```
   (Die erste Zahl ist die IP.)

3. Sind Companion-Rechner und Pi im gleichen Subnetz?

4. Pingt der Pi? `ping <PI-IP>`

### Schritt 2: Companion-Log prüfen

In Companion unten auf die Log-Leiste klicken. Filter auf `speech-timer-pi` setzen.

Häufige Fehlermeldungen:

| Fehler | Bedeutung |
| --- | --- |
| `Host missing` | Konfig unvollständig – IP im Connection-Dialog eintragen |
| `HTTP timeout on ...` | Pi antwortet nicht – IP/Port prüfen |
| `ECONNREFUSED` | Port nicht offen – läuft der Service? |
| `EHOSTUNREACH` | Pi nicht im Netz – Subnetz prüfen |
| `getaddrinfo ENOTFOUND` | Ungültige IP |

### Schritt 3: Manueller Test vom Companion-Rechner

```bash
curl -v http://<PI-IP>:5000/api/timer/status
```

Erwartete Ausgabe: JSON mit Timer-Status. Falls Timeout oder Fehler,
liegt das Problem im Netzwerk, nicht im Modul.

## Wie finde ich die richtige Pi-IP?

Auf dem Pi direkt:
```bash
hostname -I
```

Vom Windows-PC: `arp -a`
Vom Mac/Linux: `nmap -sn 192.168.1.0/24`

## Wenn alles nichts hilft

Sammle diese Infos:

1. Companion-Version (unten rechts in der UI)
2. Pi-IP und Companion-Rechner-IP
3. Ausgabe von `curl -v http://<PI-IP>:5000/api/timer/status` (vom Companion-Rechner)
4. Die letzten 20 Zeilen aus dem Companion-Log, gefiltert auf `speech-timer`
