# -*- coding: utf-8 -*-
"""Рендер HTML-макетов в PNG через headless Edge."""
import os
import subprocess
import sys
import time

EDGE = r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
BASE = os.path.dirname(os.path.abspath(__file__))          # examples/_tools
EX = os.path.dirname(BASE)                                 # examples
MOCK = os.path.join(EX, "mock")
UDD = os.path.join(EX, "_edgetmp")
OUT = MOCK

MOCKS = [
    ("mock-01-toolbar.html", "mock-01-toolbar.png", 1220, 790),
    ("mock-02-danger.html", "mock-02-danger.png", 1220, 820),
    ("mock-03-empty.html", "mock-03-empty.png", 1220, 760),
    ("mock-04-list.html", "mock-04-list.png", 1220, 640),
    ("mock-05-music.html", "mock-05-music.png", 1220, 640),
    ("mock-06-status.html", "mock-06-status.png", 1160, 720),
    ("mock-07-chat.html", "mock-07-chat.png", 1220, 840),
    ("mock-08-onboarding.html", "mock-08-onboarding.png", 1220, 660),
]

only = sys.argv[1:] if len(sys.argv) > 1 else None
for html, png, w, h in MOCKS:
    if only and html not in only:
        continue
    src = os.path.join(MOCK, html)
    dst = os.path.join(OUT, png)
    url = "file:///" + src.replace("\\", "/").replace(" ", "%20")
    cmd = [EDGE, "--headless=new", "--disable-gpu", "--no-first-run", "--no-default-browser-check",
           "--hide-scrollbars", "--force-device-scale-factor=1", f"--user-data-dir={UDD}",
           f"--screenshot={dst}", f"--window-size={w},{h}", url]
    r = subprocess.run(cmd, capture_output=True, text=True, timeout=90)
    if not os.path.exists(dst):
        print("FAIL", html, r.stderr[-400:])
    else:
        print("ok", png, os.path.getsize(dst))
    time.sleep(0.2)
