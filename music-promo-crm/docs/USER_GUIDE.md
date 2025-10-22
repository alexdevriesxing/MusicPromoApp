User Guide (Desktop v1.0.0)
===========================

Install
-------
- macOS: open the .dmg, drag the app to Applications
- Windows: install the .msi
- Linux: run the AppImage or install deb/rpm as appropriate

Getting Started
---------------
1) Launch the app. Use the sidebar to navigate.
2) Theme toggle (top-right) switches Dark/Light mode and is saved.

Contacts (Database)
-------------------
- Add: click “Add Contact”, fill required fields, save.
- Edit/Delete: use row actions.
- Favorite / Do Not Contact: use star/bell icons in the Actions column.
- Import:
  - Basic CSV or Google Sheets: Sidebar → Import Data
  - Advanced CSV: Database header → “Advanced Import” (mapping, dedupe, update strategies)
  - JSON import: Database header → “Import .json”
- Export:
  - All contacts (Markdown/JSON) or filtered (JSON/CSV) from Database header.

Search & Filters
----------------
- Top search filters:
  - Query: type free text or structured terms (e.g., name:"global groove" email:gmail.com genre:"indie")
  - Country dropdown
  - Verification dropdown
- Advanced: add specific fields (name/email/website/genre/person/type), then Apply.
- Saved Filters: Save current filters, Apply later, or Delete.

Shortlist
---------
- Build an email shortlist by filtering by country/type/genres.
- Copy emails, download as .txt, or export shortlist CSV.
- Do Not Contact entries are automatically excluded.

Reporting
---------
- Summary metrics: totals, by type, top countries/genres
- Generate a PDF of selected radio stations with chosen columns.

Settings
--------
- Preferences: default page size and default sort key/direction.
- Data Tools: backup export (JSON), reset database, load sample data, rebuild search index, run migrations, and diagnostics.

Backups & Migration
-------------------
- Export backup JSON from Settings → Data Operations.
- Import JSON back via Database → Import .json.
- On first desktop launch, a Dexie→SQLite migration assistant will prompt you if browser data exists.

Notes
-----
- No internet or AI features are required.
- Desktop stores data in a local SQLite database managed by Tauri’s SQL plugin.

