(function() {
    'use strict';

    const socket = io();

    const timerPreview = document.getElementById('timer-preview');
    const currentPreset = document.getElementById('current-preset');
    const currentStatus = document.getElementById('current-status');
    const presetsList = document.getElementById('presets-list');

    const btnStart = document.getElementById('btn-start');
    const btnPause = document.getElementById('btn-pause');
    const btnStop = document.getElementById('btn-stop');
    const btnReset = document.getElementById('btn-reset');
    const btnManualLoad = document.getElementById('btn-manual-load');
    const btnModeToggle = document.getElementById('btn-mode-toggle');

    let presets = window.initialPresets || [];
    let currentMode = window.initialMode || 'timer';
    let timerPhase = 'idle';
    let timerRunning = false;
    let timerPaused = false;
    let timerStopped = false;
    let currentPresetName = '';
    let blinkOnWarning = (window.initialBlink || {}).blink_on_warning !== false;
    let blinkOnOvertime = (window.initialBlink || {}).blink_on_overtime !== false;

    function showToast(msg, type = 'success') {
        const toast = document.getElementById('toast');
        toast.textContent = msg;
        toast.className = 'toast show ' + type;
        setTimeout(() => { toast.className = 'toast'; }, 3000);
    }

    function formatTime(seconds) {
        const abs = Math.abs(seconds);
        const sign = seconds < 0 ? '-' : '';
        const h = Math.floor(abs / 3600);
        const m = Math.floor((abs % 3600) / 60);
        const s = Math.floor(abs % 60);
        if (h > 0) return `${sign}${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
        return `${sign}${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    }

    function escapeHtml(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    function renderPresets() {
        presetsList.innerHTML = '';
        presets.forEach(preset => {
            const card = document.createElement('div');
            card.className = 'preset-card';
            if (preset.name === currentPresetName) card.classList.add('active');
            card.dataset.id = preset.id;
            card.innerHTML = `
                <div class="preset-name">${escapeHtml(preset.name)}</div>
                <div class="preset-time">${formatTime(preset.duration)}</div>
                <div class="preset-warnings">Warn: ${preset.warning1}s / ${preset.warning2}s</div>
            `;
            card.addEventListener('click', () => loadPreset(preset));
            presetsList.appendChild(card);
        });
    }

    // Preset laden (kein Start!)
    async function loadPreset(preset) {
        try {
            await fetch('/api/timer/load', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({
                    duration: preset.duration,
                    warning1: preset.warning1,
                    warning2: preset.warning2,
                    preset_name: preset.name,
                }),
            });
            showToast(`Geladen: ${preset.name}`, 'success');
        } catch (e) {
            showToast('Fehler: ' + e.message, 'error');
        }
    }

    function updateButtons() {
        // Start: aktiv wenn Timer geladen und nicht gerade aktiv läuft (ausser pausiert für Fortsetzen)
        const canStart =
            (timerPhase === 'loaded') ||
            (timerPaused) ||
            (timerStopped && timerPhase === 'stopped');
        btnStart.disabled = !canStart;

        // Pause: aktiv wenn Timer läuft oder pausiert ist
        btnPause.disabled = !(timerRunning);
        btnPause.textContent = timerPaused ? '▶ Fortsetzen' : '⏸ Pause';

        // Stop: aktiv wenn Timer läuft oder pausiert
        btnStop.disabled = !(timerRunning || timerPaused);
    }

    // Start-Button
    btnStart.addEventListener('click', async () => {
        try {
            await fetch('/api/timer/start', {method: 'POST'});
        } catch (e) {
            showToast('Fehler: ' + e.message, 'error');
        }
    });

    // Pause-Button (Toggle)
    btnPause.addEventListener('click', async () => {
        try {
            await fetch('/api/timer/pause', {method: 'POST'});
        } catch (e) {
            showToast('Fehler: ' + e.message, 'error');
        }
    });

    // Stop-Button
    btnStop.addEventListener('click', async () => {
        try {
            await fetch('/api/timer/stop', {method: 'POST'});
            showToast('Timer gestoppt', 'warning');
        } catch (e) {
            showToast('Fehler: ' + e.message, 'error');
        }
    });

    // Reset-Button
    btnReset.addEventListener('click', async () => {
        try {
            await fetch('/api/timer/reset', {method: 'POST'});
            showToast('Timer zurückgesetzt', 'success');
        } catch (e) {
            showToast('Fehler: ' + e.message, 'error');
        }
    });

    // Adjust-Buttons
    document.querySelectorAll('.btn-adjust').forEach(btn => {
        btn.addEventListener('click', async () => {
            const seconds = parseInt(btn.dataset.seconds);
            try {
                await fetch('/api/timer/adjust', {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({seconds: seconds}),
                });
                const sign = seconds > 0 ? '+' : '';
                showToast(`Zeit ${sign}${seconds/60} Min angepasst`, 'success');
            } catch (e) {
                showToast('Fehler: ' + e.message, 'error');
            }
        });
    });

    // Manuelle Zeit laden
    btnManualLoad.addEventListener('click', async () => {
        const min = parseInt(document.getElementById('manual-min').value) || 0;
        const sec = parseInt(document.getElementById('manual-sec').value) || 0;
        const warn1 = parseInt(document.getElementById('manual-warn1').value) || 0;
        const warn2 = parseInt(document.getElementById('manual-warn2').value) || 0;
        const duration = min * 60 + sec;
        if (duration <= 0) {
            showToast('Bitte eine gültige Dauer eingeben', 'warning');
            return;
        }
        try {
            await fetch('/api/timer/load', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({
                    duration: duration,
                    warning1: warn1,
                    warning2: warn2,
                    preset_name: 'Manuell',
                }),
            });
            showToast('Manuelle Zeit geladen', 'success');
        } catch (e) {
            showToast('Fehler: ' + e.message, 'error');
        }
    });

    // Display-Mode-Toggle
    function updateModeButton() {
        btnModeToggle.textContent = currentMode === 'clock' ? '⏱ Timer-Modus' : '🕐 Uhr-Modus';
    }

    btnModeToggle.addEventListener('click', async () => {
        try {
            const res = await fetch('/api/display/mode/toggle', {method: 'POST'});
            const data = await res.json();
            currentMode = data.mode;
            updateModeButton();
            showToast(`Display: ${currentMode === 'clock' ? 'Uhr' : 'Timer'}`, 'success');
        } catch (e) {
            showToast('Fehler: ' + e.message, 'error');
        }
    });

    updateModeButton();

    // Socket-Updates
    socket.on('timer_update', function(data) {
        timerRunning = data.running;
        timerPaused = data.paused;
        timerStopped = data.stopped;
        timerPhase = data.phase;
        const prevPresetName = currentPresetName;
        currentPresetName = data.preset_name;

        // Preview-Anzeige
        if (data.phase === 'idle' || data.phase === 'loaded' || data.phase === 'stopped') {
            timerPreview.textContent = formatTime(
                data.phase === 'stopped' ? 0 : (data.duration || 0)
            );
        } else {
            timerPreview.textContent = formatTime(data.remaining);
        }

        // Phasen-Farbe
        const colors = {
            normal: '#0f172a',
            warning1: '#d97706',
            warning2: '#dc2626',
            overtime: '#dc2626',
            paused: '#2563eb',
            stopped: '#64748b',
            idle: '#0f172a',
            loaded: '#0f172a',
        };
        timerPreview.style.color = colors[data.phase] || '#0f172a';

        currentPreset.textContent = data.preset_name || '—';

        const statusMap = {
            idle: 'Bereit',
            loaded: 'Geladen – warte auf Start',
            normal: '▶ Läuft',
            warning1: '▶ Läuft (Warnung 1)',
            warning2: '▶ Läuft (Warnung 2)',
            overtime: '⚠️ Zeit überschritten',
            paused: '⏸ Pausiert',
            stopped: '⏹ Gestoppt',
        };
        currentStatus.textContent = statusMap[data.phase] || '';

        // Preset-Hervorhebung aktualisieren, wenn sich geändert hat
        if (prevPresetName !== currentPresetName) {
            renderPresets();
        }

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

        updateButtons();
    });

    socket.on('display_config_update', function(cfg) {
        if (cfg.mode && cfg.mode !== currentMode) {
            currentMode = cfg.mode;
            updateModeButton();
        }
        if (typeof cfg.blink_on_warning === 'boolean') blinkOnWarning = cfg.blink_on_warning;
        if (typeof cfg.blink_on_overtime === 'boolean') blinkOnOvertime = cfg.blink_on_overtime;
    });

    renderPresets();
    updateButtons();
})();
