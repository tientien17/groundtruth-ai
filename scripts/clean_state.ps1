<#
.SYNOPSIS
    Backup, clear, and restore GroundTruth Local app state for repeatable clean runs.

.DESCRIPTION
    This script manages three scopes of GroundTruth local data:

    1. Global storage  : ~/.groundtruth/local/  (project.sqlite, provider_config.json)
    2. Project dirs    : User-specified <name>.gtl/ folders (project DB + documents,
                         takeoff snapshots, exports, audit logs, RAG data)
    3. Tauri app data  : %APPDATA%/com.groundtruth.local/ (browser localStorage, config)

    Actions:
      - backup   : Snapshot all three scopes into a timestamped archive dir
      - clear    : Remove current state (after backup)
      - restore  : Restore from a previously saved backup
      - status   : Show current storage state without modifying anything

.PARAMETER Action
    One of: backup, clear, restore, status

.PARAMETER BackupDir
    Directory where backups are stored. Default: scripts/.clean-state-backups/

.PARAMETER BackupName
    Specific backup folder name to restore from (when using restore action).
    If omitted, the most recent backup is used.

.PARAMETER Scope
    Which scope(s) to operate on: global, projects, tauri, all (default: all)

.EXAMPLE
    pwsh -File scripts/clean_state.ps1 -Action status
    pwsh -File scripts/clean_state.ps1 -Action backup
    pwsh -File scripts/clean_state.ps1 -Action clear
    pwsh -File scripts/clean_state.ps1 -Action restore
    pwsh -File scripts/clean_state.ps1 -Action backup -Scope global
    pwsh -File scripts/clean_state.ps1 -Action restore -BackupName "cleanstate-20260517-143022"
#>

param(
    [Parameter(Mandatory)]
    [ValidateSet("backup", "clear", "restore", "status")]
    [string]$Action,

    [string]$BackupDir = "",

    [string]$BackupName = "",

    [ValidateSet("global", "projects", "tauri", "all")]
    [string]$Scope = "all"
)

$ErrorActionPreference = "Stop"

# ── Paths ─────────────────────────────────────────────────────────────
$repoRoot  = Split-Path -Parent $PSScriptRoot
$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"

# Resolve user home (PowerShell-safe across Windows)
$userProfile = [Environment]::GetFolderPath("UserProfile")
$globalStorage       = Join-Path $userProfile ".groundtruth" "local"
$tauriAppData        = Join-Path $env:APPDATA "com.groundtruth.local"
$defaultBackupRoot   = Join-Path $PSScriptRoot ".clean-state-backups"
if ($BackupDir -eq "") { $BackupDir = $defaultBackupRoot }

# ── Helper functions ─────────────────────────────────────────────────

function Write-Step($msg) {
    Write-Host ">>> $msg" -ForegroundColor Cyan
}

function Write-Ok($msg) {
    Write-Host "  OK  $msg" -ForegroundColor Green
}

function Write-Warn($msg) {
    Write-Host "  WARN $msg" -ForegroundColor Yellow
}

function Test-ScopeRequested($s) {
    return ($Scope -eq "all") -or ($Scope -eq $s)
}

function Get-BackupDirs {
    # Return backup folders sorted newest-first
    if (-not (Test-Path -LiteralPath $BackupDir)) { return @() }
    return Get-ChildItem -LiteralPath $BackupDir -Directory `
        | Where-Object { $_.Name -like "cleanstate-*" } `
        | Sort-Object LastWriteTime -Descending
}

function Resolve-TargetBackup {
    if ($BackupName -ne "") {
        $p = Join-Path $BackupDir $BackupName
        if (-not (Test-Path -LiteralPath $p)) {
            throw "Backup folder not found: $p"
        }
        return $p
    }
    $dirs = Get-BackupDirs
    if ($dirs.Count -eq 0) {
        throw "No backups found in $BackupDir"
    }
    return $dirs[0].FullName
}

# ── Status ────────────────────────────────────────────────────────────

function Show-Status {
    Write-Step "GROUNDTRUTH LOCAL STATE STATUS"
    Write-Host ""

    # Global storage
    Write-Step "Global storage: $globalStorage"
    if (Test-Path -LiteralPath $globalStorage) {
        $items = Get-ChildItem -LiteralPath $globalStorage
        if ($items.Count -eq 0) {
            Write-Ok "Directory exists but is empty"
        } else {
            foreach ($item in $items) {
                $size = if ($item.Length) { "$([math]::Round($item.Length / 1KB, 1)) KB" } else { "(dir)" }
                Write-Host "    $($item.Name)  $size"
            }
        }
    } else {
        Write-Warn "Directory does not exist"
    }
    Write-Host ""

    # Tauri app data
    Write-Step "Tauri app data: $tauriAppData"
    if (Test-Path -LiteralPath $tauriAppData) {
        $items = Get-ChildItem -LiteralPath $tauriAppData -Recurse -File
        $totalSize = ($items | Measure-Object -Property Length -Sum).Sum
        $itemCount = @($items).Count
        Write-Host "    $itemCount files, $([math]::Round($totalSize / 1KB, 1)) KB total"
    } else {
        Write-Warn "Directory does not exist"
    }
    Write-Host ""

    # Project dirs
    Write-Step "Project directories (.gtl)"
    $globs = Get-ChildItem -Path "$userProfile" -Filter "*.gtl" -Directory -ErrorAction SilentlyContinue
    $globs += Get-ChildItem -Path "$env:LOCALAPPDATA" -Filter "*.gtl" -Directory -ErrorAction SilentlyContinue
    if ($globs.Count -eq 0) {
        Write-Ok "No .gtl project directories found"
    } else {
        foreach ($g in $globs) {
            Write-Host "    $($g.FullName)"
        }
    }
    Write-Host ""

    # Backup dir
    Write-Step "Backup directory: $BackupDir"
    $backups = Get-BackupDirs
    if ($backups.Count -eq 0) {
        Write-Ok "No backups found"
    } else {
        Write-Host "    $($backups.Count) backup(s) available:"
        foreach ($b in $backups) {
            Write-Host "      $($b.Name)  ($($b.LastWriteTime))"
        }
    }
}

# ── Backup ────────────────────────────────────────────────────────────

function Invoke-Backup {
    $destRoot = Join-Path $BackupDir "cleanstate-$timestamp"
    Write-Step "Backing up GroundTruth state to: $destRoot"
    New-Item -ItemType Directory -Path $destRoot -Force | Out-Null

    if (Test-ScopeRequested "global" -and (Test-Path -LiteralPath $globalStorage)) {
        Write-Step "  Backing up global storage..."
        $dest = Join-Path $destRoot "global"
        Copy-Item -LiteralPath $globalStorage -Destination $dest -Recurse -Force
        $fileCount = @(Get-ChildItem -LiteralPath $dest -Recurse -File).Count
        Write-Ok "Global storage backed up ($fileCount files)"
    }

    if (Test-ScopeRequested "tauri" -and (Test-Path -LiteralPath $tauriAppData)) {
        Write-Step "  Backing up Tauri app data..."
        $dest = Join-Path $destRoot "tauri"
        Copy-Item -LiteralPath $tauriAppData -Destination $dest -Recurse -Force
        $fileCount = @(Get-ChildItem -LiteralPath $dest -Recurse -File).Count
        Write-Ok "Tauri app data backed up ($fileCount files)"
    }

    if (Test-ScopeRequested "projects") {
        Write-Step "  Searching for .gtl project directories..."
        $projectDirs = Get-ChildItem -Path "$userProfile" -Filter "*.gtl" -Directory -ErrorAction SilentlyContinue
        $projectDirs += Get-ChildItem -Path "$env:LOCALAPPDATA" -Filter "*.gtl" -Directory -ErrorAction SilentlyContinue

        if ($projectDirs.Count -eq 0) {
            Write-Ok "No .gtl project directories found"
        } else {
            $dest = Join-Path $destRoot "projects"
            New-Item -ItemType Directory -Path $dest -Force | Out-Null
            foreach ($proj in $projectDirs) {
                Write-Host "    Backing up $($proj.Name)..."
                Copy-Item -LiteralPath $proj.FullName -Destination (Join-Path $dest $proj.Name) -Recurse -Force
            }
            Write-Ok "Project dirs backed up"
        }
    }

    # Save a manifest
    $manifest = @{
        Timestamp = (Get-Date -Format "o")
        User      = $env:USERNAME
        Host      = $env:COMPUTERNAME
        Scopes    = @("global", "projects", "tauri") | Where-Object { Test-ScopeRequested $_ }
        GitHead   = &{ git -C $repoRoot rev-parse HEAD 2>$null } ?? "unknown"
    }
    $manifest | ConvertTo-Json | Set-Content -Path (Join-Path $destRoot "manifest.json") -Encoding utf8

    Write-Ok "Backup complete: $destRoot"
    return $destRoot
}

# ── Clear ─────────────────────────────────────────────────────────────

function Invoke-Clear {
    Write-Warn "CLEARING GroundTruth local state — this cannot be undone without a backup!"
    Write-Warn "Run 'pwsh -File scripts/clean_state.ps1 -Action backup' first if you haven't already."

    # Double-check: require at least one backup to exist before clearing
    $backups = Get-BackupDirs
    if ($backups.Count -eq 0) {
        Write-Warn "NO BACKUPS FOUND."
        $confirm = Read-Host "Are you SURE you want to clear state without a backup? (yes/NO)"
        if ($confirm -ne "yes") {
            Write-Host "Aborted." -ForegroundColor Yellow
            return
        }
    } else {
        $latest = $backups[0].Name
        Write-Ok "Latest backup available: $latest (from $($backups[0].LastWriteTime))"
    }

    $confirm = Read-Host "Type 'clear' to proceed with deletion: "
    if ($confirm -ne "clear") {
        Write-Host "Aborted." -ForegroundColor Yellow
        return
    }

    if (Test-ScopeRequested "global" -and (Test-Path -LiteralPath $globalStorage)) {
        Write-Step "  Clearing global storage: $globalStorage"
        Remove-Item -LiteralPath "$globalStorage\*" -Recurse -Force -ErrorAction SilentlyContinue
        Write-Ok "Global storage cleared"
    }

    if (Test-ScopeRequested "tauri" -and (Test-Path -LiteralPath $tauriAppData)) {
        Write-Step "  Clearing Tauri app data: $tauriAppData"
        Remove-Item -LiteralPath "$tauriAppData\*" -Recurse -Force -ErrorAction SilentlyContinue
        Write-Ok "Tauri app data cleared"
    }

    if (Test-ScopeRequested "projects") {
        Write-Step "  Searching for .gtl project directories..."
        $projectDirs = Get-ChildItem -Path "$userProfile" -Filter "*.gtl" -Directory -ErrorAction SilentlyContinue
        $projectDirs += Get-ChildItem -Path "$env:LOCALAPPDATA" -Filter "*.gtl" -Directory -ErrorAction SilentlyContinue

        if ($projectDirs.Count -eq 0) {
            Write-Ok "No .gtl project directories found"
        } else {
            foreach ($proj in $projectDirs) {
                Write-Host "    Removing $($proj.FullName)..."
                Remove-Item -LiteralPath $proj.FullName -Recurse -Force
            }
            Write-Ok "Project directories removed"
        }
    }

    Write-Ok "Clean state complete. Run 'pnpm dev' to start fresh."
}

# ── Restore ────────────────────────────────────────────────────────────

function Invoke-Restore {
    $sourceRoot = Resolve-TargetBackup
    Write-Step "Restoring from: $sourceRoot"

    # Global
    $globalBackup = Join-Path $sourceRoot "global"
    if (Test-ScopeRequested "global" -and (Test-Path -LiteralPath $globalBackup)) {
        Write-Step "  Restoring global storage..."
        New-Item -ItemType Directory -Path $globalStorage -Force | Out-Null
        Copy-Item -LiteralPath "$globalBackup\*" -Destination $globalStorage -Recurse -Force
        Write-Ok "Global storage restored"
    }

    # Tauri
    $tauriBackup = Join-Path $sourceRoot "tauri"
    if (Test-ScopeRequested "tauri" -and (Test-Path -LiteralPath $tauriBackup)) {
        Write-Step "  Restoring Tauri app data..."
        New-Item -ItemType Directory -Path $tauriAppData -Force | Out-Null
        Copy-Item -LiteralPath "$tauriBackup\*" -Destination $tauriAppData -Recurse -Force
        Write-Ok "Tauri app data restored"
    }

    # Projects
    $projectsBackup = Join-Path $sourceRoot "projects"
    if (Test-ScopeRequested "projects" -and (Test-Path -LiteralPath $projectsBackup)) {
        Write-Step "  Restoring project directories..."
        foreach ($projDir in (Get-ChildItem -LiteralPath $projectsBackup -Directory)) {
            $target = $projDir.FullName.Replace($projectsBackup, "").TrimStart("\")
            # Try restoring to same path if possible
            if (Test-Path -LiteralPath $projDir.FullName) {
                Copy-Item -LiteralPath $projDir.FullName -Destination $target -Recurse -Force
                Write-Host "    Restored: $target"
            } else {
                # Fallback: copy to a .gtl directory in user profile
                $fallback = Join-Path $userProfile $projDir.Name
                Copy-Item -LiteralPath $projDir.FullName -Destination $fallback -Recurse -Force
                Write-Warn "Could not determine original path; restored to $fallback"
            }
        }
        Write-Ok "Project directories restored"
    }

    Write-Ok "Restore complete from: $sourceRoot"
}

# ── Main ──────────────────────────────────────────────────────────────

Write-Host "═══════════════════════════════════════════════════" -ForegroundColor Magenta
Write-Host "  GroundTruth Local — Clean State Tool"              -ForegroundColor Magenta
Write-Host "═══════════════════════════════════════════════════" -ForegroundColor Magenta
Write-Host "  Action : $Action"
Write-Host "  Scope  : $Scope"
Write-Host "  Backup : $BackupDir"
Write-Host ""

switch ($Action) {
    "status"  { Show-Status }
    "backup"  { Invoke-Backup }
    "clear"   { Invoke-Clear }
    "restore" { Invoke-Restore }
}

Write-Host ""
Write-Host "Done." -ForegroundColor Green
