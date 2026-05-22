# Windows Installer for Non-Technical Users - Design Plan

**Date**: 2026-05-15  
**Goal**: Create a single-click Windows installer that handles all prerequisites automatically for civil engineers with minimal technical knowledge.

---

## Current State

**What Works**:
- ✅ Tauri 2 desktop app with Python sidecar (PyInstaller bundled)
- ✅ Sidecar bundled as external binary in Tauri
- ✅ App runs on developer machines with manual setup

**What's Missing**:
- ❌ No automated installer for prerequisites (Ollama, Tesseract)
- ❌ Manual setup required (5 prerequisites + 3 setup steps)
- ❌ No first-run wizard for model downloads
- ❌ No update mechanism

---

## Target User Experience

**Ideal Flow**:
1. User downloads `GroundTruthLocal-Setup.exe` (single file)
2. Double-click installer → Next → Next → Install
3. Installer handles all prerequisites automatically
4. App launches → First-run wizard downloads models (progress bar)
5. User starts working immediately

**No manual steps. No command line. No technical knowledge required.**

---

## Technical Challenges

### Challenge 1: Ollama Dependency
**Problem**: Ollama is a separate application (not a library) that needs to:
- Run as a background service
- Be accessible at `localhost:11434`
- Have models pre-downloaded or downloaded on first run

**Options**:
1. **Bundle Ollama installer** - Run Ollama's installer silently during setup
2. **Portable Ollama** - If available, bundle Ollama binaries directly
3. **Download on first run** - Installer downloads Ollama, app downloads models
4. **Cloud fallback** - If Ollama not available, offer cloud API option (opt-in)

**Recommendation**: Research if Ollama has silent install or portable mode. If not, download on first run with progress UI.

### Challenge 2: Tesseract OCR
**Problem**: Tesseract needs to be on PATH or app needs to know its location.

**Options**:
1. **Bundle Tesseract portable** - Include Tesseract binaries in installer
2. **Install Tesseract silently** - Run Tesseract installer during setup
3. **Ship with app** - Bundle Tesseract in app directory, configure path

**Recommendation**: Bundle Tesseract portable in app directory (simplest, no PATH issues).

### Challenge 3: Large Model Downloads
**Problem**: Ollama models are large (llama3.2 ~2GB, nomic-embed-text ~274MB).

**Options**:
1. **Bundle models in installer** - Installer becomes 2GB+ (slow download)
2. **Download on first run** - First-run wizard downloads models (better UX)
3. **Optional download** - Let user choose models to download

**Recommendation**: Download on first run with progress UI. Better than 2GB installer download.

### Challenge 4: Tauri Bundler Limitations
**Problem**: Tauri's built-in bundler creates MSI/NSIS but doesn't handle complex prerequisite installation.

**Options**:
1. **Use Tauri's NSIS bundler** - Customize NSIS script to install prerequisites
2. **Use WiX for MSI** - More control but more complex
3. **Custom installer wrapper** - Separate installer that downloads/installs everything, then launches Tauri app

**Recommendation**: Start with Tauri NSIS bundler + custom NSIS script for prerequisites.

---

## Proposed Architecture

### Installer Components

```
GroundTruthLocal-Setup.exe (NSIS installer)
├── GroundTruth Local.exe (Tauri app)
├── sidecar.exe (Python FastAPI, PyInstaller bundled)
├── tesseract/ (portable Tesseract OCR binaries)
├── ollama-installer.exe (downloaded or bundled)
└── first-run-setup/ (model download wizard)
```

### Installation Flow

```
1. User runs GroundTruthLocal-Setup.exe
   ↓
2. NSIS installer extracts files to Program Files
   ↓
3. Installer checks if Ollama is installed
   ├─ If not: Download and install Ollama silently
   └─ If yes: Skip
   ↓
4. Installer creates desktop shortcut
   ↓
5. Installer launches app for first time
   ↓
6. App detects first run → Shows setup wizard
   ↓
7. Setup wizard:
   - Checks Ollama service status
   - Downloads required models (llama3.2, nomic-embed-text)
   - Shows progress bar
   - Tests model availability
   ↓
8. Setup complete → App ready to use
```

---

## TODOs

### Phase 1: Bundle Tesseract (Quick Win)
- [x] 1.1 Download Tesseract portable Windows binaries (x64) from UB-Mannheim
- [x] 1.2 Create `apps/tauri/src-tauri/resources/tesseract` and extract binaries
- [x] 1.3 Update `tauri.conf.json` to include tesseract resources
- [x] 1.4 Update sidecar `config.py` to detect and use bundled Tesseract path
- [x] 1.5 Verify OCR works using bundled Tesseract (internet disabled)

### Phase 2: First-Run Setup Wizard
- [x] 2.1 Implement `is_first_run` check in frontend (localStorage + API check)
- [x] 2.2 Create `SetupWizard` React component with step-by-step progress
- [x] 2.3 Implement Ollama connectivity check (ping localhost:11434)
- [x] 2.4 Add `POST /setup/models` endpoint to sidecar for model pull progress
- [x] 2.5 Wire UI to sidecar pull API with real-time progress bars
- [x] 2.6 Verify models `llama3.2` and `nomic-embed-text` are ready before completion

### Phase 3: Ollama Auto-Install
- [x] 3.1 Research/Download Ollama Windows installer binary
- [x] 3.2 Add Ollama installer to Tauri resources
- [x] 3.3 Add Tauri command to trigger silent Ollama installation (`/S` flag)
- [x] 3.4 Implement "Install Ollama" step in Setup Wizard if service not found
- [x] 3.5 Verify Ollama service starts and responds after installation

### Phase 4: NSIS Installer Customization
- [x] 4.1 Enable NSIS bundling in `tauri.conf.json`
- [x] 4.2 Create custom NSIS header/script for registry checks
- [x] 4.3 Add custom installer branding and shortcuts
- [x] 4.4 Implement uninstaller logic for local models/data
- [x] 4.5 Perform final build and verify on clean Windows VM

---

## Success Criteria

**Installer must**:
- ✅ Be a single `.exe` file
- ✅ Install without admin prompts (or handle UAC gracefully)
- ✅ Handle all prerequisites automatically
- ✅ Show progress during installation
- ✅ Launch app on first run with setup wizard
- ✅ Work on clean Windows 10/11 machines
- ✅ Include uninstaller that cleans up everything

**User must NOT need to**:
- ❌ Open command line
- ❌ Install Node.js, Python, Rust, or any dev tools
- ❌ Manually download Ollama or Tesseract
- ❌ Edit PATH or environment variables
- ❌ Run any setup scripts

---

## Next Steps

1. Wait for librarian research to complete
2. Refine plan based on research findings
3. Start with Phase 1 (bundle Tesseract) - quick win
4. Implement Phase 2 (first-run wizard) - high user value
5. Tackle Phase 3 (Ollama auto-install) - most complex
6. Polish with Phase 4 (NSIS customization)
