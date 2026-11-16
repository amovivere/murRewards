import pathlib
p=pathlib.Path(r"C:\Users\mur\Documents\deepseek-harness\default-workspace\reward-sounds-tauri\src-tauri\ui\app.js")
s=p.read_text(encoding="utf-8")
s=s.replace("    updateRewardCounts(view);\n    applyRewardFilters();\n    bindSlidersIn(grid);",
            "    updateRewardCounts(view);\n    window.RS.applyRewardFilters?.();\n    bindSlidersIn(grid);")
s=s.replace("    applyStatusToDom();\n    setTopVolume(state.volume);",
            "    applyStatusToDom();\n    const topSlider = $('#top-volume');\n    if (!topSlider.classList.contains('dragging')) setTopVolume(state.volume);")
p.write_text(s,encoding="utf-8")
print("js fixes")