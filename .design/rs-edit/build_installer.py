import pathlib, shutil, os
ws=pathlib.Path(r"C:\Users\mur\Documents\deepseek-harness\default-workspace")
stage=ws/".tmp"/"rs-install-stage"
if stage.exists(): shutil.rmtree(stage)
stage.mkdir(parents=True)
src=ws/"reward-sounds-tauri"/"src-tauri"/"target"/"release"/"reward-sounds-tauri.exe"
shutil.copy2(src, stage/"Reward Sounds.exe")
shutil.copy2(ws/"reward-sounds-tauri"/"dist"/"yt-dlp.exe", stage/"yt-dlp.exe")
install=r'''@echo off
setlocal
set "DEST=%LOCALAPPDATA%\Programs\Reward Sounds"
if not exist "%DEST%" mkdir "%DEST%"
copy /Y "%~dp0Reward Sounds.exe" "%DEST%\Reward Sounds.exe" >nul
copy /Y "%~dp0yt-dlp.exe" "%DEST%\yt-dlp.exe" >nul
powershell -NoProfile -ExecutionPolicy Bypass -Command "$ws=New-Object -ComObject WScript.Shell; $exe=Join-Path $env:LOCALAPPDATA 'Programs\Reward Sounds\Reward Sounds.exe'; foreach($dir in @([Environment]::GetFolderPath('Programs'),[Environment]::GetFolderPath('Desktop'))){ $lnk=Join-Path $dir 'Reward Sounds.lnk'; $s=$ws.CreateShortcut($lnk); $s.TargetPath=$exe; $s.WorkingDirectory=Split-Path $exe; $s.IconLocation=$exe; $s.Save() }; Start-Process -FilePath $exe"
endlocal
'''
(stage/"install.cmd").write_text(install, encoding="utf-8")
readme='''Reward Sounds (Tauri) — установка

Приложение устанавливается в %LOCALAPPDATA%\\Programs\\Reward Sounds.
Ярлыки создаются на рабочем столе и в меню «Пуск».

Настройки и авторизация общие с прежней версией: %APPDATA%\\RewardSounds.
Для корректной работы рядом с Reward Sounds.exe должен лежать yt-dlp.exe.
'''
(stage/"README.txt").write_text(readme, encoding="utf-8")

sed=f'''[Version]
Class=IEXPRESS
SEDVersion=3
[Options]
PackagePurpose=InstallApp
ShowInstallProgramWindow=1
HideExtractAnimation=1
UseLongFileName=1
InsideCompressed=0
CAB_FixedSize=0
CAB_ResvCodeSigning=0
RebootMode=N
InstallPrompt=Установить Reward Sounds?
DisplayLicense=
FinishMessage=Reward Sounds установлен. Запускаем...
TargetName={ws}\\.tmp\\Reward Sounds Setup.exe
FriendlyName=Reward Sounds
AppLaunched=install.cmd
PostInstallCmd=<None>
AdminQuietInstCmd=
UserQuietInstCmd=
SourceFiles=SourceFiles
[Strings]
FILE0=install.cmd
FILE1=Reward Sounds.exe
FILE2=yt-dlp.exe
FILE3=README.txt
[SourceFiles]
SourceFiles0={stage}\\
[SourceFiles0]
%FILE0%=
%FILE1%=
%FILE2%=
%FILE3%=
'''
(stage/"install.sed").write_text(sed, encoding="utf-8")
print(stage)