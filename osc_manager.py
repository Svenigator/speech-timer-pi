<!DOCTYPE html>
<html lang="de">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Speech Timer - Steuerung</title>
    <link rel="stylesheet" href="{{ url_for('static', filename='css/control.css') }}">
    <script src="{{ url_for('static', filename='js/socket.io.min.js') }}"></script>
</head>
<body>
    <header>
        <h1>🎤 Speech Timer</h1>
        <nav>
            <button id="btn-mode-toggle" class="btn btn-secondary">🕐 Uhr-Modus</button>
            <a href="/" target="_blank" class="btn btn-secondary">Display</a>
            <a href="/settings" class="btn btn-secondary">⚙️ Einstellungen</a>
        </nav>
    </header>

    <main>
        <!-- Status-Karte -->
        <section class="card status-card">
            <div class="timer-preview" id="timer-preview">00:00</div>
            <div class="status-info">
                <div><strong>Vorlage:</strong> <span id="current-preset">—</span></div>
                <div><strong>Status:</strong> <span id="current-status">Bereit</span></div>
            </div>
        </section>

        <!-- Steuerungs-Buttons -->
        <section class="card">
            <h2>Steuerung</h2>
            <div class="controls">
                <button id="btn-start" class="btn btn-success btn-large">▶ Start</button>
                <button id="btn-pause" class="btn btn-warning btn-large" disabled>⏸ Pause</button>
                <button id="btn-stop" class="btn btn-danger btn-large" disabled>⏹ Stop</button>
                <button id="btn-reset" class="btn btn-secondary btn-large">↺ Reset</button>
            </div>
        </section>

        <!-- Zeit-Anpassung -->
        <section class="card">
            <h2>Zeit anpassen</h2>
            <div class="adjust-grid">
                <button class="btn btn-adjust" data-seconds="-300">−5 Min</button>
                <button class="btn btn-adjust" data-seconds="-60">−1 Min</button>
                <button class="btn btn-adjust btn-positive" data-seconds="60">+1 Min</button>
                <button class="btn btn-adjust btn-positive" data-seconds="300">+5 Min</button>
            </div>
            <p class="hint">Funktioniert auch während der Timer läuft.</p>
        </section>

        <!-- Presets -->
        <section class="card">
            <h2>Vorlagen</h2>
            <div id="presets-list" class="presets-grid"></div>
            <p class="hint">Klicken, um die Zeit zu laden. Der Timer startet erst mit Start.</p>
        </section>

        <!-- Manuelle Eingabe -->
        <section class="card">
            <h2>Manuelle Zeit</h2>
            <div class="manual-grid">
                <div class="form-row">
                    <label>Dauer (Min:Sek)</label>
                    <div class="time-input">
                        <input type="number" id="manual-min" min="0" max="180" value="10">
                        <span>:</span>
                        <input type="number" id="manual-sec" min="0" max="59" value="0">
                    </div>
                </div>
                <div class="form-row">
                    <label>Warnung 1 (Sek)</label>
                    <input type="number" id="manual-warn1" min="0" value="120">
                </div>
                <div class="form-row">
                    <label>Warnung 2 (Sek)</label>
                    <input type="number" id="manual-warn2" min="0" value="30">
                </div>
            </div>
            <button id="btn-manual-load" class="btn btn-primary">Zeit laden</button>
            <p class="hint">Zeit wird geladen. Timer anschließend mit Start starten.</p>
        </section>
    </main>

    <div id="toast" class="toast"></div>

    <script>
        window.initialPresets = {{ config.presets | tojson }};
        window.initialMode = {{ config.display.mode | tojson }};
    </script>
    <script src="{{ url_for('static', filename='js/control.js') }}"></script>
</body>
</html>
