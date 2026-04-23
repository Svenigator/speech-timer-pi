# Speech Timer Pi – Companion Module

Control a Speech Timer running on a Raspberry Pi 4 from Companion / Stream Deck.

## Configuration

| Field | Description |
| --- | --- |
| Target IP | IP address of the Raspberry Pi (e.g. `192.168.1.42`) |
| Port | Default: `5000` |
| Poll interval | How often the timer is polled in ms (default: `500`) |

## Actions

### Load (no start)

| Action | Description |
| --- | --- |
| Load Preset (no start) | Loads a preset from dropdown; timer does NOT start |
| Load Manual Time (no start) | Loads a custom duration + warnings; timer does NOT start |

### Control

| Action | Description |
| --- | --- |
| Start / Resume | Starts the loaded timer or resumes a paused one |
| Pause / Resume (toggle) | Toggles between pause and resume |
| Stop | Stops and sets the timer to 00:00 (preset stays loaded) |
| Reset | Resets everything and clears the loaded preset |

### Adjust Time (works during running timer!)

| Action | Description |
| --- | --- |
| Adjust Time | Custom +/- seconds value |
| Adjust +1 minute | Shortcut |
| Adjust -1 minute | Shortcut |
| Adjust +5 minutes | Shortcut |
| Adjust -5 minutes | Shortcut |

### Display Mode

| Action | Description |
| --- | --- |
| Set Display Mode | Switches display to Timer or Clock |
| Toggle Display Mode | Toggles between Timer and Clock |

### Misc

| Action | Description |
| --- | --- |
| Refresh Presets | Reloads the preset list from the timer |

## Variables

| Variable | Meaning |
| --- | --- |
| `time_formatted` | `MM:SS` or `-MM:SS` (overtime) |
| `remaining` | Remaining time in seconds |
| `elapsed` | Elapsed time in seconds |
| `duration` | Total configured duration |
| `running` | `1` if running, `0` otherwise |
| `paused` | `1` if paused |
| `stopped` | `1` if stopped (showing 00:00) |
| `overtime` | `1` if time exceeded |
| `phase` | idle / loaded / normal / warning1 / warning2 / overtime / paused / stopped |
| `preset_name` | Name of the current preset |
| `current_time` | Clock time from the Pi (HH:MM:SS) |
| `status_text` | READY / LOADED / RUNNING / WARNING 1 / WARNING 2 / OVERTIME / PAUSED / STOPPED |
| `display_mode` | `timer` or `clock` |

## Feedbacks

| Feedback | Description |
| --- | --- |
| Timer State (complete) | Full color scheme based on phase (configurable colors) |
| Timer Phase is … | Triggers on a specific phase |
| Timer is running | Triggers when actively running (not paused) |
| Timer is paused | Triggers when paused |
| Timer is in overtime | Triggers when time exceeded |
| Display mode is … | Triggers when display is in specified mode |

## Presets (ready-to-use buttons)

- **Display** – Timer readout with auto color; Status button
- **Control** – Start, Pause/Resume (text changes), Stop, Reset
- **Adjust Time** – +1/-1/+5/-5 minute buttons
- **Display Mode** – Toggle button, Set-to-Timer, Set-to-Clock
- **Load Presets** – One button per preset (loads without starting)

## Typical workflow

1. Press a "Load Preset" button → preset is loaded (display shows the time, status = LOADED)
2. Press "Start" → timer starts running
3. Use Adjust buttons during the talk to add/remove time
4. "Stop" when finished or "Pause" for interruptions
5. "Reset" to clear everything for the next talk
