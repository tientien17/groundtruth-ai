# Interactive release pipeline for GroundTruth Local.
# Usage: pwsh -NoProfile -File scripts/release.ps1 [-Version 0.1.0] [-DryRun] [-SkipTests] [-SkipBuild]

param(
    [string]$Version,
    [switch]$DryRun,
    [switch]$SkipTests,
    [switch]$SkipBuild
)

$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
$changelogPath = Join-Path $repoRoot "CHANGELOG.md"
$userFragmentsDir = Join-Path $repoRoot "changelog/unreleased/user"
$devFragmentsDir = Join-Path $repoRoot "changelog/unreleased/dev"
$installerDir = Join-Path $repoRoot "apps/tauri/src-tauri/target/release/bundle/nsis"
$releaseDate = Get-Date -Format "yyyy-MM-dd"

function Write-Gate {
    param([string]$Name)
    Write-Host ""
    Write-Host "==> $Name" -ForegroundColor Cyan
}

function Invoke-ReleaseCommand {
    param(
        [string]$Command,
        [string[]]$Arguments
    )

    $display = "$Command $($Arguments -join ' ')".Trim()
    if ($DryRun) {
        Write-Host "[dry-run] Would run: $display"
        return
    }

    Write-Host "Running: $display"
    & $Command @Arguments
    if ($LASTEXITCODE -ne 0) {
        throw "Command failed ($LASTEXITCODE): $display"
    }
}

function Read-JsonVersion {
    param([string]$RelativePath)

    $path = Join-Path $repoRoot $RelativePath
    if (-not (Test-Path -LiteralPath $path)) {
        throw "Version file not found: $RelativePath"
    }

    $json = Get-Content -LiteralPath $path -Raw | ConvertFrom-Json
    if (-not $json.version) {
        throw "Version not found in $RelativePath"
    }

    return [string]$json.version
}

function Read-RegexVersion {
    param(
        [string]$RelativePath,
        [string]$Pattern
    )

    $path = Join-Path $repoRoot $RelativePath
    if (-not (Test-Path -LiteralPath $path)) {
        throw "Version file not found: $RelativePath"
    }

    $content = Get-Content -LiteralPath $path -Raw
    $match = [regex]::Match($content, $Pattern, [System.Text.RegularExpressions.RegexOptions]::Multiline)
    if (-not $match.Success) {
        throw "Version not found in $RelativePath"
    }

    return $match.Groups[1].Value
}

function Get-ReleaseVersion {
    $versions = @(
        [pscustomobject]@{ Path = "package.json"; Version = Read-JsonVersion "package.json" }
        [pscustomobject]@{ Path = "apps/frontend/package.json"; Version = Read-JsonVersion "apps/frontend/package.json" }
        [pscustomobject]@{ Path = "apps/tauri/package.json"; Version = Read-JsonVersion "apps/tauri/package.json" }
        [pscustomobject]@{ Path = "apps/tauri/src-tauri/Cargo.toml"; Version = Read-RegexVersion "apps/tauri/src-tauri/Cargo.toml" '^version\s*=\s*"([^"]+)"' }
        [pscustomobject]@{ Path = "apps/tauri/src-tauri/tauri.conf.json"; Version = Read-JsonVersion "apps/tauri/src-tauri/tauri.conf.json" }
        [pscustomobject]@{ Path = "apps/sidecar/pyproject.toml"; Version = Read-RegexVersion "apps/sidecar/pyproject.toml" '^version\s*=\s*"([^"]+)"' }
    )

    $expectedVersion = $Version
    if (-not $expectedVersion) {
        $expectedVersion = $versions[0].Version
    }

    foreach ($entry in $versions) {
        Write-Host "  $($entry.Path): $($entry.Version)"
        if ($entry.Version -ne $expectedVersion) {
            throw "Version mismatch in $($entry.Path): expected $expectedVersion, found $($entry.Version)"
        }
    }

    return $expectedVersion
}

function Get-FragmentText {
    param([string]$Directory)

    if (-not (Test-Path -LiteralPath $Directory)) {
        throw "Fragment directory not found: $Directory"
    }

    $files = Get-ChildItem -LiteralPath $Directory -File -Filter "*.md" | Where-Object { $_.Name -ne ".gitkeep" } | Sort-Object Name
    if (-not $files) {
        return @("- No changes recorded")
    }

    $lines = New-Object System.Collections.Generic.List[string]
    foreach ($file in $files) {
        $content = Get-Content -LiteralPath $file.FullName
        foreach ($line in $content) {
            if ($line.Trim().Length -gt 0) {
                $lines.Add($line)
            }
        }
    }

    if ($lines.Count -eq 0) {
        return @("- No changes recorded")
    }

    return $lines.ToArray()
}

function Update-Changelog {
    param([string]$ReleaseVersion)

    if (-not (Test-Path -LiteralPath $changelogPath)) {
        throw "CHANGELOG.md not found"
    }

    $userLines = Get-FragmentText $userFragmentsDir
    $devLines = Get-FragmentText $devFragmentsDir
    $existing = Get-Content -LiteralPath $changelogPath -Raw
    $releaseBlock = @(
        "## [Unreleased]"
        ""
        "### User-Facing Changes"
        ""
        "### Developer-Facing Changes"
        ""
        "---"
        ""
        "## [$ReleaseVersion] - $releaseDate"
        ""
        "### User-Facing Changes"
        ""
        $userLines
        ""
        "### Developer-Facing Changes"
        ""
        $devLines
        ""
        "---"
    ) -join [Environment]::NewLine

    $updated = $existing -replace '## \[Unreleased\][\s\S]*?---', [System.Text.RegularExpressions.Regex]::Escape("__RELEASE_BLOCK__")
    $updated = $updated.Replace([System.Text.RegularExpressions.Regex]::Escape("__RELEASE_BLOCK__"), $releaseBlock)

    if ($DryRun) {
        Write-Host "[dry-run] Would compile changelog fragments into CHANGELOG.md"
        return
    }

    Set-Content -LiteralPath $changelogPath -Value $updated -NoNewline
}

function Get-Installer {
    $installers = @()
    if (Test-Path -LiteralPath $installerDir) {
        $installers = @(Get-ChildItem -LiteralPath $installerDir -File -Filter "*.exe" | Sort-Object LastWriteTime -Descending)
    }

    if ($installers.Count -eq 0) {
        if ($DryRun -or $SkipBuild) {
            Write-Host "[dry-run] Installer not present yet; expected at apps/tauri/src-tauri/target/release/bundle/nsis/*.exe"
            return $null
        }
        throw "NSIS installer not found at $installerDir/*.exe"
    }

    if ($installers.Count -gt 1) {
        Write-Host "Multiple installers found; using newest: $($installers[0].Name)" -ForegroundColor Yellow
    }

    Write-Host "Installer: $($installers[0].FullName)"
    return $installers[0]
}

function Write-Checksum {
    param([System.IO.FileInfo]$Installer)

    if (-not $Installer) {
        Write-Host "[dry-run] Would generate SHA256 checksum after installer exists"
        return $null
    }

    $checksumPath = "$($Installer.FullName).sha256"
    $hash = Get-FileHash -LiteralPath $Installer.FullName -Algorithm SHA256
    $line = "$($hash.Hash)  $($Installer.Name)"

    if ($DryRun) {
        Write-Host "[dry-run] Would write checksum: $checksumPath"
        Write-Host "[dry-run] $line"
        return $checksumPath
    }

    Set-Content -LiteralPath $checksumPath -Value $line
    Write-Host "Checksum: $checksumPath"
    return $checksumPath
}

function Clear-Fragments {
    $fragmentFiles = @()
    foreach ($dir in @($userFragmentsDir, $devFragmentsDir)) {
        $fragmentFiles += @(Get-ChildItem -LiteralPath $dir -File -Filter "*.md" | Where-Object { $_.Name -ne ".gitkeep" })
    }

    if ($fragmentFiles.Count -eq 0) {
        Write-Host "No fragments to clean."
        return
    }

    foreach ($file in $fragmentFiles) {
        if ($DryRun) {
            Write-Host "[dry-run] Would remove fragment: $($file.FullName)"
        }
        else {
            Remove-Item -LiteralPath $file.FullName
        }
    }
}

function Invoke-CommitAndTag {
    param([string]$ReleaseVersion)

    $tagName = "v$ReleaseVersion"
    if ($DryRun) {
        Write-Host "[dry-run] Would prompt for git commit and tag $tagName"
        return
    }

    $commitAnswer = Read-Host "Create release commit for $tagName? [y/N]"
    if ($commitAnswer -match '^(y|yes)$') {
        Invoke-ReleaseCommand "git" @("add", "CHANGELOG.md", "changelog/unreleased", "apps/tauri/src-tauri/target/release/bundle/nsis")
        Invoke-ReleaseCommand "git" @("commit", "-m", "Release $tagName")
    }
    else {
        Write-Host "Skipping release commit."
    }

    $tagAnswer = Read-Host "Create annotated tag $tagName? [y/N]"
    if ($tagAnswer -match '^(y|yes)$') {
        Invoke-ReleaseCommand "git" @("tag", "-a", $tagName, "-m", "Release $tagName")
    }
    else {
        Write-Host "Skipping release tag."
    }

    Write-Host "Push skipped by design. Run git push and git push --tags manually after review."
}

Push-Location $repoRoot
try {
    Write-Gate "1/10 Preflight"
    foreach ($path in @("package.json", "apps/frontend/package.json", "apps/tauri/package.json", "apps/tauri/src-tauri/Cargo.toml", "apps/tauri/src-tauri/tauri.conf.json", "apps/sidecar/pyproject.toml", "CHANGELOG.md")) {
        if (-not (Test-Path -LiteralPath (Join-Path $repoRoot $path))) {
            throw "Required file missing: $path"
        }
    }
    if (-not (Get-Command pnpm -ErrorAction SilentlyContinue)) { throw "pnpm not found on PATH" }
    if (-not (Get-Command git -ErrorAction SilentlyContinue)) { throw "git not found on PATH" }
    Write-Host "Preflight OK."

    Write-Gate "2/10 Version check"
    $releaseVersion = Get-ReleaseVersion
    Write-Host "Release version: $releaseVersion"

    Write-Gate "3/10 Fragment compilation"
    Update-Changelog $releaseVersion
    Write-Host "Changelog ready."

    Write-Gate "4/10 Test gate"
    if ($SkipTests) { Write-Host "Tests skipped by -SkipTests." } else { Invoke-ReleaseCommand "pnpm" @("test") }

    Write-Gate "5/10 Build gate"
    if ($SkipBuild) { Write-Host "Build skipped by -SkipBuild." } else { Invoke-ReleaseCommand "pnpm" @("bundle") }

    Write-Gate "6/10 Artifact verification"
    $installer = Get-Installer

    Write-Gate "7/10 Checksum generation"
    $checksumPath = Write-Checksum $installer

    Write-Gate "8/10 Fragment cleanup"
    Clear-Fragments

    Write-Gate "9/10 Interactive commit/tag"
    Invoke-CommitAndTag $releaseVersion

    Write-Gate "10/10 Post-release report"
    Write-Host "Release pipeline complete for v$releaseVersion."
    Write-Host "Installer: $(if ($installer) { $installer.FullName } else { 'pending build' })"
    Write-Host "Checksum: $(if ($checksumPath) { $checksumPath } else { 'pending build' })"
    Write-Host "Next: review git diff, then push commit/tag manually if created."
}
finally {
    Pop-Location
}
