# Release Notes

## v1.0.2 (Desktop)

Validation
----------
- Validate CI auto-publish release flow; no functional code changes
- Version bump to keep package/release versions in sync

## v1.0.1 (Desktop)

Enhancements
------------
- Bundle Tailwind CSS for offline desktop builds (removed CDN)
- Added CI release step to create draft GitHub Releases with artifacts

## v1.0.0 (Desktop)

First stable desktop release built with Tauri v2.

Highlights
----------
- Local SQLite database (desktop) with fallback Dexie (web)
- Contacts: CRUD, favorites, Do Not Contact
- Import: CSV/Google Sheets, Advanced CSV (mapping, dedupe, update), JSON
- Search & Filters: FTS, country, verification; saved filters
- Shortlist: email shortlist with CSV export and copy/download
- Reporting: summary metrics and PDF report for selected stations
- Settings: preferences, diagnostics, backup & reset, sample data, search index rebuild, migrations
- Theme: Dark/Light toggle
- Packaging: macOS DMG, Windows MSI, Linux AppImage/deb/rpm (see PACKAGING.md)

Notes
-----
- No Gemini/AI features are included by design.
- For signing/notarization, see SIGNING.md.
