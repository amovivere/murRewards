p = r"F:\WorkSpaces\Mur rewards\.design\figcraft\_build\ui2.py"
s = open(p, encoding="utf-8").read()
s = s.replace('def music_screen(doc, kit, page, x, y, w=1220, h=840, empty=False, active="Музыка"):',
              'def music_screen(doc, kit, page, x, y, w=1220, h=840, empty=False, active="Музыка", queue_rows=None):')
old = '''    doc.text(queue, "Queue hint", 16, 46, 520,
             "Очередь пуста. Ссылка из активации награды появится здесь.", size=12.6, color=MUTED)
'''
new = '''    if queue_rows:
        yy = 48
        for (title, user, dur, status, scolor) in queue_rows:
            row = doc.frame(queue, "Queue row/" + title, 12, yy, cw - pad * 2 - 24, 34,
                            fill=solid("#FFFFFF05"), radius=8)
            doc.text(row, "Title", 10, 8, 320, title, size=11.8, color=TEXT2)
            doc.text(row, "User", 340, 8, 120, user, size=10.8, color=DIM)
            doc.text(row, "Dur", 470, 8, 50, dur, size=10.8, color=DIM)
            chip(doc, queue, 12 + cw - pad * 2 - 260, yy + 7, status, color=scolor,
                 bg=scolor + "1A", border=scolor + "52", size=20, fs=9.4)
            yy += 38
    else:
        doc.text(queue, "Queue hint", 16, 46, 520,
                 "Очередь пуста. Ссылка из активации награды появится здесь.", size=12.6, color=MUTED)
'''
assert old in s
s = s.replace(old, new)
s = s.replace('    doc.text(queue, "Queue title", 16, 16, 300, "Очередь · 0 из 10", size=16.4, weight=600, color=TEXT)',
              '    qcount = len(queue_rows) if queue_rows else 0\n    doc.text(queue, "Queue title", 16, 16, 300, "Очередь · %d из 10" % qcount, size=16.4, weight=600, color=TEXT)')
# chip color + "1A" won't work for hex with alpha concat? scolor like '#22C55E' -> '#22C55E1A' ok
s = s.replace('            chip(doc, queue, 12 + cw - pad * 2 - 260, yy + 7, status, color=scolor,\n                 bg=scolor + "1A", border=scolor + "52", size=20, fs=9.4)',
              '            chip(doc, queue, 12 + cw - pad * 2 - 260, yy + 7, status, color=scolor,\n                 bg=scolor + "1A", border=scolor + "52", size=20, fs=9.4)')
open(p, "w", encoding="utf-8").write(s)
print("music queue rows patched")
