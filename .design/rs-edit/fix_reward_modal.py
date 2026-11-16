import pathlib
# backend: reward_id музыки
p=pathlib.Path(r"C:\Users\mur\Documents\deepseek-harness\default-workspace\reward-sounds-tauri\src-tauri\src\core.rs")
s=p.read_text(encoding="utf-8")
s=s.replace("""    pub reward_title: String,
    pub reward_cost: u32,
    pub max_queue: usize,""","""    pub reward_title: String,
    pub reward_cost: u32,
    pub reward_id: String,
    pub max_queue: usize,""")
s=s.replace("""        reward_title: settings.music.reward_title.clone(),
        reward_cost: settings.music.reward_cost,
        max_queue: settings.music.max_queue,""","""        reward_title: settings.music.reward_title.clone(),
        reward_cost: settings.music.reward_cost,
        reward_id: settings.music.reward_id.clone(),
        max_queue: settings.music.max_queue,""")
p.write_text(s,encoding="utf-8")
# frontend: цвет текстом, input required по музыке
p=pathlib.Path(r"C:\Users\mur\Documents\deepseek-harness\default-workspace\reward-sounds-tauri\src-tauri\ui\app.js")
s=p.read_text(encoding="utf-8")
s=s.replace('<input class="input reward-input" id="reward-color" type="color" value="${reward?.color || \'#8B00FF\'}">',
            '<input class="input reward-input" id="reward-color" value="${reward?.color || \'#8B00FF\'}" maxlength="7" placeholder="#8B00FF">')
s=s.replace('<label class="reward-check"><input type="checkbox" id="reward-input-required" ${reward?.requires_input ? \'checked\' : \'\'}> Нужен ввод текста от зрителя</label>',
            '<label class="reward-check"><input type="checkbox" id="reward-input-required" ${editing && state.core?.music?.reward_id === reward.id ? \'checked\' : \'\'}> Нужен ввод текста от зрителя</label>')
p.write_text(s,encoding="utf-8")
print("color text + music input default")