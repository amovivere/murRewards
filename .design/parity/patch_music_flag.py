import pathlib

p = pathlib.Path(r'F:\WorkSpaces\Mur rewards\reward-sounds-tauri\src-tauri\ui\js\rewards.js')
s = p.read_text(encoding='utf-8')

s = s.replace(
    "function actionsHtml(reward, view) {",
    "function isMusicReward(reward, view) {\n"
    "  return !!reward && !!view?.music && view.music.reward_id === reward.id;\n"
    "}\n\n"
    "function actionsHtml(reward, view) {",
    1,
)
s = s.replace("if (reward.music) {", "if (isMusicReward(reward, view)) {")
s = s.replace(
    "${reward.music ? '<span class=\"music-badge\">МУЗЫКА</span>' : ''}",
    "${isMusicReward(reward, view) ? '<span class=\"music-badge\">МУЗЫКА</span>' : ''}",
)
p.write_text(s, encoding='utf-8')
print('patched; occurrences:', s.count('isMusicReward'), '| reward.music:', s.count('reward.music'))
