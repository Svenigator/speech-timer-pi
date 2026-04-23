# Speech Timer Pi

Companion module for controlling a Raspberry Pi based Speech Timer via its HTTP API.

## Configuration

| Field | Description |
|-------|-------------|
| Target IP | IP address of the Raspberry Pi running the Speech Timer (e.g. `192.168.1.42`). |
| Port | Flask port, default `5000`. |
| Poll interval | How often Companion polls the Pi for status (default 500 ms). Lower values = smoother countdown, higher values = less network traffic. |

Both the Pi and the Companion machine must be on the same network.

## Actions

### Presets
- **Load Preset (no start)** — Loads a preset via dropdown. Dropdown list is fetched from the Pi and refreshes every 10 seconds.
- **Load Preset by ID (no start)** — Loads a preset by its numeric ID (e.g. `3`). Unlike the dropdown version, this Action doesn't care about the current preset list — ideal for fixed Stream-Deck buttons that should always load "slot 3", regardless of what's currently there.
- **Load Manual Time (no start)** — Loads a custom duration.
- **Refresh Presets** — Fetches the preset list from the Pi again.

### Playback
- **Start / Resume** — Starts the loaded timer or resumes after pause.
- **Pause / Resume (toggle)** — Toggles between pause and resume.
- **Stop** — Stops the timer (display shows 00:00, preset stays loaded).
- **Reset** — Full reset (preset unloaded, display blank).

### Adjust Time
- **Adjust Time** — Adds or subtracts a configurable amount of seconds. Works even while the timer is running.
- **Adjust +1 / -1 / +5 / -5 minutes** — Shortcuts.

### Display Mode
- **Set Display Mode** — Switch between Timer and Clock on the display screen.
- **Toggle Display Mode** — Toggles between Timer and Clock.

## Feedbacks

- **Timer State (complete)** — One feedback that colours the button based on the current phase (Normal / Warning 1 / Warning 2 / Overtime / Paused / Stopped).
- **Timer Phase is …** — Boolean feedback for a specific phase.
- **Timer is running**, **Timer is paused**, **Timer is in overtime** — Simple boolean feedbacks.
- **Display mode is …** — Boolean for current display mode.

## Variables

All variables are prefixed with `speech-timer-pi:`:

### Timer state
- `time_formatted` — Remaining time as `MM:SS` or `-MM:SS` during overtime
- `remaining` — Remaining seconds (negative during overtime)
- `elapsed`, `duration` — Seconds
- `running`, `paused`, `stopped`, `overtime` — `1` or `0`
- `phase` — `idle` / `loaded` / `normal` / `warning1` / `warning2` / `overtime` / `paused` / `stopped`
- `preset_name` — Name of the currently loaded preset
- `current_time` — Clock time from the Pi
- `status_text` — Human-readable status (`READY`, `RUNNING`, `PAUSED`, …)
- `display_mode` — `timer` or `clock`

### Pi network info
- `hostname` — Hostname of the Pi
- `ip_primary` — Primary IP address (first non-loopback)
- `ip_eth0` — IP address of the Ethernet adapter
- `ip_wlan0` — IP address of the WiFi adapter
- `ssid` — Connected WiFi network name

### Preset info (dynamic per preset ID)
For every preset configured on the Pi, these three variables are available:
- `preset_name_<ID>` — The preset's name (e.g. `preset_name_3`)
- `preset_time_<ID>` — The preset's duration as `MM:SS`
- `preset_duration_<ID>` — The preset's duration in seconds

Useful on button labels: `$(speech-timer-pi:preset_name_3)`

## Presets (Button templates)

The module ships ready-made button presets in these categories:
- **Display** — Live countdown button with automatic colour feedback
- **Control** — Start / Pause / Stop / Reset
- **Adjust Time** — ±1 min, ±5 min
- **Display Mode** — Timer / Clock switches
- **Pi Info** — Hostname, IP eth0, IP wlan0, Primary IP (display-only, no click action)
- **Preset Slots** — Fixed buttons for preset IDs 1–6, label pulls preset name from the Pi via variable. Stays stable even when presets are renamed.
- **Load Presets** — One button per existing preset on the Pi. List auto-refreshes every 10 seconds when presets change on the Pi.
