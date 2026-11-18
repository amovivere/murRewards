# Запуск статического сервера для прототипов (нужен React-сборке).
# Из папки .design/prototypes:  .\start-server.ps1  (или python -m http.server 8777)
param([int]$Port = 8777)
Set-Location $PSScriptRoot
python -m http.server $Port --bind 127.0.0.1 --directory $PSScriptRoot
