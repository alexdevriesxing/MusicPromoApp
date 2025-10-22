Manual QA Checklist (v1.0.0)
============================

Environment
-----------
- [ ] macOS packaged build (DMG)
- [ ] Windows packaged build (MSI)
- [ ] Linux packaged build (AppImage/Deb/RPM)

Core Flows
----------
- Database
  - [ ] Launch app, verify theme toggle persists between runs
  - [ ] Add contact (valid/invalid email validation)
  - [ ] Edit contact (fields persist)
  - [ ] Toggle Favorite and Do Not Contact inline
  - [ ] Delete contact
  - [ ] Sorting, pagination, and virtualization feel responsive with 10k+ rows

- Import
  - [ ] Basic CSV import with headers (name,type,country,genres,email,website)
  - [ ] Google Sheets link import (published as CSV)
  - [ ] Advanced CSV import: mapping, dedupe (email/website/name+country), update mode, progress/cancel
  - [ ] JSON import (Database → Import .json)

- Search & Filters
  - [ ] FTS: search by name/email/website/genre/person
  - [ ] Filters: country, verification, advanced type dropdown
  - [ ] Saved filters save/apply/delete

- Shortlist
  - [ ] Genre selection (search, select/deselect visible)
  - [ ] Copy emails / Download .txt / Export shortlist CSV
  - [ ] Do Not Contact entries are excluded

- Reporting
  - [ ] Summary counters render (totals, by type, top countries/genres)
  - [ ] Generate PDF table for selected radio stations

- Settings & Data
  - [ ] Preferences: default page size, default sort; applied on next Database view open
  - [ ] Diagnostics show schema version and table counts
  - [ ] Backup export (JSON) downloads file
  - [ ] Reset Database clears all data (confirm prompt)
  - [ ] Load Sample Data repopulates from seed
  - [ ] Rebuild Search Index repopulates FTS rows
  - [ ] Run Migrations completes without errors

Desktop Specific
----------------
- [ ] DB persists to `promobase.db` across app restarts
- [ ] App menus and window behaviors (resize, min/max) work as expected

Packaging & Signing
-------------------
- [ ] Icons appear correctly on each platform
- [ ] macOS DMG opens, app launches; notarization if configured
- [ ] Windows MSI installs/uninstalls; app launches; signed if configured
- [ ] Linux packages install and launch successfully

Regression
----------
- [ ] No AI features present
- [ ] No crashes on invalid inputs/imports; errors surfaced to user

