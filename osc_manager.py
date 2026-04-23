#!/bin/bash
# Installiert die Abhängigkeiten für das Companion-Modul

set -e

echo "=========================================================="
echo "  Speech Timer - Companion Module Setup"
echo "=========================================================="
echo

# Prüfen ob npm vorhanden
if ! command -v npm &> /dev/null; then
    echo "FEHLER: npm wurde nicht gefunden."
    echo "Bitte installiere Node.js 22 von https://nodejs.org"
    echo "Danach dieses Script erneut ausführen."
    exit 1
fi

cd "$(dirname "$0")"

echo "[1/2] Installiere Abhängigkeiten (@companion-module/base)..."
npm install --omit=dev

echo
echo "[2/2] Fertig!"
echo
echo "=========================================================="
echo "  Setup abgeschlossen."
echo "=========================================================="
echo
echo "Nächste Schritte:"
echo "  1. Companion öffnen"
echo "  2. Admin > Developer modules path auf den ELTERN-Ordner"
echo "     dieses Ordners setzen"
echo "  3. Companion neu starten"
echo "  4. Connections > Add connection > 'Speech Timer'"
echo
