Troubleshooting
===============

App doesn’t launch (desktop)
----------------------------
- macOS: If blocked by Gatekeeper, right-click → Open once. Ensure DMG was notarized if CI signing is enabled.
- Windows: If SmartScreen warns, ensure MSI is signed or choose “More info” → Run anyway.
- Linux: Ensure AppImage is executable (`chmod +x`).

Database issues
---------------
- Missing data or search results:
  - Try Settings → Rebuild Search Index.
  - Verify data exists (Settings → Diagnostics).
- Start fresh: Settings → Reset Database. Export a backup first if needed.

CSV import errors
-----------------
- Ensure the CSV has headers: `name,type,country,genres,email` (website optional)
- Use Advanced Import to map columns and choose dedup/update rules.

Google Sheets import fails
--------------------------
- Ensure the sheet is “Published to the web” as CSV and the link is public.

Large files / performance
-------------------------
- Use Advanced Import (streaming, progress, cancel).
- Use filters and pagination; virtualization is enabled for big lists.

Packaging/Signing
-----------------
- See `src-tauri/SIGNING.md` for configuration. Icons must be generated (see `src-tauri/icons/README.md`).

Logs
----
- Open the developer tools console during `npm run tauri:dev` for detailed logs.

