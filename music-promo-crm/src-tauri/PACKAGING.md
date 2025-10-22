Packaging & Distribution
========================

This project is configured for Tauri v2 packaging across macOS, Windows, and Linux.

Quick Start
-----------
1) Generate icons into `src-tauri/icons/`:

```
npm run tauri:icon -- assets/app-icon.png
```

2) Build a signed package on each platform runner:

```
# macOS (DMG + notarization if env present)
npm run tauri:build:mac

# Windows (MSI; sign with signtool post-build or TAURI_PRIVATE_KEY)
npm run tauri:build:win

# Linux (AppImage, deb, rpm)
npm run tauri:build:linux
```

Configuration
-------------
- `src-tauri/tauri.conf.json` declares bundle targets and icon paths.
- See `src-tauri/SIGNING.md` for code signing and notarization steps.

