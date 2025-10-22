# Music Promo CRM — Desktop Roadmap (Locked)

This roadmap defines a focused set of milestones to deliver a fully built desktop app (Tauri) without any Gemini/AI features. No features beyond this list will be added. All milestones are locked and start unchecked.

How to proceed:
- Say "Implement Milestone X" to request implementation for milestone X.
- After implementation, the milestone will be checked off and marked done here.

---

## Milestone 1: Desktop Core Setup
- [x] Verify Tauri setup and app shell (sidebar + views)
- [x] Local database wiring (SQLite via `@tauri-apps/plugin-sql`)
- [x] Create/verify schema initialization and migrations
- [x] Seed/import bootstrapping path (optional sample data)
- [x] App state structure and env configuration

## Milestone 2: Contacts CRUD
- [x] Contact types and validation
- [x] List view + create/edit modal + delete
- [x] Tagging, favorite toggle, verification status field
- [x] Persistence with optimistic UI updates

## Milestone 3: Import & Migration
- [x] CSV import (file picker) with validation + error reporting
- [x] Google Sheets CSV import by public link
- [x] Advanced import (column mapping, de-dup/update strategy, progress/cancel)
- [x] JSON backup/restore and migration helper

## Milestone 4: Search & Filter
- [x] Full-text search across key fields
- [x] Structured filters (type, country, tags, verification)
- [x] Sorting + pagination/virtualization
- [x] Saved filters (local)

## Milestone 5: Shortlist & Exports
- [x] Shortlist builder view and selection tools
- [x] Export shortlist CSV
- [x] Bulk copy emails and export filtered subsets

## Milestone 6: Reporting
- [x] PDF report generation for selected contacts (jsPDF)
- [x] CSV export from views (filtered results)
- [x] Summary counters (totals, top countries/tags)

## Milestone 7: UX & Accessibility
- [x] Responsive layout and form validation polish
- [x] Loading states and error handling across flows
- [x] Keyboard navigation and focus management
- [x] Dark/Light theme toggle

## Milestone 8: Settings & Data
- [x] Preferences (page size, default sort, theme, defaults)
- [x] Data reset, diagnostics, and sample data load
- [x] Non-destructive migrations and safe operations

## Milestone 9: Packaging & Distribution
- [x] Tauri build targets (macOS/Windows/Linux)
- [x] App metadata and icons
- [x] Signed build setup (doc placeholders as needed)

## Milestone 10: Final QA & Release
- [x] Manual QA checklist completed on packaged builds
- [x] Documentation (User Guide + Troubleshooting)
- [x] Release notes and versioning (v1.0.0 Desktop)

---
Locked: To implement a milestone, prompt with "Implement Milestone X" where X is the milestone number. AI/Gemini features are explicitly excluded.
