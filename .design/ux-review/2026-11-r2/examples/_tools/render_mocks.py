# -*- coding: utf-8 -*-
"""Рендер HTML-макетов v2 в PNG через headless Edge (профиль во временной папке)."""
import os
import shutil
import subprocess
import sys
import tempfile

EDGE = r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
BASE = os.path.dirname(os.path.abspath(__file__))          # examples/_tools
R2 = os.path.dirname(os.path.dirname(BASE))                 # 2026-11-r2
MOCK_DIR = os.path.join(R2, "mockups")

MOCKS = [
    ("chat-tab.html", "chat-tab.png", 1220, 840),
    ("status-hub.html", "status-hub.png", 1220, 940),
    ("toasts.html", "toasts.png", 1220, 880),
    ("density.html", "density.png", 1220, 1170),
    ("adaptive-980.html", "adaptive-980.png", 1220, 930),
    ("settings-modal.html", "settings-modal.png", 1220, 880),
]

only = sys.argv[1:] if len(sys.argv) > 1 else None
udd = tempfile.mkdtemp(prefix="rs-mock-edge-")
try:
    for html, png, w, h in MOCKS:
        if only and html not in only:
            continue
        src = os.path.join(MOCK_DIR, html)
        dst = os.path.join(MOCK_DIR, png)
        url = "file:///" + src.replace("\\", "/").replace(" ", "%20")
        cmd = [EDGE, "--headless=new", "--disable-gpu", "--no-first-run", "--no-default-browser-check",
               "--hide-scrollbars", "--force-device-scale-factor=1", f"--user-data-dir={udd}",
               f"--screenshot={dst}", f"--window-size={w},{h}", url]
        r = subprocess.run(cmd, capture_output=True, text=True, timeout=120)
        if not os.path.exists(dst):
            print("FAIL", html, r.stderr[-300:])
        else:
            print("ok", png, os.path.getsize(dst))
finally:
    shutil.rmtree(udd, ignore_errors=True)
