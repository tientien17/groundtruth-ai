#!/bin/bash

# Bundle Python sidecar using PyInstaller for Tauri
# Usage: ./scripts/bundle_sidecar.sh

APP_NAME="sidecar"
SIDECAR_DIR="apps/sidecar"
DIST_DIR="apps/tauri/src-tauri/sidecars"

# Get target triple for Tauri sidecar naming
TARGET_TRIPLE=$(rustc -vV | grep host | cut -d ' ' -f2)

echo "Building sidecar for $TARGET_TRIPLE..."

# Ensure dist directory exists
mkdir -p "$DIST_DIR"

cd "$SIDECAR_DIR"

# Install PyInstaller if not present
uv pip install pyinstaller

# Build executable
# --onefile: single executable
# --name: include target triple for Tauri
uv run pyinstaller --onefile \
    --name "${APP_NAME}-${TARGET_TRIPLE}" \
    --clean \
    main.py

# Move to Tauri sidecars folder
mv "dist/${APP_NAME}-${TARGET_TRIPLE}" "../../$DIST_DIR/"
# Note: On Windows, PyInstaller adds .exe
if [ -f "dist/${APP_NAME}-${TARGET_TRIPLE}.exe" ]; then
    mv "dist/${APP_NAME}-${TARGET_TRIPLE}.exe" "../../$DIST_DIR/"
fi

echo "Done! Sidecar bundled to $DIST_DIR"
