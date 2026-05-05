# Troubleshooting – Speech Timer Pi Companion Module

## Status says "Connecting…" forever

1. **Ping test:** From the Companion machine, open a terminal and run `ping <Pi-IP>`. If that fails, it's a network problem, not a module problem.
2. **Check Flask is running on the Pi:** SSH to the Pi and run
   ```
   sudo systemctl status speech-timer
   ```
   Must say `active (running)`. If not: `sudo systemctl start speech-timer` and check the journal with `journalctl -u speech-timer -n 50`.
3. **Port reachable?** From any PC on the network, open `http://<Pi-IP>/` in a browser. If that works, Companion should also be able to connect.
4. **Firewall:** A default Raspberry Pi OS install has no firewall, but if you added `ufw` or similar: `sudo ufw allow 80/tcp`.

## Presets dropdown says "— No presets loaded —"

The module polls `/api/presets` at startup. If the Pi isn't reachable yet when Companion starts, the list will be empty.

- Hit **Refresh Presets** action once connected.
- Or restart the module instance.

## Button colours not updating

Make sure the feedback **Timer State (complete)** is added to the button. A single feedback covers all phases — don't add multiple `Timer Phase is …` feedbacks instead, that's more work and they can conflict in ordering.

## Variable `$(speech-timer-pi:time_formatted)` displays nothing

Connection is not established. Check status light at the top of the instance page — must be green.

## Timer is jumpy / not smooth

Reduce `Poll interval` in the module config (e.g. 250 ms). The default 500 ms is a compromise for low-bandwidth networks.

## Network test checklist

On the Pi:
```bash
# Is Flask listening?
sudo ss -tlnp | grep :80

# Local API test
curl http://localhost/api/timer/status

# Public API test (from Pi to itself via IP)
curl http://$(hostname -I | awk '{print $1}')/api/timer/status
```

On the Companion machine:
```bash
# Replace 192.168.1.42 with your Pi IP
curl http://192.168.1.42/api/timer/status
curl http://192.168.1.42/api/presets
```

If the second command works from the Companion machine but the module still won't connect, it's almost certainly a wrong IP or wrong port in the instance config.

## Module errors in Companion log

Open Companion → Log. Filter for `speech-timer-pi`. Messages starting with `HTTP error` or `HTTP timeout` mean the Pi isn't reachable. Messages starting with `Connected` confirm the connection.
