# Speech Timer Pi – Handbuch

Dieses Dokument ersetzt vorläufig das PDF-Handbuch. Es fasst alle wichtigen Bedien- und Konfigurationshinweise zusammen.

## Inhaltsverzeichnis

1. [Hardware-Einrichtung](#hardware-einrichtung)
2. [Installation](#installation)
3. [Bedienung des Displays](#bedienung-des-displays)
4. [Steuerung über die Web-Oberfläche](#steuerung-ueber-die-web-oberflaeche)
5. [Presets verwalten](#presets-verwalten)
6. [Zeit-Anpassung während des Vortrags](#zeit-anpassung-waehrend-des-vortrags)
7. [Anzeige-Einstellungen](#anzeige-einstellungen)
8. [System- und Netzwerk-Einstellungen](#system-und-netzwerk-einstellungen)
9. [OSC-Integration](#osc-integration)
10. [Companion / Stream Deck](#companion--stream-deck)
11. [Fehlersuche](#fehlersuche)

## Hardware-Einrichtung

Benötigt wird ein Raspberry Pi 4 oder 5, ein Monitor oder LED-Wand per HDMI und eine Netzwerk-Verbindung (Ethernet oder WLAN).

Wichtig beim Raspberry Pi 5:
- Das offizielle Netzteil mit **5 V / 5 A** (nicht das Pi-4-Netzteil mit 3 A verwenden — sonst drosselt der Pi)
- **Mini-HDMI-Kabel** (beim Pi 4 war es Micro-HDMI)
- HDMI0 ist der Port, der näher am USB-C-Stromanschluss sitzt

## Installation

Auf dem frisch aufgesetzten Raspberry Pi OS (Bookworm, 64-bit, mit Desktop) im Terminal:

```bash
git clone https://github.com/Svenigator/speech-timer-pi.git
cd speech-timer-pi
mkdir -p ~/speech-timer-pi
cp -r pi-app/. ~/speech-timer-pi/
cd ~/speech-timer-pi
bash scripts/install.sh
sudo reboot
```

Nach dem Neustart startet der Browser automatisch im Vollbild mit dem Timer-Display.

## Bedienung des Displays

Das Display ist rein passiv. Gesteuert wird über die Weboberfläche von einem anderen Gerät (Handy, Laptop) oder über Companion / OSC.

Das Display zeigt:
- Den Namen des geladenen Presets
- Die verbleibende Zeit in großen Ziffern
- Einen Fortschrittsbalken
- Ein Status-Label (Bereit / Läuft / Pausiert / Gestoppt / Zeit überschritten)

Farben wechseln automatisch nach Phase: Normal → Gelb (Warnung 1) → Rot (Warnung 2) → Rot-blinkend (Overtime). Bei Overtime wird die Zeit mit Minuszeichen angezeigt.

Über die Weboberfläche oder OSC kann das Display zwischen Timer- und Echtzeit-Uhr-Modus umgeschaltet werden.

## Steuerung über die Web-Oberfläche

Von jedem Gerät im selben Netzwerk:

```
http://<Pi-IP>:5000/control
```

Die IP steht auf dem Display nach dem ersten Start, oder ist im Router zu finden.

Die Steuerungsseite bietet:
- **Start / Pause / Stop / Reset** (große Tasten)
- **Presets** als klickbare Karten
- **Manuelle Zeiteingabe** in Minuten : Sekunden
- **Zeit-Anpassung** (+/-1 und +/-5 Min)
- **Display-Modus-Toggle** (Timer / Uhr)

Wichtig: Das Anklicken eines Presets **lädt** die Zeit, startet den Timer aber nicht. Erst mit Start-Taste läuft er los — so hat man Kontrolle über den exakten Startmoment.

## Presets verwalten

Unter **Einstellungen → Vorlagen** lassen sich Presets anlegen, bearbeiten und löschen. Jedes Preset hat:
- Name (z.B. "Kurzvortrag", "Keynote")
- Dauer in Sekunden
- Warnung 1: Sekunden vor dem Ende, ab denen die Farbe auf Warnung-1 wechselt
- Warnung 2: Sekunden vor dem Ende, ab denen die Farbe auf Warnung-2 wechselt und je nach Einstellung geblinkt wird

## Zeit-Anpassung während des Vortrags

Die Buttons +1 Min / +5 Min / -1 Min / -5 Min verändern die **Gesamtdauer** des Timers, auch wenn er gerade läuft. Beispiel: Ein Vortrag mit 15 Minuten läuft seit 5 Minuten — Rest ist 10 Minuten. Ein Klick auf +5 Min macht daraus 20 Minuten Gesamtdauer und 15 Minuten Rest. Bei -5 Min wäre die Gesamtdauer 10 Minuten und Rest 5 Minuten. Bei negativer neuer Restzeit wird auf 0 begrenzt.

## Anzeige-Einstellungen

Unter **Einstellungen → Anzeige** können Hintergrund-, Text- und Warnfarben per Farbwähler angepasst werden, ebenso die Helligkeit (bei offizielles Pi-Touch-Display auch der Hintergrund-Backlight). Blink-Verhalten bei Warnung 2 und Overtime ist separat ein-/ausschaltbar.

## System- und Netzwerk-Einstellungen

Unter **Einstellungen → Zeit** lässt sich die Systemzeit manuell setzen. Dabei wird NTP automatisch deaktiviert, sonst würde der Pi die gesetzte Zeit sofort wieder mit der Internet-Zeit überschreiben. Zeitzone ist separat wählbar.

Unter **Einstellungen → Netzwerk** kann die aktuelle Verbindung angezeigt und nach WLANs gescannt werden. Mit Passwort verbindet sich der Pi dann.

## OSC-Integration

Unter **Einstellungen → OSC** wird:
- Der Empfangs-Port gesetzt (Standard 8000)
- Ziele definiert, an die Status-Updates gesendet werden

Die unterstützten Adressen sind auf der Einstellungsseite selbst als Referenztabelle dokumentiert (Reiter "OSC-Adressen-Referenz" ausklappen).

## Companion / Stream Deck

Der Ordner `companion-module/` im Repository enthält ein fertiges Bitfocus-Companion-Modul. Schritt-für-Schritt:

1. Ordner `companion-module/` in das Companion-Modul-Verzeichnis kopieren (Windows: `%APPDATA%\companion\modules\speech-timer-pi`) — das Skript `install.bat` erledigt das
2. In dem Ordner `npm install` ausführen
3. Companion neu starten
4. Neue Instanz vom Typ "Speech Timer Pi" anlegen
5. IP des Pi und Port (5000) eintragen

Danach stehen in Companion alle Actions, Feedbacks und Variablen zur Verfügung. Vorgefertigte Button-Presets gibt es in den Kategorien *Display*, *Control*, *Adjust Time*, *Display Mode* und *Load Presets*.

## Fehlersuche

**Display zeigt nach dem Neustart nichts:**
`sudo systemctl status speech-timer` prüfen. Muss `active (running)` zeigen. Logs mit `journalctl -u speech-timer -n 50`.

**Timer auf dem Display aktualisiert sich nicht:**
Socket.IO-Client konnte nicht geladen werden. Im Browser (F12) → Konsole checken. Lösung: `bash ~/speech-timer-pi/scripts/install.sh` nochmal laufen lassen — lädt die Library nach.

**Chromium startet nicht im Kiosk-Modus:**
`which chromium` oder `which chromium-browser` testen. Falls keins gefunden wird, `sudo apt-get install chromium` nachholen und `kiosk.sh` entsprechend anpassen.

**Companion verbindet sich nicht:**
Siehe `companion-module/TROUBLESHOOTING.md` — dort ist eine Checkliste mit `curl`-Tests.
