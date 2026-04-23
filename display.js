[Unit]
Description=Speech Timer Flask Server
After=network.target

[Service]
Type=simple
User=pi
Group=pi
WorkingDirectory=/home/pi/speech-timer-pi
Environment="PATH=/home/pi/speech-timer-pi/venv/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"
ExecStart=/home/pi/speech-timer-pi/venv/bin/python /home/pi/speech-timer-pi/app.py
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
