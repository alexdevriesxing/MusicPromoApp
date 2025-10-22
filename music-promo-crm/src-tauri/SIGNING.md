Code Signing & Notarization
===========================

This app uses Tauri v2. Packaging and signing vary per OS. Below are practical steps and placeholders; integrate into CI as needed.

macOS (Developer ID + Notarization)
-----------------------------------
Prereqs:
- Apple Developer ID Application certificate installed in your keychain
- Xcode Command Line Tools

Env vars (example):
- `APPLE_ID` – Apple ID email
- `APPLE_PASSWORD` – app-specific password
- `APPLE_TEAM_ID` – your Team ID

Tauri v2 uses Apple’s codesign + notarytool automatically when environment is present. Build & notarize:

```
APPLE_ID=you@example.com \
APPLE_PASSWORD=xxxx-xxxx-xxxx-xxxx \
APPLE_TEAM_ID=YOURTEAMID \
npm run tauri:build -- --target dmg
```

Windows (MSI signing)
---------------------
Prereqs:
- Code signing cert (.pfx) + password
- signtool from Windows SDK

Set environment:
- `TAURI_PRIVATE_KEY`/`TAURI_KEY_PASSWORD` if using Tauri key; or sign MSI post-build with signtool:

```
signtool sign /f path\\to\\cert.pfx /p <password> /tr http://timestamp.digicert.com /td sha256 /fd sha256 path\\to\\bundle.msi
```

Linux
-----
No signing required by default; use GPG to sign packages if desired. Build targets include AppImage, deb, rpm.

CI Notes
--------
- Keep secrets in CI environment (GitHub Actions, etc.).
- Use `tauri build -b <target>` per platform runners.

