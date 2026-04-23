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
- **Load Preset (no start)** — Loads a preset without starting. Starts only after *Start* is pressed.
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

- `time_formatted` — Remaining time as `MM:SS` or `-MM:SS` during overtime
- `remaining` — Remaining seconds (negative during overtime)
- `elapsed`, `duration` — Seconds
- `running`, `paused`, `stopped`, `overtime` — `1` or `0`
- `phase` — `idle` / `loaded` / `normal` / `warning1` / `warning2` / `overtime` / `paused` / `stopped`
- `preset_name` — Name of the currently loaded preset
- `current_time` — Clock time from the Pi
- `status_text` — Human-readable status (`READY`, `RUNNING`, `PAUSED`, …)
- `display_mode` — `timer` or `clock`

## Presets (Button templates)

The module ships ready-made button presets in these categories:
- **Display** — Live countdown button with automatic colour feedback
- **Control** — Start / Pause / Stop / Reset
- **Adjust Time** — ±1 min, ±5 min
- **Display Mode** — Timer / Clock switches
- **Load Presets** — One button per preset defined on the Pi
