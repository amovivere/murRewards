import pathlib
p=pathlib.Path(r"C:\Users\mur\Documents\deepseek-harness\default-workspace\reward-sounds-tauri\src-tauri\src\core.rs")
s=p.read_text(encoding="utf-8")
s=s.replace("""    pub reward_title: String,
    pub reward_cost: u32,
    pub max_queue: usize,
}""","""    pub reward_title: String,
    pub reward_cost: u32,
    pub max_queue: usize,
    pub volume: f64,
}""")
s=s.replace("""        reward_title: settings.music.reward_title.clone(),
        reward_cost: settings.music.reward_cost,
        max_queue: settings.music.max_queue,
    }""","""        reward_title: settings.music.reward_title.clone(),
        reward_cost: settings.music.reward_cost,
        max_queue: settings.music.max_queue,
        volume: settings.music.music_volume,
    }""")
p.write_text(s,encoding="utf-8")
print("music volume in view")