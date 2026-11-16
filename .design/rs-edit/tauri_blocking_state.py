import pathlib
p=pathlib.Path(r"C:\Users\mur\Documents\deepseek-harness\default-workspace\reward-sounds-tauri\src-tauri\src\core.rs")
s=p.read_text(encoding="utf-8")
s=s.replace("use std::sync::{Arc, Mutex, MutexGuard};","use std::sync::{Arc, Mutex, MutexGuard};\nuse std::time::{Duration, Instant};")
s=s.replace("""pub fn get_state(core: State<'_, Arc<AppCore>>) -> CoreView {
    core.drain_events();
    let view = core.view();""","""pub fn get_state(core: State<'_, Arc<AppCore>>) -> CoreView {
    core.drain_events();
    // Первый запрос после запуска может прийти раньше, чем Twitch ответит:
    // ждём загрузку наград, чтобы интерфейс сразу получил данные.
    let started = Instant::now();
    loop {
        let (loading, empty) = {
            let inner = core.lock();
            (inner.loading, inner.rewards.is_empty())
        };
        if !loading || !empty || started.elapsed() > Duration::from_millis(2500) {
            break;
        }
        std::thread::sleep(Duration::from_millis(40));
        core.drain_events();
    }
    let view = core.view();""")
p.write_text(s,encoding="utf-8")
print("blocking first state")