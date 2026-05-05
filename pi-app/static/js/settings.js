(function() {
    'use strict';

    // ============ Toast ============
    function showToast(msg, type = 'success') {
        const toast = document.getElementById('toast');
        toast.textContent = msg;
        toast.className = 'toast show ' + type;
        setTimeout(() => { toast.className = 'toast'; }, 3000);
    }

    function escapeHtml(str) {
        const div = document.createElement('div');
        div.textContent = str == null ? '' : String(str);
        return div.innerHTML;
    }

    // ============ Tab-Navigation ============
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
            btn.classList.add('active');
            const tabId = 'tab-' + btn.dataset.tab;
            const panel = document.getElementById(tabId);
            if (panel) panel.classList.add('active');

            // Lazy-Load: Netzwerk-Status laden, wenn Tab geöffnet wird
            if (btn.dataset.tab === 'network') {
                loadNetworkStatus();
                loadEth0Config();
                loadApConfig();
            }
            if (btn.dataset.tab === 'osc') loadOscConfig();
            if (btn.dataset.tab === 'time') updateCurrentTime();
            if (btn.dataset.tab === 'presets') loadPresetsEditor();
        });
    });

    // ============ Display-Einstellungen ============
    function bindColorInput(colorId, textId) {
        const color = document.getElementById(colorId);
        const text = document.getElementById(textId);
        if (!color || !text) return;
        color.addEventListener('input', () => { text.value = color.value.toUpperCase(); });
        text.addEventListener('input', () => {
            if (/^#[0-9a-fA-F]{6}$/.test(text.value)) color.value = text.value;
        });
    }
    bindColorInput('bg-color', 'bg-color-text');
    bindColorInput('text-color', 'text-color-text');
    bindColorInput('warn1-color', 'warn1-color-text');
    bindColorInput('warn2-color', 'warn2-color-text');
    bindColorInput('overtime-color', 'overtime-color-text');

    const brightnessInput = document.getElementById('brightness');
    const brightnessValue = document.getElementById('brightness-value');
    if (brightnessInput) {
        brightnessInput.addEventListener('input', () => {
            brightnessValue.textContent = brightnessInput.value;
        });
    }

    document.getElementById('btn-save-display').addEventListener('click', async () => {
        const payload = {
            background_color: document.getElementById('bg-color').value,
            text_color: document.getElementById('text-color').value,
            warning1_color: document.getElementById('warn1-color').value,
            warning2_color: document.getElementById('warn2-color').value,
            overtime_color: document.getElementById('overtime-color').value,
            brightness: parseInt(brightnessInput.value) || 100,
        };
        try {
            await fetch('/api/display', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify(payload),
            });
            // Blink-Einstellungen separat speichern
            await fetch('/api/system/blink', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({
                    blink_on_warning: document.getElementById('blink-warning').checked,
                    blink_on_overtime: document.getElementById('blink-overtime').checked,
                }),
            });
            showToast('Anzeige-Einstellungen gespeichert', 'success');
        } catch (e) {
            showToast('Fehler: ' + e.message, 'error');
        }
    });

    // ============ Presets-Editor ============
    let editorPresets = [];

    async function loadPresetsEditor() {
        try {
            const res = await fetch('/api/presets');
            editorPresets = await res.json();
            renderPresetsEditor();
        } catch (e) {
            showToast('Fehler: ' + e.message, 'error');
        }
    }

    function renderPresetsEditor() {
        const container = document.getElementById('presets-full-editor');
        container.innerHTML = '';
        editorPresets.forEach((preset, idx) => {
            const row = document.createElement('div');
            row.className = 'osc-target-row';
            row.style.gridTemplateColumns = '2fr 1fr 1fr 1fr auto';
            row.innerHTML = `
                <input type="text" placeholder="Name" value="${escapeHtml(preset.name)}" data-idx="${idx}" data-key="name">
                <input type="number" placeholder="Dauer (s)" value="${preset.duration}" data-idx="${idx}" data-key="duration">
                <input type="number" placeholder="Warn 1" value="${preset.warning1}" data-idx="${idx}" data-key="warning1">
                <input type="number" placeholder="Warn 2" value="${preset.warning2}" data-idx="${idx}" data-key="warning2">
                <button class="btn-delete" data-idx="${idx}">✕</button>
            `;
            container.appendChild(row);
        });
        container.querySelectorAll('input').forEach(inp => {
            inp.addEventListener('input', () => {
                const idx = parseInt(inp.dataset.idx);
                const key = inp.dataset.key;
                if (key === 'name') editorPresets[idx][key] = inp.value;
                else editorPresets[idx][key] = parseInt(inp.value) || 0;
            });
        });
        container.querySelectorAll('.btn-delete').forEach(btn => {
            btn.addEventListener('click', () => {
                const idx = parseInt(btn.dataset.idx);
                editorPresets.splice(idx, 1);
                renderPresetsEditor();
            });
        });
    }

    document.getElementById('btn-add-full-preset').addEventListener('click', () => {
        const nextId = Math.max(0, ...editorPresets.map(p => p.id || 0)) + 1;
        editorPresets.push({
            id: nextId,
            name: 'Neue Vorlage',
            duration: 300,
            warning1: 60,
            warning2: 30,
        });
        renderPresetsEditor();
    });

    document.getElementById('btn-save-full-presets').addEventListener('click', async () => {
        try {
            await fetch('/api/presets', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({presets: editorPresets}),
            });
            showToast('Vorlagen gespeichert', 'success');
        } catch (e) {
            showToast('Fehler: ' + e.message, 'error');
        }
    });

    // ============ Systemzeit ============
    let timeUpdateTimer = null;
    function updateCurrentTime() {
        fetch('/api/system/time').then(r => r.json()).then(data => {
            document.getElementById('current-time').textContent = data.datetime.replace('T', ' ');
        }).catch(() => {});
    }

    function startTimeClock() {
        if (timeUpdateTimer) clearInterval(timeUpdateTimer);
        updateCurrentTime();
        timeUpdateTimer = setInterval(updateCurrentTime, 1000);
    }
    startTimeClock();

    document.getElementById('btn-set-time').addEventListener('click', async () => {
        const value = document.getElementById('new-datetime').value;
        if (!value) return;
        try {
            const res = await fetch('/api/system/time', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({datetime: value}),
            });
            const data = await res.json();
            if (data.status === 'ok') {
                showToast('Systemzeit gesetzt (NTP deaktiviert)', 'success');
            } else {
                showToast('Fehler: ' + (data.message || 'unbekannt'), 'error');
            }
        } catch (e) {
            showToast('Fehler: ' + e.message, 'error');
        }
    });

    document.getElementById('btn-set-timezone').addEventListener('click', async () => {
        const tz = document.getElementById('timezone-select').value;
        try {
            const res = await fetch('/api/system/timezone', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({timezone: tz}),
            });
            const data = await res.json();
            if (data.status === 'ok') showToast('Zeitzone gesetzt: ' + tz, 'success');
            else showToast('Fehler: ' + (data.message || ''), 'error');
        } catch (e) {
            showToast('Fehler: ' + e.message, 'error');
        }
    });

    // ============ Netzwerk ============
    function ifaceIcon(type) {
        switch (type) {
            case 'ethernet': return '🔌';
            case 'wifi':     return '📶';
            case 'usb':      return '🔗';
            case 'bridge':   return '🌉';
            default:         return '🖧';
        }
    }

    function renderInterface(iface, ssid) {
        const ipv4 = (iface.ipv4 || []).map(ip => `<code>${escapeHtml(ip)}</code>`).join(', ') || '<em>keine IPv4</em>';
        const ipv6Count = (iface.ipv6 || []).length;
        const ipv6 = ipv6Count > 0
            ? `<div class="iface-ipv6">IPv6: <code>${escapeHtml(iface.ipv6[0])}</code>${ipv6Count > 1 ? ` <span class="iface-more">(+${ipv6Count - 1})</span>` : ''}</div>`
            : '';
        const state = iface.state || 'UNKNOWN';
        const stateClass = state === 'UP' ? 'iface-up' : 'iface-down';
        const ssidLabel = iface.type === 'wifi' && ssid
            ? ` · <span class="iface-ssid">${escapeHtml(ssid)}</span>`
            : '';
        return `
            <div class="iface-row">
                <div class="iface-head">
                    <span class="iface-icon">${ifaceIcon(iface.type)}</span>
                    <span class="iface-name"><strong>${escapeHtml(iface.name)}</strong></span>
                    <span class="iface-state ${stateClass}">${escapeHtml(state)}</span>
                    ${ssidLabel}
                </div>
                <div class="iface-ipv4">IPv4: ${ipv4}</div>
                ${ipv6}
            </div>
        `;
    }

    async function loadNetworkStatus() {
        const el = document.getElementById('network-status');
        try {
            const res = await fetch('/api/network/status');
            const data = await res.json();
            const interfaces = data.interfaces || [];

            if (interfaces.length === 0) {
                el.className = 'network-status disconnected';
                el.innerHTML = '<strong>Kein aktiver Netzwerk-Adapter</strong>';
                return;
            }

            el.className = data.connected ? 'network-status connected' : 'network-status disconnected';
            const hasWifi = interfaces.some(i => i.type === 'wifi' && (i.ipv4 || []).length > 0);
            const header = hasWifi && data.ssid
                ? `<div class="iface-header"><strong>WLAN:</strong> ${escapeHtml(data.ssid)}</div>`
                : '';
            el.innerHTML = header + interfaces.map(iface => renderInterface(iface, data.ssid)).join('');
        } catch (e) {
            el.className = 'network-status disconnected';
            el.textContent = 'Status nicht abrufbar';
        }
    }

    document.getElementById('btn-scan-wifi').addEventListener('click', async () => {
        const list = document.getElementById('wifi-list');
        list.innerHTML = '<div style="padding:1rem;">Scanne...</div>';
        try {
            const res = await fetch('/api/network/scan');
            const data = await res.json();
            list.innerHTML = '';
            (data.networks || []).forEach(net => {
                const item = document.createElement('div');
                item.className = 'wifi-item';
                item.innerHTML = `
                    <span class="wifi-ssid">${escapeHtml(net.ssid)}</span>
                    <span class="wifi-meta">
                        ${net.encrypted ? '<span class="wifi-encrypted">🔒</span>' : ''}
                        <span class="wifi-signal">${net.quality}%</span>
                    </span>
                `;
                item.addEventListener('click', () => openWifiDialog(net));
                list.appendChild(item);
            });
            if ((data.networks || []).length === 0) {
                list.innerHTML = '<div style="padding:1rem;color:#64748b;">Keine Netzwerke gefunden.</div>';
            }
        } catch (e) {
            showToast('Scan fehlgeschlagen: ' + e.message, 'error');
        }
    });

    function openWifiDialog(net) {
        document.getElementById('wifi-ssid').value = net.ssid;
        document.getElementById('wifi-password').value = '';
        document.getElementById('wifi-dialog').classList.remove('hidden');
    }

    document.getElementById('btn-cancel-wifi').addEventListener('click', () => {
        document.getElementById('wifi-dialog').classList.add('hidden');
    });

    document.getElementById('btn-connect-wifi').addEventListener('click', async () => {
        const ssid = document.getElementById('wifi-ssid').value;
        const password = document.getElementById('wifi-password').value;
        try {
            const res = await fetch('/api/network/connect', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({ssid, password}),
            });
            const data = await res.json();
            if (data.status === 'ok') {
                showToast('Netzwerk hinzugefügt. Warte auf Verbindung...', 'success');
                document.getElementById('wifi-dialog').classList.add('hidden');
                setTimeout(loadNetworkStatus, 5000);
            } else {
                showToast('Fehler: ' + (data.message || ''), 'error');
            }
        } catch (e) {
            showToast('Fehler: ' + e.message, 'error');
        }
    });

    // ============ OSC ============
    let oscTargets = [];

    async function loadOscConfig() {
        try {
            const res = await fetch('/api/osc');
            const data = await res.json();
            document.getElementById('osc-enabled').checked = !!data.enabled;
            document.getElementById('osc-receive-port').value = data.receive_port || 8000;
            oscTargets = data.targets || [];
            renderOscTargets();
            updateOscStatusText(data);
        } catch (e) {
            showToast('OSC-Konfig nicht abrufbar', 'error');
        }
    }

    function updateOscStatusText(data) {
        const el = document.getElementById('osc-status-text');
        if (data.enabled && data.server_running) {
            el.className = 'osc-status-text active';
            el.textContent = `Aktiv · ${data.num_targets} Ziel(e)`;
        } else {
            el.className = 'osc-status-text';
            el.textContent = 'Deaktiviert';
        }
    }

    function renderOscTargets() {
        const list = document.getElementById('osc-targets-list');
        list.innerHTML = '';
        oscTargets.forEach((t, idx) => {
            const row = document.createElement('div');
            row.className = 'osc-target-row';
            row.innerHTML = `
                <input type="text" placeholder="Name (optional)" value="${escapeHtml(t.name || '')}" data-idx="${idx}" data-key="name">
                <input type="text" placeholder="IP" value="${escapeHtml(t.ip || '')}" data-idx="${idx}" data-key="ip">
                <input type="number" placeholder="Port" value="${t.port || 9000}" data-idx="${idx}" data-key="port">
                <span></span>
                <button class="btn-delete" data-idx="${idx}">✕</button>
            `;
            list.appendChild(row);
        });
        list.querySelectorAll('input').forEach(inp => {
            inp.addEventListener('input', () => {
                const idx = parseInt(inp.dataset.idx);
                const key = inp.dataset.key;
                if (key === 'port') oscTargets[idx][key] = parseInt(inp.value) || 0;
                else oscTargets[idx][key] = inp.value;
            });
        });
        list.querySelectorAll('.btn-delete').forEach(btn => {
            btn.addEventListener('click', () => {
                const idx = parseInt(btn.dataset.idx);
                oscTargets.splice(idx, 1);
                renderOscTargets();
            });
        });
    }

    document.getElementById('btn-add-osc-target').addEventListener('click', () => {
        oscTargets.push({name: '', ip: '', port: 9000});
        renderOscTargets();
    });

    document.getElementById('btn-save-osc').addEventListener('click', async () => {
        const payload = {
            enabled: document.getElementById('osc-enabled').checked,
            receive_port: parseInt(document.getElementById('osc-receive-port').value) || 8000,
            targets: oscTargets,
        };
        try {
            const res = await fetch('/api/osc', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify(payload),
            });
            const data = await res.json();
            showToast('OSC-Einstellungen gespeichert', 'success');
            updateOscStatusText({
                enabled: payload.enabled,
                server_running: data.server_running,
                num_targets: data.num_targets,
            });
        } catch (e) {
            showToast('Fehler: ' + e.message, 'error');
        }
    });

    document.getElementById('btn-test-osc').addEventListener('click', async () => {
        try {
            const res = await fetch('/api/osc/test', {method: 'POST'});
            const data = await res.json();
            if (data.status === 'ok') {
                showToast('Test gesendet an: ' + (data.sent_to || []).join(', '), 'success');
            } else {
                showToast(data.message || 'Test fehlgeschlagen', 'warning');
            }
        } catch (e) {
            showToast('Fehler: ' + e.message, 'error');
        }
    });

    // ============ LAN (eth0) ============
    async function loadEth0Config() {
        const loading = document.getElementById('eth0-loading');
        const configEl = document.getElementById('eth0-config');
        const unavailable = document.getElementById('eth0-unavailable');
        try {
            const res = await fetch('/api/network/eth0');
            const data = await res.json();
            loading.classList.add('hidden');
            if (data.error) {
                unavailable.classList.remove('hidden');
                return;
            }
            configEl.classList.remove('hidden');
            const mode = data.mode || 'dhcp';
            const radio = document.querySelector(`input[name="eth0-mode"][value="${mode}"]`);
            if (radio) radio.checked = true;
            document.getElementById('eth0-static-fields').classList.toggle('hidden', mode !== 'static');
            document.getElementById('eth0-ip').value = data.ip || '';
            const prefixEl = document.getElementById('eth0-prefix');
            if (prefixEl) prefixEl.value = String(data.prefix || 24);
            document.getElementById('eth0-gateway').value = data.gateway || '';
            document.getElementById('eth0-dns').value = data.dns || '';
        } catch (e) {
            if (loading) loading.classList.add('hidden');
            if (unavailable) unavailable.classList.remove('hidden');
        }
    }

    document.querySelectorAll('input[name="eth0-mode"]').forEach(radio => {
        radio.addEventListener('change', () => {
            document.getElementById('eth0-static-fields').classList.toggle(
                'hidden', radio.value !== 'static'
            );
        });
    });

    document.getElementById('btn-save-eth0').addEventListener('click', async () => {
        const modeEl = document.querySelector('input[name="eth0-mode"]:checked');
        if (!modeEl) return;
        const mode = modeEl.value;
        const payload = { mode };
        if (mode === 'static') {
            payload.ip = document.getElementById('eth0-ip').value.trim();
            payload.prefix = parseInt(document.getElementById('eth0-prefix').value, 10);
            payload.gateway = document.getElementById('eth0-gateway').value.trim();
            payload.dns = document.getElementById('eth0-dns').value.trim() || '8.8.8.8';
            if (!payload.ip || !payload.gateway) {
                showToast('IP-Adresse und Gateway sind Pflichtfelder', 'error');
                return;
            }
        }
        try {
            const res = await fetch('/api/network/eth0', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });
            const data = await res.json();
            if (data.status === 'ok') {
                showToast('LAN-Konfiguration gespeichert', 'success');
            } else {
                showToast('Fehler: ' + (data.message || 'unbekannt'), 'error');
            }
        } catch (e) {
            showToast('Fehler: ' + e.message, 'error');
        }
    });

    // ============ Fallback-AP ============
    function updateApStatus(running, ip) {
        const badge = document.getElementById('ap-status-badge');
        const ipEl = document.getElementById('ap-ip');
        const btnStart = document.getElementById('btn-start-ap');
        const btnStop = document.getElementById('btn-stop-ap');
        if (!badge) return;
        if (running) {
            badge.className = 'ap-badge ap-badge-active';
            badge.textContent = 'Hotspot aktiv';
            if (ipEl) ipEl.textContent = ip || '';
            if (btnStart) btnStart.style.display = 'none';
            if (btnStop) btnStop.style.display = '';
        } else {
            badge.className = 'ap-badge ap-badge-inactive';
            badge.textContent = 'Inaktiv';
            if (ipEl) ipEl.textContent = '';
            if (btnStart) btnStart.style.display = '';
            if (btnStop) btnStop.style.display = 'none';
        }
    }

    async function loadApConfig() {
        try {
            const res = await fetch('/api/network/ap');
            const data = await res.json();
            const unavailable = document.getElementById('ap-unavailable');
            const configSection = document.getElementById('ap-config-section');
            if (!data.nm_available) {
                if (unavailable) unavailable.classList.remove('hidden');
                if (configSection) configSection.classList.add('hidden');
                return;
            }
            document.getElementById('ap-ssid').value = data.ssid || 'SpeechTimer';
            document.getElementById('ap-password').value = data.password || 'speechtimer';
            document.getElementById('ap-auto-start').checked = !!data.auto_start;
            updateApStatus(data.running, data.ip);
        } catch (e) {
            showToast('AP-Status nicht abrufbar', 'error');
        }
    }

    document.getElementById('btn-save-ap').addEventListener('click', async () => {
        const ssid = document.getElementById('ap-ssid').value.trim();
        const password = document.getElementById('ap-password').value;
        const autoStart = document.getElementById('ap-auto-start').checked;
        if (!ssid) { showToast('SSID darf nicht leer sein', 'error'); return; }
        if (password.length < 8) { showToast('Passwort muss mind. 8 Zeichen haben', 'error'); return; }
        try {
            const res = await fetch('/api/network/ap/config', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ssid, password, auto_start: autoStart }),
            });
            const data = await res.json();
            if (data.status === 'ok') showToast('Hotspot-Einstellungen gespeichert', 'success');
            else showToast('Fehler: ' + (data.message || ''), 'error');
        } catch (e) {
            showToast('Fehler: ' + e.message, 'error');
        }
    });

    document.getElementById('btn-start-ap').addEventListener('click', async () => {
        try {
            const res = await fetch('/api/network/ap/start', { method: 'POST' });
            const data = await res.json();
            if (data.status === 'ok') {
                updateApStatus(true, data.ip);
                showToast('Hotspot gestartet', 'success');
            } else {
                showToast('Fehler: ' + (data.message || ''), 'error');
            }
        } catch (e) {
            showToast('Fehler: ' + e.message, 'error');
        }
    });

    document.getElementById('btn-stop-ap').addEventListener('click', async () => {
        try {
            const res = await fetch('/api/network/ap/stop', { method: 'POST' });
            const data = await res.json();
            if (data.status === 'ok') {
                updateApStatus(false, '');
                showToast('Hotspot gestoppt', 'success');
            } else {
                showToast('Fehler: ' + (data.message || ''), 'error');
            }
        } catch (e) {
            showToast('Fehler: ' + e.message, 'error');
        }
    });

})();
