#!/usr/bin/env pwsh
<#
.SYNOPSIS
    Bootstrap the full GroundTruth development environment.
.DESCRIPTION
    Installs Rust (rustup), Node/pnpm dependencies, Python sidecar deps,
    and adds cargo to the user PATH so subsequent shells find it.
#>

$ErrorActionPreference = "Stop"
$rootDir = Split-Path -Parent $PSScriptRoot
$cargoBin = "$env:USERPROFILE\.cargo\bin"

# --- Rust / cargo ---
if (-not (Get-Command cargo -ErrorAction SilentlyContinue)) {
    Write-Host "[bootstrap] Installing Rust via rustup..." -ForegroundColor Cyan
    $url = "https://static.rust-lang.org/rustup/dist/x86_64-pc-windows-gnu/rustup-init.exe"
    $out = "$env:TEMP\rustup-init.exe"
    if (-not (Test-Path $out)) { Invoke-WebRequest -Uri $url -OutFile $out }
    & $out -y --default-toolchain stable --profile minimal
    # Add to PATH for this session
    $env:Path = "$cargoBin;$env:Path"
    Write-Host "[bootstrap] Rust $(rustc --version) installed" -ForegroundColor Green
} else {
    Write-Host "[bootstrap] Rust $(rustc --version) already present" -ForegroundColor Green
}

# Ensure cargo is on the user PATH persistently
$userPath = [Environment]::GetEnvironmentVariable("Path", "User")
if ($userPath -notlike "*$cargoBin*") {
    $newPath = "$cargoBin;$userPath"
    [Environment]::SetEnvironmentVariable("Path", $newPath, "User")
    Write-Host "[bootstrap] Added $cargoBin to user PATH" -ForegroundColor Yellow
}

# --- Node / pnpm dependencies ---
Write-Host "[bootstrap] Installing Node dependencies..." -ForegroundColor Cyan
& pnpm install
if ($LASTEXITCODE -ne 0) { throw "pnpm install failed" }
Write-Host "[bootstrap] Node dependencies installed" -ForegroundColor Green

# --- Python sidecar ---
Write-Host "[bootstrap] Setting up Python sidecar..." -ForegroundColor Cyan
Push-Location "$rootDir\apps\sidecar"
try {
    # Install hatchling wheel config if missing
    $pyproject = Get-Content pyproject.toml -Raw
    if ($pyproject -notmatch '\[tool\.hatch\.build\.targets\.wheel\]') {
        $config = @"

[tool.hatch.build.targets.wheel]
packages = ["api", "services"]
"@
        Add-Content -Path pyproject.toml -Value $config
        Write-Host "[bootstrap] Added hatchling wheel config to pyproject.toml" -ForegroundColor Yellow
    }

    & uv sync
    if ($LASTEXITCODE -ne 0) { throw "uv sync failed" }
    Write-Host "[bootstrap] Python sidecar ready" -ForegroundColor Green
}
finally { Pop-Location }

# --- Tauri resource placeholders ---
Write-Host "[bootstrap] Creating Tauri resource placeholders..." -ForegroundColor Cyan
$resourcesDir = "$rootDir\apps\tauri\src-tauri\resources"
if (-not (Test-Path "$resourcesDir\OllamaSetup.exe")) {
    New-Item -ItemType File -Path "$resourcesDir\OllamaSetup.exe" -Force | Out-Null
    Write-Host "[bootstrap] Created OllamaSetup.exe placeholder" -ForegroundColor Yellow
}

# --- Build sidecar binary for Tauri ---
Write-Host "[bootstrap] Building sidecar binary (PyInstaller)..." -ForegroundColor Cyan
& "$rootDir\scripts\bundle_sidecar.ps1"
if ($LASTEXITCODE -ne 0) { throw "Sidecar bundle failed" }
Write-Host "[bootstrap] Sidecar binary built" -ForegroundColor Green

Write-Host "[bootstrap] Done! Run 'pnpm dev' to launch the desktop app." -ForegroundColor Green
