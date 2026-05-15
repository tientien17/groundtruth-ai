
## 2026-05-15 - Tesseract resource bundling

- Checked existing state first: `apps/tauri/src-tauri/resources/tesseract/` existed but was empty.
- Required GitHub zip URL returned 404, so portable runtime was populated from local `C:\Program Files\Tesseract-OCR` install.
- Copied `tesseract.exe`, all DLLs, `tessdata/eng.traineddata`, and `tessdata/osd.traineddata` into `apps/tauri/src-tauri/resources/tesseract/`.
- Updated `apps/tauri/src-tauri/tauri.conf.json` with `bundle.resources = ["resources/tesseract/**"]`.
- Added `SIDECAR_TESSERACT_PATH` support via `Settings.tesseract_path`.
- Sidecar text extraction now configures `pytesseract.pytesseract.tesseract_cmd` from `SIDECAR_TESSERACT_PATH`.
- Tauri startup now resolves bundled `resource_dir()/tesseract/tesseract.exe` and passes it to sidecar as `SIDECAR_TESSERACT_PATH`.
- Added `scripts/setup_tesseract_resource.ps1` to regenerate ignored binary resources from a local UB-Mannheim install.
- Verification passed: Python LSP clean, `py_compile` clean, OCR test image returned `GROUNDTRUTHOCR TEST` using bundled resource path.
- Rust LSP/cargo verification blocked on this machine: `rust-analyzer` and `cargo` not installed.
