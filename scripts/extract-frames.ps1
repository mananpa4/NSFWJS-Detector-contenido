#Requires -Version 5.1
<#
.SYNOPSIS
  Extrae frames clave de un video (1 fps por defecto) para batch de moderacion.
  Espejo Windows de extract-frames.sh (misma semantica que ffmpeg.ts).
  Nota: sin tildes a proposito (compatibilidad PowerShell 5.1 sin BOM).
.EXAMPLE
  .\scripts\extract-frames.ps1 -VideoPath input.mp4 -Out out-dir\ -Fps 1
#>
param(
  [Parameter(Mandatory = $true)][string]$VideoPath,
  [Parameter(Mandatory = $true)][string]$Out,
  [int]$Fps = 1
)

New-Item -ItemType Directory -Force -Path $Out | Out-Null
& ffmpeg -y -i $VideoPath -vf "fps=$Fps" -q:v 3 (Join-Path $Out 'frame-%04d.jpg')
if ($LASTEXITCODE -ne 0) { throw "ffmpeg fallo con codigo $LASTEXITCODE" }
$frames = (Get-ChildItem -Path $Out -Filter 'frame-*.jpg').Count
Write-Output "Frames en $Out (fps=$Fps): $frames"
