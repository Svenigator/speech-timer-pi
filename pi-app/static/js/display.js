(function() {
    'use strict';

    const socket = io();
    const container = document.getElementById('display-container');
    const timerMode = document.getElementById('timer-mode');
    const clockMode = document.getElementById('clock-mode');
    const presetEl = document.getElementById('preset-name');
    const timerEl = document.getElementById('timer-display');
    const progressEl = document.getElementById('progress-fill');
    const statusEl = document.getElementById('status-text');
    const clockEl = document.getElementById('clock-display');
    const clockDateEl = document.getElementById('clock-date');
    const timerContainer = document.getElementById('timer-container');

    let currentConfig = window.initialConfig || {};
    let currentMode = currentConfig.mode || 'timer';

    function applyConfig(cfg) {
        currentConfig = Object.assign({}, currentConfig, cfg);
        container.style.backgroundColor = currentConfig.background_color || '#000000';
        container.style.color = currentConfig.text_color || '#FFFFFF';
        timerEl.style.color = currentConfig.text_color || '#FFFFFF';
        clockEl.style.color = currentConfig.text_color || '#FFFFFF';

        // Mode umschalten
        if (cfg.mode && cfg.mode !== currentMode) {
            currentMode = cfg.mode;
            applyMode();
        }
    }

    function applyMode() {
        if (currentMode === 'clock') {
            timerMode.classList.add('hidden');
            clockMode.classList.remove('hidden');
        } else {
            clockMode.classList.add('hidden');
            timerMode.classList.remove('hidden');
        }
    }

    applyConfig(currentConfig);
    applyMode();

    function formatTime(seconds) {
        const abs = Math.abs(seconds);
        const sign = seconds < 0 ? '-' : '';
        const h = Math.floor(abs / 3600);
        const m = Math.floor((abs % 3600) / 60);
        const s = Math.floor(abs % 60);
        if (h > 0) {
            return `${sign}${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
        }
        return `${sign}${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    }

    function setPhaseColor(phase) {
        let color = currentConfig.text_color || '#FFFFFF';
        switch (phase) {
            case 'warning1': color = currentConfig.warning1_color; break;
            case 'warning2': color = currentConfig.warning2_color; break;
            case 'overtime': color = currentConfig.overtime_color; break;
        }
        timerEl.style.color = color;
        progressEl.style.backgroundColor = color;
    }

    function setStatusText(data) {
        const map = {
            'idle': 'Bereit',
            'loaded': 'Bereit',
            'normal': 'Läuft',
            'warning1': 'Läuft',
            'warning2': 'Läuft',
            'overtime': 'Zeit überschritten',
            'paused': 'Pausiert',
            'stopped': 'Gestoppt',
        };
        statusEl.textContent = map[data.phase] || '';
    }

    function setBlinking(phase) {
        timerContainer.classList.remove('blinking', 'blinking-fast');
        if (phase === 'warning2' && currentConfig.blink_on_warning !== false) {
            timerContainer.classList.add('blinking');
        } else if (phase === 'overtime' && currentConfig.blink_on_overtime !== false) {
            timerContainer.classList.add('blinking-fast');
        }
    }

    // Timer-Updates
    socket.on('timer_update', function(data) {
        presetEl.textContent = data.preset_name || '';

        // Timer-Anzeige
        if (data.phase === 'idle' || data.phase === 'loaded' || data.phase === 'stopped') {
            // Bei stopped/idle 00:00 bzw. Gesamtdauer anzeigen
            timerEl.textContent = formatTime(
                data.phase === 'stopped' ? 0 : (data.duration || 0)
            );
        } else {
            timerEl.textContent = formatTime(data.remaining);
        }

        // Progress
        if (data.duration > 0) {
            const progress = Math.min(100, Math.max(0, (data.elapsed / data.duration) * 100));
            progressEl.style.width = progress + '%';
        } else {
            progressEl.style.width = '0%';
        }

        setPhaseColor(data.phase);
        setBlinking(data.phase);
        setStatusText(data);

        // Clock-Display
        if (data.current_time) {
            clockEl.textContent = data.current_time;
        }
        const now = new Date();
        clockDateEl.textContent = now.toLocaleDateString('de-DE', {
            weekday: 'long', day: '2-digit', month: 'long', year: 'numeric'
        });
    });

    socket.on('display_config_update', function(cfg) {
        applyConfig(cfg);
    });

    socket.on('connect', function() {
        console.log('Connected');
    });

    // F11 Vollbild-Fallback
    document.addEventListener('keydown', function(e) {
        if (e.key === 'F11') {
            e.preventDefault();
            if (!document.fullscreenElement) {
                document.documentElement.requestFullscreen();
            } else {
                document.exitFullscreen();
            }
        }
    });
})();
