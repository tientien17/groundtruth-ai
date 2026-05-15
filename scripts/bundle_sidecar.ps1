# Bundle Python sidecar using PyInstaller for Tauri on Windows.
# Usage: pwsh -File scripts/bundle_sidecar.ps1

$ErrorActionPreference = "Stop"

$appName = "sidecar"
$repoRoot = Split-Path -Parent $PSScriptRoot
$sidecarDir = Join-Path $repoRoot "apps/sidecar"
$distDir = Join-Path $repoRoot "apps/tauri/src-tauri/sidecars"
$targetTriple = "x86_64-pc-windows-msvc"
$exeName = "$appName-$targetTriple.exe"

Write-Host "Building sidecar for $targetTriple..."

New-Item -ItemType Directory -Force -Path $distDir | Out-Null

Push-Location $sidecarDir
try {
  uv pip install pyinstaller
  uv run pyinstaller --onefile --name "$appName-$targetTriple" --clean main.py
  Move-Item -Force -Path (Join-Path "dist" $exeName) -Destination (Join-Path $distDir $exeName)
}
finally {
  Pop-Location
}

Write-Host "Done! Sidecar bundled to $distDir"
