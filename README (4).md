/* Tab-Navigation */
.tabs {
    display: flex;
    gap: 0.25rem;
    margin-bottom: 1rem;
    background: white;
    border-radius: var(--radius);
    padding: 0.25rem;
    overflow-x: auto;
    box-shadow: var(--shadow);
}

.tab-btn {
    padding: 0.75rem 1.25rem;
    border: none;
    background: transparent;
    cursor: pointer;
    font-size: 0.95rem;
    font-weight: 500;
    border-radius: var(--radius);
    transition: all 0.15s ease;
    white-space: nowrap;
    font-family: inherit;
    color: var(--color-text);
}

.tab-btn:hover { background: var(--color-bg); }

.tab-btn.active {
    background: var(--color-primary);
    color: white;
}

.tab-content { display: none; }
.tab-content.active { display: block; }

/* Settings Grid */
.settings-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
    gap: 1.25rem;
}

/* Farb-Inputs */
.color-input {
    display: flex;
    gap: 0.5rem;
    align-items: center;
}

.color-input input[type="color"] {
    width: 60px;
    height: 40px;
    padding: 0.25rem;
    cursor: pointer;
    border: 1px solid var(--color-border);
    border-radius: var(--radius);
}

.color-input input[type="text"] {
    flex: 1;
    font-family: monospace;
    text-transform: uppercase;
}

/* Range-Slider */
input[type="range"] {
    width: 100%;
    accent-color: var(--color-primary);
    cursor: pointer;
}

/* Checkbox-Reihe */
.checkbox-row {
    display: flex;
    gap: 2rem;
    flex-wrap: wrap;
}

.checkbox-row label {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    cursor: pointer;
    font-weight: normal;
}

.checkbox-row input[type="checkbox"] {
    width: 18px;
    height: 18px;
    cursor: pointer;
    accent-color: var(--color-primary);
}

/* Großes Display (Uhrzeit) */
.big-display {
    font-size: 2rem;
    font-weight: 700;
    color: var(--color-primary);
    font-variant-numeric: tabular-nums;
    padding: 0.75rem 1rem;
    background: var(--color-bg);
    border-radius: var(--radius);
    text-align: center;
}

/* Info-Box */
.info-box {
    margin-top: 1.5rem;
    padding: 0.75rem 1rem;
    background: #dbeafe;
    border-left: 4px solid var(--color-primary);
    border-radius: var(--radius);
    font-size: 0.9rem;
    color: #1e40af;
}

/* Netzwerk */
.network-status {
    padding: 1rem;
    background: var(--color-bg);
    border-radius: var(--radius);
    font-size: 0.95rem;
}

.network-status.connected {
    background: #dcfce7;
    color: #166534;
}

.network-status.disconnected {
    background: #fee2e2;
    color: #991b1b;
}

.wifi-list {
    margin-top: 1rem;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    max-height: 400px;
    overflow-y: auto;
}

.wifi-item {
    padding: 0.75rem 1rem;
    background: white;
    border: 1px solid var(--color-border);
    border-radius: var(--radius);
    display: flex;
    justify-content: space-between;
    align-items: center;
    cursor: pointer;
    transition: all 0.15s ease;
}

.wifi-item:hover {
    border-color: var(--color-primary);
    background: #f0f9ff;
}

.wifi-ssid { font-weight: 500; }

.wifi-meta {
    display: flex;
    gap: 0.75rem;
    align-items: center;
    font-size: 0.85rem;
    color: var(--color-secondary);
}

.wifi-signal {
    display: inline-block;
    width: 30px;
    text-align: center;
}

.wifi-encrypted { color: var(--color-warning); }

/* WLAN-Dialog */
.wifi-dialog {
    margin-top: 1rem;
    padding: 1.5rem;
    background: var(--color-bg);
    border-radius: var(--radius);
    border: 2px solid var(--color-primary);
}

.wifi-dialog.hidden { display: none; }

.wifi-dialog h3 { margin-bottom: 1rem; }

.dialog-buttons {
    display: flex;
    gap: 0.5rem;
    justify-content: flex-end;
    margin-top: 1rem;
}

/* Presets Editor Full */
#presets-full-editor {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    margin-bottom: 1rem;
}

#btn-add-full-preset, #btn-save-full-presets {
    margin-right: 0.5rem;
}

/* OSC-Einstellungen */
.osc-status-box {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1rem 1.25rem;
    background: var(--color-bg);
    border-radius: var(--radius);
    margin-top: 1rem;
}

.osc-status-text {
    font-size: 0.9rem;
    font-weight: 500;
    padding: 0.25rem 0.75rem;
    border-radius: 999px;
    background: #e5e7eb;
    color: #6b7280;
}

.osc-status-text.active {
    background: #dcfce7;
    color: #166534;
}

.osc-toggle {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    cursor: pointer;
    user-select: none;
}

.osc-toggle input[type="checkbox"] {
    position: absolute;
    opacity: 0;
    pointer-events: none;
}

.osc-toggle-slider {
    width: 46px;
    height: 26px;
    background: #cbd5e1;
    border-radius: 999px;
    position: relative;
    transition: background 0.2s ease;
    flex-shrink: 0;
}

.osc-toggle-slider::before {
    content: "";
    position: absolute;
    width: 20px;
    height: 20px;
    border-radius: 50%;
    background: white;
    top: 3px;
    left: 3px;
    transition: transform 0.2s ease;
    box-shadow: 0 1px 3px rgba(0,0,0,0.2);
}

.osc-toggle input:checked + .osc-toggle-slider {
    background: var(--color-primary);
}

.osc-toggle input:checked + .osc-toggle-slider::before {
    transform: translateX(20px);
}

/* OSC-Ziele */
#osc-targets-list {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    margin-bottom: 0.75rem;
}

.osc-target-row {
    display: grid;
    grid-template-columns: 2fr 2fr 1fr auto auto;
    gap: 0.5rem;
    align-items: center;
    padding: 0.5rem;
    background: var(--color-bg);
    border-radius: var(--radius);
}

.osc-target-row input[type="text"],
.osc-target-row input[type="number"] {
    padding: 0.4rem 0.6rem;
    font-size: 0.9rem;
}

.osc-target-row .btn-delete {
    background: var(--color-danger);
    color: white;
    padding: 0.4rem 0.7rem;
    border: none;
    border-radius: var(--radius);
    cursor: pointer;
}

/* OSC-Referenz */
.osc-reference {
    margin-top: 1.5rem;
    padding-top: 1rem;
    border-top: 1px solid var(--color-border);
}

.osc-reference summary {
    cursor: pointer;
    padding: 0.5rem 0;
    font-weight: 500;
    user-select: none;
}

.osc-reference h4 {
    font-size: 1rem;
    margin-top: 0.75rem;
    margin-bottom: 0.5rem;
    color: var(--color-text);
}

.osc-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.875rem;
    margin-bottom: 0.5rem;
}

.osc-table th, .osc-table td {
    text-align: left;
    padding: 0.4rem 0.6rem;
    border-bottom: 1px solid var(--color-border);
}

.osc-table th {
    background: var(--color-bg);
    font-weight: 600;
}

.osc-table td:first-child,
.osc-table td:nth-child(2) {
    font-family: monospace;
    font-size: 0.82rem;
    color: var(--color-primary);
}

#btn-test-osc {
    margin-left: 0.5rem;
}

@media (max-width: 640px) {
    .osc-target-row {
        grid-template-columns: 1fr 1fr;
    }
}
