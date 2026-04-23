name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  python-check:
    name: Python Syntax Check
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Set up Python
        uses: actions/setup-python@v5
        with:
          python-version: '3.11'

      - name: Install dependencies
        run: |
          cd pi-app
          python -m pip install --upgrade pip
          pip install -r requirements.txt

      - name: Check Python syntax
        run: |
          cd pi-app
          python -m py_compile app.py osc_manager.py

      - name: Validate JSON files
        run: |
          python -c "import json; json.load(open('companion-module/package.json'))"
          python -c "import json; json.load(open('companion-module/companion/manifest.json'))"

  node-check:
    name: Node.js Syntax Check
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Set up Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '22'

      - name: Check Companion module syntax
        run: |
          cd companion-module
          node --check main.js

  frontend-check:
    name: Frontend JS Syntax Check
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Set up Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '22'

      - name: Check frontend JS
        run: |
          for f in pi-app/static/js/*.js; do
            node --check "$f"
          done
