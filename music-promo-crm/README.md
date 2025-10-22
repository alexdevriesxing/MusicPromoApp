<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run the app locally

This contains everything you need to run the app locally as a standalone (no AI features).

## Run Locally

Prerequisites: Node.js

1. Install dependencies:
   `npm install`
2. Run the app:
   `npm run dev`

Data is stored locally in your browser (IndexedDB via Dexie) and can be imported/exported via the UI.

## Desktop (Tauri + SQLite)

This project includes a Tauri scaffold and a storage layer that uses SQLite when running as a desktop app, and Dexie (IndexedDB) when running in the browser.

- Dev (web): `npm run dev`
- Dev (desktop): `npm run tauri:dev` (requires Rust toolchain)
- Build desktop app: `npm run tauri:build`

Note: The SQLite database file is `promobase.db` managed by the Tauri SQL plugin. When running in the browser, the app falls back to Dexie until packaged.

Documentation
-------------
- User Guide: docs/USER_GUIDE.md
- Troubleshooting: docs/TROUBLESHOOTING.md
- Packaging: src-tauri/PACKAGING.md
- Signing/Notarization: src-tauri/SIGNING.md
- Manual QA Checklist: docs/QA_CHECKLIST.md
- Release Notes: docs/RELEASE_NOTES.md
