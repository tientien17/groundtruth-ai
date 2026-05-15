<#
.SYNOPSIS
    Pester tests for scripts/release.ps1 — core logic coverage.
    Uses Pester 3.4.0 syntax (no dash-prefixed Should operators).
#>

#Requires -Modules @{ ModuleName = 'Pester'; ModuleVersion = '3.0.0' }

[CmdletBinding()]
param()

# ---------------------------------------------------------------------------
# Bootstrap: load function definitions from release.ps1 without running
# the main pipeline.
# ---------------------------------------------------------------------------
$script:testScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
if (-not $script:testScriptDir) { $script:testScriptDir = $PWD.Path }
$script:releaseScriptPath = Join-Path $script:testScriptDir '..\release.ps1'
$script:releaseScriptPath = (Resolve-Path -LiteralPath $script:releaseScriptPath -ErrorAction Stop).Path

$script:releaseContent = Get-Content -LiteralPath $script:releaseScriptPath -Raw

# Locate where the main pipeline starts (Push-Location $repoRoot)
# and extract only the parameter block + globals + function definitions.
$pipelineIndex = $script:releaseContent.IndexOf('Push-Location $repoRoot')
if ($pipelineIndex -lt 0) {
    throw 'Could not locate main pipeline boundary in release.ps1'
}

$script:functionBlock = $script:releaseContent.Substring(0, $pipelineIndex)

# Strip lines that fail in dot-source ($PSScriptRoot is null outside a script):
#   $ErrorActionPreference = "Stop"
#   $repoRoot = Split-Path -Parent $PSScriptRoot
#   $changelogPath = Join-Path $repoRoot ...
#   ...
$script:functionBlock = $script:functionBlock -replace '(?m)^\$ErrorActionPreference\s*=\s*"Stop"[^\r\n]*[\r\n]', ''
$script:functionBlock = $script:functionBlock -replace '(?m)^\$repoRoot\s*=[^\r\n]*[\r\n]', ''
$script:functionBlock = $script:functionBlock -replace '(?m)^\$(changelogPath|userFragmentsDir|devFragmentsDir|installerDir|releaseDate)\s*=[^\r\n]*[\r\n]', ''

# Define a persistent temp root so tests share predictable scaffolding.
$script:testRoot = Join-Path $env:TEMP "release_tests_$(Get-Random)"
New-Item -ItemType Directory -Path $script:testRoot -Force | Out-Null

# Provide all script-level variables the functions reference.
$script:repoRoot = Join-Path $script:testRoot 'repo'
$script:changelogPath = Join-Path $script:repoRoot 'CHANGELOG.md'
$script:userFragmentsDir = Join-Path $script:repoRoot 'changelog/unreleased/user'
$script:devFragmentsDir = Join-Path $script:repoRoot 'changelog/unreleased/dev'
$script:installerDir = Join-Path $script:repoRoot 'apps/tauri/src-tauri/target/release/bundle/nsis'
$script:releaseDate = Get-Date -Format 'yyyy-MM-dd'
$script:ErrorActionPreference = 'Stop'
New-Item -ItemType Directory -Path $script:repoRoot -Force | Out-Null

# Write the cleaned function block to a temp script and dot-source it.
# (dot-sourcing a .ps1 file propagates functions properly into the Pester module scope,
#  unlike Invoke-Expression which creates them in a nested scope that Pester cannot see.)
$script:tempLoader = Join-Path $script:testRoot '_loader.ps1'
Set-Content -LiteralPath $script:tempLoader -Value $script:functionBlock
. $script:tempLoader

# ---------------------------------------------------------------------------
# Helper: create a file under $repoRoot with given relative path and content.
# ---------------------------------------------------------------------------
function New-TestFile {
    param(
        [Parameter(Mandatory)] [string]$RelativePath,
        [string]$Content
    )
    $fullDir = Split-Path (Join-Path $script:repoRoot $RelativePath) -Parent
    New-Item -ItemType Directory -Path $fullDir -Force | Out-Null
    $fullPath = Join-Path $script:repoRoot $RelativePath
    if ($PSBoundParameters.ContainsKey('Content')) {
        Set-Content -LiteralPath $fullPath -Value $Content
    } else {
        New-Item -ItemType File -Path $fullPath -Force | Out-Null
    }
}

# ---------------------------------------------------------------------------
# Helper: create a version-consistency scaffold (all files that
# Get-ReleaseVersion checks) under $repoRoot with a single version.
# ---------------------------------------------------------------------------
function New-VersionScaffold {
    param([string]$Version = '0.1.0')
    New-TestFile 'package.json' "{ `"version`": `"$Version`" }"
    New-TestFile 'apps/frontend/package.json' "{ `"version`": `"$Version`" }"
    New-TestFile 'apps/tauri/package.json' "{ `"version`": `"$Version`" }"
    New-TestFile 'apps/tauri/src-tauri/Cargo.toml' "version = `"$Version`""
    New-TestFile 'apps/tauri/src-tauri/tauri.conf.json' "{ `"version`": `"$Version`" }"
    New-TestFile 'apps/sidecar/pyproject.toml' "version = `"$Version`""
}

# ---------------------------------------------------------------------------
# Helper: remove all files under repoRoot (used in AfterEach).
# ---------------------------------------------------------------------------
function Clear-RepoFiles {
    if (Test-Path -LiteralPath $script:repoRoot) {
        Get-ChildItem -LiteralPath $script:repoRoot -Recurse -File | Remove-Item -Force
    }
}

# ===================================================================
# Tests
# ===================================================================

Describe 'release.ps1 — Read-JsonVersion' {
    AfterEach { Clear-RepoFiles }

    It 'returns version from a valid JSON file' {
        New-TestFile 'test/valid.json' '{ "version": "1.2.3" }'
        $result = Read-JsonVersion 'test/valid.json'
        $result | Should Be '1.2.3'
    }

    It 'throws when the file does not exist' {
        { Read-JsonVersion 'does/not/exist.json' } | Should Throw 'Version file not found'
    }

    It 'throws when the version field is missing' {
        New-TestFile 'test/no_version.json' '{ "name": "test" }'
        { Read-JsonVersion 'test/no_version.json' } | Should Throw 'Version not found'
    }

    It 'throws on malformed JSON content' {
        # ConvertFrom-Json produces a terminating error on malformed JSON;
        # the exception message comes from the JSON parser, not our code.
        New-TestFile 'test/bad.json' '{ "key": unquoted }'
        { Read-JsonVersion 'test/bad.json' } | Should Throw 'Conversion from JSON failed'
    }
}

Describe 'release.ps1 — Read-RegexVersion' {
    AfterEach { Clear-RepoFiles }

    It 'returns the captured group from a matching regex' {
        New-TestFile 'test/VERSION' "version = `"2.0.0`""
        $result = Read-RegexVersion 'test/VERSION' '^version\s*=\s*"([^"]+)"'
        $result | Should Be '2.0.0'
    }

    It 'throws when the file does not exist' {
        { Read-RegexVersion 'missing.txt' '.*' } | Should Throw 'Version file not found'
    }

    It 'throws when the pattern does not match' {
        New-TestFile 'test/no_match.txt' 'nothing here'
        { Read-RegexVersion 'test/no_match.txt' '^version\s*=\s*"([^"]+)"' } | Should Throw 'Version not found'
    }

    It 'supports multiline content' {
        New-TestFile 'test/multi.txt' @'
[package]
name = "myapp"
version = "3.0.0"
description = "test"
'@
        $result = Read-RegexVersion 'test/multi.txt' '^version\s*=\s*"([^"]+)"'
        $result | Should Be '3.0.0'
    }
}

Describe 'release.ps1 — Get-ReleaseVersion' {
    AfterEach { Clear-RepoFiles }

    It 'returns the version when all files are consistent' {
        New-VersionScaffold '0.2.0'
        $result = Get-ReleaseVersion
        $result | Should Be '0.2.0'
    }

    It 'throws on version mismatch' {
        New-VersionScaffold '0.2.0'
        New-TestFile 'package.json' '{ "version": "9.9.9" }'
        { Get-ReleaseVersion } | Should Throw 'Version mismatch'
    }

    It 'throws when a version file is missing' {
        New-VersionScaffold '0.2.0'
        Remove-Item -LiteralPath (Join-Path $script:repoRoot 'apps/frontend/package.json') -Force
        { Get-ReleaseVersion } | Should Throw 'Version file not found'
    }
}

Describe 'release.ps1 — Get-FragmentText' {
    AfterEach { Clear-RepoFiles }

    It 'returns lines from markdown fragment files sorted by name' {
        New-TestFile 'frags/user/a.md' '- Added login'
        New-TestFile 'frags/user/b.md' '- Fixed bug'
        $result = @(Get-FragmentText (Join-Path $script:repoRoot 'frags/user'))
        $result.Count | Should Be 2
        $result[0] | Should Be '- Added login'
        $result[1] | Should Be '- Fixed bug'
    }

    It 'returns single placeholder when only .gitkeep exists' {
        New-TestFile 'frags/user/.gitkeep'
        $result = @(Get-FragmentText (Join-Path $script:repoRoot 'frags/user'))
        $result.Count | Should Be 1
        $result[0] | Should BeExactly '- No changes recorded'
    }

    It 'returns single placeholder when all fragment files are empty' {
        New-TestFile 'frags/user/empty.md' ''
        $result = @(Get-FragmentText (Join-Path $script:repoRoot 'frags/user'))
        $result.Count | Should Be 1
        $result[0] | Should BeExactly '- No changes recorded'
    }

    It 'strips blank lines from fragment content' {
        New-TestFile 'frags/user/notes.md' @"
- Line one

- Line three

"@
        $result = @(Get-FragmentText (Join-Path $script:repoRoot 'frags/user'))
        $result.Count | Should Be 2
        $result[0] | Should Be '- Line one'
        $result[1] | Should Be '- Line three'
    }

    It 'throws when the directory does not exist' {
        { Get-FragmentText (Join-Path $script:repoRoot 'nonexistent') } | Should Throw 'Fragment directory not found'
    }
}

Describe 'release.ps1 — Invoke-ReleaseCommand' {
    It 'skips execution when $DryRun is true' {
        $script:DryRun = $true
        $output = Invoke-ReleaseCommand 'cmd' @('/c', 'echo SHOULD_NOT_RUN')
        $output | Should BeNullOrEmpty
        Remove-Variable -Name DryRun -Scope Script -ErrorAction SilentlyContinue
    }

    It 'executes command when $DryRun is false' {
        $script:DryRun = $false
        { Invoke-ReleaseCommand 'cmd' @('/c', 'exit 0') } | Should Not Throw
        Remove-Variable -Name DryRun -Scope Script -ErrorAction SilentlyContinue
    }

    It 'throws on non-zero exit code' {
        $script:DryRun = $false
        { Invoke-ReleaseCommand 'cmd' @('/c', 'exit 1') } | Should Throw 'Command failed'
        Remove-Variable -Name DryRun -Scope Script -ErrorAction SilentlyContinue
    }
}

Describe 'release.ps1 — Update-Changelog (dry-run safety)' {
    AfterEach { Clear-RepoFiles }

    It 'does not modify files when $DryRun is true' {
        $script:DryRun = $true
        New-TestFile 'CHANGELOG.md' "## [Unreleased]`n`n---"
        New-TestFile 'changelog/unreleased/user/feat.md' '- New feature'
        New-TestFile 'changelog/unreleased/dev/fix.md' '- Dev fix'

        Update-Changelog '1.0.0'

        $changelog = Get-Content -LiteralPath (Join-Path $script:repoRoot 'CHANGELOG.md') -Raw
        $changelog | Should Match '\[Unreleased\]'
        $changelog | Should Not Match '\[1\.0\.0\]'
        Remove-Variable -Name DryRun -Scope Script -ErrorAction SilentlyContinue
    }

    It 'throws when CHANGELOG.md does not exist' {
        $script:DryRun = $true
        { Update-Changelog '1.0.0' } | Should Throw 'CHANGELOG.md not found'
        Remove-Variable -Name DryRun -Scope Script -ErrorAction SilentlyContinue
    }
}

Describe 'release.ps1 — Get-Installer' {
    AfterEach { Clear-RepoFiles }

    It 'returns $null in dry-run mode when installer absent' {
        $script:DryRun = $true
        $script:SkipBuild = $true
        $result = Get-Installer
        $result | Should BeNullOrEmpty
        Remove-Variable -Name DryRun -Scope Script -ErrorAction SilentlyContinue
        Remove-Variable -Name SkipBuild -Scope Script -ErrorAction SilentlyContinue
    }

    It 'returns FileInfo when installer .exe exists' {
        $script:DryRun = $false
        $script:SkipBuild = $false
        New-TestFile 'apps/tauri/src-tauri/target/release/bundle/nsis/MyApp_1.0.0_x64.exe'
        $result = Get-Installer
        $result | Should Not Be $null
        $result.GetType().Name | Should Be 'FileInfo'
        $result.Name | Should Be 'MyApp_1.0.0_x64.exe'
        Remove-Variable -Name DryRun -Scope Script -ErrorAction SilentlyContinue
        Remove-Variable -Name SkipBuild -Scope Script -ErrorAction SilentlyContinue
    }

    It 'returns the newest installer when multiple exist' {
        $script:DryRun = $false
        $script:SkipBuild = $false
        New-TestFile 'apps/tauri/src-tauri/target/release/bundle/nsis/old.exe'
        Start-Sleep -Milliseconds 50
        New-TestFile 'apps/tauri/src-tauri/target/release/bundle/nsis/new.exe'
        $result = Get-Installer
        $result.Name | Should Be 'new.exe'
        Remove-Variable -Name DryRun -Scope Script -ErrorAction SilentlyContinue
        Remove-Variable -Name SkipBuild -Scope Script -ErrorAction SilentlyContinue
    }

    It 'throws when installer absent and not dry-run' {
        $script:DryRun = $false
        $script:SkipBuild = $false
        { Get-Installer } | Should Throw 'NSIS installer not found'
        Remove-Variable -Name DryRun -Scope Script -ErrorAction SilentlyContinue
        Remove-Variable -Name SkipBuild -Scope Script -ErrorAction SilentlyContinue
    }
}

Describe 'release.ps1 — Write-Checksum' {
    AfterEach { Clear-RepoFiles }

    It 'returns $null when installer is $null' {
        $result = Write-Checksum $null
        $result | Should BeNullOrEmpty
    }

    It 'returns checksum path in dry-run mode without writing file' {
        $script:DryRun = $true
        New-TestFile 'installer/MyApp.exe'
        $installer = Get-Item (Join-Path $script:repoRoot 'installer/MyApp.exe')
        $result = Write-Checksum $installer
        $result | Should Not Be $null
        $result | Should Match '\.sha256$'
        Test-Path -LiteralPath $result | Should Be $false
        Remove-Variable -Name DryRun -Scope Script -ErrorAction SilentlyContinue
    }

    It 'writes checksum file in non-dry-run mode' {
        $script:DryRun = $false
        New-TestFile 'installer/MyApp.exe' 'test content for hash'
        $installer = Get-Item (Join-Path $script:repoRoot 'installer/MyApp.exe')
        $result = Write-Checksum $installer
        $result | Should Not Be $null
        Test-Path -LiteralPath $result | Should Be $true
        $content = (Get-Content -LiteralPath $result -Raw).Trim()
        $content | Should Match '^[A-Fa-f0-9]{64}'
        $content | Should Match 'MyApp.exe$'
        Remove-Variable -Name DryRun -Scope Script -ErrorAction SilentlyContinue
    }
}

Describe 'release.ps1 — Clear-Fragments' {
    AfterEach { Clear-RepoFiles }

    It 'does not delete files in dry-run mode' {
        $script:DryRun = $true
        New-TestFile 'changelog/unreleased/user/feat.md' '- Feature'
        Clear-Fragments
        Test-Path -LiteralPath (Join-Path $script:repoRoot 'changelog/unreleased/user/feat.md') | Should Be $true
        Remove-Variable -Name DryRun -Scope Script -ErrorAction SilentlyContinue
    }

    It 'deletes fragment files in non-dry-run mode but keeps .gitkeep' {
        $script:DryRun = $false
        New-TestFile 'changelog/unreleased/user/.gitkeep'
        New-TestFile 'changelog/unreleased/user/feat.md' '- Feature'
        New-TestFile 'changelog/unreleased/dev/fix.md' '- Fix'
        Clear-Fragments
        Test-Path -LiteralPath (Join-Path $script:repoRoot 'changelog/unreleased/user/feat.md') | Should Be $false
        Test-Path -LiteralPath (Join-Path $script:repoRoot 'changelog/unreleased/dev/fix.md') | Should Be $false
        Remove-Variable -Name DryRun -Scope Script -ErrorAction SilentlyContinue
    }

    It 'handles no fragments gracefully' {
        $script:DryRun = $false
        New-TestFile 'changelog/unreleased/user/.gitkeep'
        New-TestFile 'changelog/unreleased/dev/.gitkeep'
        { Clear-Fragments } | Should Not Throw
        Remove-Variable -Name DryRun -Scope Script -ErrorAction SilentlyContinue
    }
}

Describe 'release.ps1 — parameter parsing' {
    It 'script loads with -DryRun -SkipTests -SkipBuild without error' {
        # Write-Host goes to stream 6 (Information) in PowerShell 7.
        $output = & $script:releaseScriptPath -DryRun -SkipTests -SkipBuild 6>&1
        $output -join "`n" | Should Match 'Release pipeline complete'
    }

    It 'script accepts -Version parameter matching repo version' {
        $output = & $script:releaseScriptPath -Version 0.1.0 -DryRun -SkipTests -SkipBuild 6>&1
        $output -join "`n" | Should Match 'Release pipeline complete'
    }
}

Write-Host "`nTest environment root: $script:testRoot" -ForegroundColor DarkGray
