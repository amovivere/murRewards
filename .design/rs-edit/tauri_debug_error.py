import pathlib
p=pathlib.Path(r"C:\Users\mur\Documents\deepseek-harness\default-workspace\reward-sounds-tauri\src-tauri\src\main.rs")
s=p.read_text(encoding="utf-8")
old='''            .build()
            .map_err(|err| -> Box<dyn std::error::Error> { Box::new(err) })?;'''
new='''            .build();
            let window = match window {
                Ok(window) => window,
                Err(err) => {
                    eprintln!("WEBVIEW BUILD ERROR: {err:?}");
                    return Err(Box::new(err) as Box<dyn std::error::Error>);
                }
            };'''
assert old in s
s=s.replace(old,new)
p.write_text(s,encoding="utf-8")
print("debug error")