# Learnings

## Gitignore negation for nested directories
When ignoring files in nested directory trees with `changelog/**/*`, git also matches and ignores **directories** themselves. This prevents traversal into subdirectories, making negation patterns for files inside them ineffective.

**Solution**: Add `!changelog/**/` to re-include directories (enabling traversal), then add `!changelog/**/.gitkeep` to re-include `.gitkeep` files.

```gitignore
changelog/**/*
!changelog/**/
!changelog/**/.gitkeep
```

## Verification commands
- `git add --dry-run changelog/` — shows what would be staged (definitive test)
- `git check-ignore -v <file>` — shows which rule matches (for debugging)

## Release script dry-run behavior
- scripts/release.ps1 keeps DryRun non-mutating across changelog compilation, tests, build, checksum, fragment cleanup, commit, and tag gates.
- DryRun permits missing NSIS installer so pwsh -NoProfile -File scripts/release.ps1 -DryRun passes before bundle exists.
- PowerShell LSP diagnostics unavailable in current OpenCode config (.ps1 has no configured server); script syntax/runtime verified with dry-run instead.

## Pester testing for release.ps1
- **Pester 3.4.0** is installed; uses `Should Be`/`Should Throw` syntax (NO dash prefix: `Should Be` NOT `Should -Be`).
- **Known Pester 3.4.0 bug on PS7**: `Should Throw` (without expected message) fails — always use `Should Throw 'expected text'`.
- **Function extraction**: `Invoke-Expression` creates functions in a nested scope invisible to Pester `Describe` blocks. Solution: write function block to temp `.ps1` file and dot-source it.
- **Script-level dependencies**: Functions like `Update-Changelog` reference `$changelogPath`, `$userFragmentsDir`, etc. as unqualified script-scoped variables. Must set these before tests.
- **$PSScriptRoot is null** inside `Invoke-Expression` / dot-sourced temp scripts. Strip `$repoRoot = Split-Path -Parent $PSScriptRoot` from the function block and override `$repoRoot` directly.
- **Array unrolling**: Functions that return `@("single item")` may unroll to a plain string when captured. Use `@(Get-FragmentText ...)` to force array.
- **Write-Host output**: Goes to stream 6 (Information stream) in PowerShell 7, NOT stdout. Capture with `6>&1`, not `2>&1`.
- **Test coverage (33 tests)**:
  - Read-JsonVersion (4): valid JSON, missing file, missing version, malformed JSON
  - Read-RegexVersion (4): regex capture, missing file, no match, multiline
  - Get-ReleaseVersion (3): consistent versions, mismatch, missing file
  - Get-FragmentText (5): sorted fragments, .gitkeep only, empty files, blank line stripping, missing dir
  - Invoke-ReleaseCommand (3): dry-run skip, execution, non-zero exit
  - Update-Changelog (2): dry-run safety, missing changelog
  - Get-Installer (4): dry-run null, FileInfo, newest selection, missing throws
  - Write-Checksum (3): null installer, dry-run path, actual checksum file
  - Clear-Fragments (3): dry-run preserve, actual delete, no fragments
  - Parameter parsing (2): dry-run smoke test, -Version acceptance



## 2026-05-15 F3 Real Manual QA Retry
- `./scripts/release.ps1 -DryRun -SkipTests -SkipBuild` completed through step 10 and printed `Release pipeline complete for v0.1.0.` No real release performed.
- `./scripts/__tests__/release.Tests.ps1` passed in current environment.
