# Кладёт QuickJS рядом с yt-dlp.exe.
# Нужен yt-dlp 2026+ для решения YouTube JS-челленджей (включая видео 18+).
param(
    [string]$Version = "v0.18.0"
)

$ErrorActionPreference = "Stop"
$root = Split-Path $PSScriptRoot -Parent
$dist = Join-Path $root "dist"
$release = Join-Path $root "src-tauri\target\release"
$url = "https://github.com/quickjs-ng/quickjs/releases/download/$Version/qjs-windows-x86_64.exe"

New-Item -ItemType Directory -Path $dist -Force | Out-Null
$target = Join-Path $dist "qjs.exe"
Write-Host "Скачиваю $url"
Invoke-WebRequest -Uri $url -OutFile $target -UseBasicParsing

if (Test-Path $release) {
    Copy-Item $target (Join-Path $release "qjs.exe") -Force
}

& $target --version
Write-Host "QuickJS готов: $target"
