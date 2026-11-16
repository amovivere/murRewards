import pathlib, re
p=pathlib.Path(r"C:\Users\mur\AppData\Roaming\RewardSounds\config.toml")
s=p.read_text(encoding="utf-8")
s2=re.sub(r'(?m)^volume = .*$','volume = 0.42',s,count=1)
p.write_text(s2,encoding="utf-8")
print("volume set 0.42")