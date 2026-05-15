$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
$destination = Join-Path $repoRoot "apps/tauri/src-tauri/resources/tesseract"
$source = "C:\Program Files\Tesseract-OCR"

if (-not (Test-Path -LiteralPath $source)) {
    throw "Tesseract install not found at $source. Install UB-Mannheim Tesseract first, then rerun this script."
}

New-Item -ItemType Directory -Path $destination -Force | Out-Null
New-Item -ItemType Directory -Path (Join-Path $destination "tessdata") -Force | Out-Null

Copy-Item -LiteralPath (Join-Path $source "tesseract.exe") -Destination $destination -Force
Get-ChildItem -LiteralPath $source -Filter "*.dll" | Copy-Item -Destination $destination -Force
Copy-Item -LiteralPath (Join-Path $source "tessdata/eng.traineddata") -Destination (Join-Path $destination "tessdata") -Force

$osd = Join-Path $source "tessdata/osd.traineddata"
if (Test-Path -LiteralPath $osd) {
    Copy-Item -LiteralPath $osd -Destination (Join-Path $destination "tessdata") -Force
}

$files = Get-ChildItem -LiteralPath $destination -Recurse -File
$totalSize = ($files | Measure-Object -Property Length -Sum).Sum
"Copied $($files.Count) Tesseract resource files to $destination ($([math]::Round($totalSize / 1MB, 1)) MB)."
