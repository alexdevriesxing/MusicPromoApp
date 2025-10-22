
import React, { useState, useCallback, useEffect } from 'react';
import { Layout } from './components/Layout';
import { DatabaseView } from './components/DatabaseView';
import { ShortlistView } from './components/ShortlistView';
import { ReportingView } from './components/ReportingView';
import { SettingsView } from './components/SettingsView';
import { Contact, View, VerificationStatus } from './types';
import { ContactModal } from './components/ContactModal';
import { ImportModal } from './components/ImportModal';
import DuplicatesModal from './components/DuplicatesModal';
import * as db from './storage';
import * as dexieDb from './db';
import MigrationModal from './components/MigrationModal';
import AdvancedImportModal from './components/AdvancedImportModal';

const App: React.FC = () => {
    const [contacts, setContacts] = useState<Contact[]>([]);
    const [countries, setCountries] = useState<string[]>([]);
    const [genres, setGenres] = useState<string[]>([]);
    const [currentView, setCurrentView] = useState<View>(View.Database);
    
    const [isContactModalOpen, setContactModalOpen] = useState(false);
    const [contactToEdit, setContactToEdit] = useState<Contact | null>(null);

    const [isImportModalOpen, setImportModalOpen] = useState(false);
    const [notification, setNotification] = useState<string | null>(null);
    const [isDupesOpen, setDupesOpen] = useState(false);
    const [isAdvImportOpen, setAdvImportOpen] = useState(false);
    type UndoSnapshot = { groups: { primaryBefore: Contact; others: Contact[] }[]; historyCount: number };
    type MergeDiff = { label: string; before: any; after: any };
    type MergeEntry = { timestamp: string; primaryId: string; otherIds: string[]; diffs: MergeDiff[] };
    const [undoStack, setUndoStack] = useState<UndoSnapshot[]>([]);
    const [mergeHistory, setMergeHistory] = useState<MergeEntry[]>([]);

    const showNotification = (message: string) => {
        setNotification(message);
        setTimeout(() => setNotification(null), 4000);
    };

    useEffect(() => {
        const loadContacts = async () => {
            try {
                const storedContacts = await db.getAllContacts();
                if (storedContacts.length > 0) {
                    setContacts(storedContacts);
                } else {
                    // Desktop migration path: if desktop and Dexie has contacts, offer migration
                    try {
                        // Count Dexie and SQLite
                        const dex = await dexieDb.getAllContacts();
                        setDexieCount(dex.length);
                        setSqliteCount(0);
                        if (dex.length > 0) {
                            setMigrationOpen(true);
                            return; // Do not seed; wait for migration
                        }
                    } catch (e) {
                        console.warn('Dexie count failed (maybe unavailable):', e);
                    }
                    // No Dexie data; seed from file
                    try {
                        showNotification("Setting up initial database...");
                        const response = await fetch('/seed-data.json');
                        if (!response.ok) {
                            throw new Error(`Failed to load seed data: ${response.statusText}`);
                        }
                        const seedContacts: Contact[] = await response.json();
                        await db.bulkAddContacts(seedContacts);
                        setContacts(seedContacts);
                        setSqliteCount(seedContacts.length);
                        showNotification("Database setup complete!");
                    } catch (seedErr) {
                        console.error('Seed failed:', seedErr);
                        showNotification('Error: Could not initialize database.');
                    }
                }
            } catch (error) {
                console.error("Failed to load contacts from the database:", error);
                showNotification("Error: Could not initialize database.");
            }
        };
        loadContacts();
    }, []);

    useEffect(() => {
        if (contacts.length > 0) {
            const uniqueCountriesArr = [...new Set(contacts.map(c => c.country))] as string[];
            const uniqueGenresArr = [...new Set(contacts.flatMap(c => c.genres))] as string[];
            const uniqueCountries = uniqueCountriesArr.sort((a: string, b: string) => a.localeCompare(b));
            const uniqueGenres = uniqueGenresArr.sort((a: string, b: string) => a.localeCompare(b));
            setCountries(uniqueCountries);
            setGenres(uniqueGenres);
        }
    }, [contacts]);


    const handleAddContact = useCallback(async (contact: Omit<Contact, 'id'>) => {
        const newContact: Contact = { ...contact, id: Date.now().toString(), verificationStatus: 'unverified' };
        try {
            await db.addContact(newContact);
            setContacts(prev => [...prev, newContact]);
            showNotification('Contact added successfully!');
        } catch (error) {
            console.error("Failed to add contact:", error);
            showNotification('Error: Could not add contact.');
        }
    }, []);

    const handleUpdateContact = useCallback(async (updatedContact: Contact) => {
        try {
            await db.updateContact(updatedContact);
            setContacts(prev => prev.map(c => c.id === updatedContact.id ? updatedContact : c));
            showNotification('Contact updated successfully!');
        } catch (error) {
            console.error("Failed to update contact:", error);
            showNotification('Error: Could not update contact.');
        }
    }, []);

    const handleQuickUpdate = useCallback((updatedContact: Contact) => {
        // Optimistic UI update
        setContacts(prev => prev.map(c => c.id === updatedContact.id ? updatedContact : c));
        db.updateContact(updatedContact).catch(() => {
            console.error('Quick update failed');
            showNotification('Update failed; please retry.');
        });
    }, []);

    const handleDeleteContact = useCallback(async (id: string) => {
        try {
            await db.deleteContact(id);
            setContacts(prev => prev.filter(c => c.id !== id));
            showNotification('Contact deleted.');
        } catch (error) {
            console.error("Failed to delete contact:", error);
            showNotification('Error: Could not delete contact.');
        }
    }, []);

    // AI features removed; verification flow disabled for standalone app

    const handleOpenAddModal = () => {
        setContactToEdit(null);
        setContactModalOpen(true);
    };

    const handleOpenEditModal = (contact: Contact) => {
        setContactToEdit(contact);
        setContactModalOpen(true);
    };

    const handleImportContacts = async (newContacts: Omit<Contact, 'id'>[]) => {
        const contactsWithIds = newContacts.map((c, index) => ({...c, id: `imported-${Date.now()}-${index}`, verificationStatus: 'unverified' as VerificationStatus}));
        try {
            await db.bulkAddContacts(contactsWithIds);
            setContacts(prev => [...prev, ...contactsWithIds]);
            showNotification(`Successfully imported ${newContacts.length} contacts.`);
        } catch (error) {
            console.error("Failed to import contacts:", error);
            showNotification('Error: Could not import contacts.');
        }
    };

    const handleExportDexieJson = async () => {
        try {
            const dex = await dexieDb.getAllContacts();
            const blob = new Blob([JSON.stringify(dex, null, 2)], { type: 'application/json;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'dexie-backup.json';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        } catch (e: any) {
            showNotification(e?.message || 'Failed to export Dexie backup');
        }
    };

    const handleStartMigration = async () => {
        setMigrationError(null);
        setMigrationStatus('Preparing…');
        setMigrationRunning(true);
        setMigrationMigrated(0);
        try {
            const dex = await dexieDb.getAllContacts();
            setMigrationTotal(dex.length);
            // Build de-duplicated list using same rule as import
            // Also de-dup against any existing sqlite (defensive)
            const existing = await db.getAllContacts();
            const norm = (s: string) => (s || '').trim().toLowerCase();
            const existingEmails = new Set(existing.map(c => (c.email ? norm(c.email) : '')).filter(Boolean));
            const existingNameCountry = new Set(existing.map(c => `${norm(c.name)}|${norm(c.country)}`));
            const existingWebsites = new Set(existing.map(c => (c.website ? norm(c.website) : '')).filter(Boolean));

            const seenEmails = new Set<string>();
            const seenNameCountry = new Set<string>();
            const seenWebsites = new Set<string>();
            const deduped: Contact[] = [] as any;
            for (const c of dex) {
                const e = c.email ? norm(c.email) : '';
                const nc = `${norm(c.name)}|${norm(c.country)}`;
                const w = c.website ? norm(c.website) : '';
                let duplicate = false;
                if (e && (existingEmails.has(e) || seenEmails.has(e))) duplicate = true;
                if (!duplicate && w && (existingWebsites.has(w) || seenWebsites.has(w))) duplicate = true;
                if (!duplicate && (existingNameCountry.has(nc) || seenNameCountry.has(nc))) duplicate = true;
                if (duplicate) continue;
                if (e) seenEmails.add(e);
                if (w) seenWebsites.add(w);
                seenNameCountry.add(nc);
                deduped.push(c);
            }

            // Chunked insert
            const chunkSize = 500;
            for (let i = 0; i < deduped.length; i += chunkSize) {
                const chunk = deduped.slice(i, i + chunkSize);
                setMigrationStatus(`Migrating ${i + 1}–${Math.min(i + chunkSize, deduped.length)} of ${deduped.length}`);
                await db.bulkAddContacts(chunk);
                setMigrationMigrated(Math.min(i + chunk.length, deduped.length));
                // Yield to UI
                await new Promise(r => setTimeout(r, 0));
            }

            // Reload
            const after = await db.getAllContacts();
            setContacts(after);
            setSqliteCount(after.length);
            setMigrationStatus('Migration complete');
            setMigrationRunning(false);
            setMigrationOpen(false);
            showNotification(`Migration complete: ${deduped.length} contacts imported.`);
        } catch (e: any) {
            console.error('Migration failed:', e);
            setMigrationError(e?.message || 'Migration failed');
            setMigrationRunning(false);
        }
    };

    const combineContacts = (primary: Contact, others: Contact[]): Contact => {
        const merged: Contact = { ...primary };
        const rank: Record<string, number> = { verified: 4, verifying: 3, not_found: 2, error: 1, unverified: 0 };
        for (const o of others) {
            if ((o.name || '').length > (merged.name || '').length) merged.name = o.name;
            if (!merged.email && o.email) merged.email = o.email;
            if (!merged.website && o.website) merged.website = o.website;
            if (!merged.country && o.country) merged.country = o.country;
            if (!merged.type && o.type) merged.type = o.type;
            const mk = merged.verificationStatus || 'unverified';
            const ok = (o.verificationStatus || 'unverified');
            if ((rank[ok] ?? 0) > (rank[mk] ?? 0)) {
                merged.verificationStatus = ok as any;
                if (o.verificationDetails) merged.verificationDetails = o.verificationDetails;
            }
            merged.doNotContact = !!(merged.doNotContact || o.doNotContact);
            const gset = new Set<string>(merged.genres || []);
            (o.genres || []).forEach(g => gset.add(g));
            merged.genres = Array.from(gset);
            const pmap = new Map<string, any>();
            (merged.contactPersons || []).forEach(p => pmap.set((p.email || p.name || '').toLowerCase(), p));
            (o.contactPersons || []).forEach(p => {
                const key = (p.email || p.name || '').toLowerCase();
                if (!pmap.has(key)) pmap.set(key, p);
            });
            merged.contactPersons = Array.from(pmap.values());
            const sm = { ...(merged.socials || {}) } as Record<string, string>;
            const so = (o.socials || {}) as Record<string, string>;
            Object.keys(so).forEach(k => {
                if (!sm[k] && so[k]) sm[k] = so[k];
            });
            merged.socials = Object.keys(sm).length ? sm : undefined;
        }
        return merged;
    };

    const computeDiffs = (before: Contact, after: Contact): MergeDiff[] => {
        const diffs: MergeDiff[] = [];
        const push = (label: string, b: any, a: any, cmp: (x: any, y: any) => boolean = (x, y) => x === y) => {
            if (!cmp(b, a)) diffs.push({ label, before: b, after: a });
        };
        push('Name', before.name, after.name);
        push('Email', before.email, after.email);
        push('Website', before.website || '', after.website || '');
        push('Country', before.country, after.country);
        push('Type', before.type, after.type);
        push('Verification', before.verificationStatus || 'unverified', after.verificationStatus || 'unverified');
        push('Do Not Contact', !!before.doNotContact, !!after.doNotContact);
        push('Genres', (before.genres || []).join(', '), (after.genres || []).join(', '));
        push('Persons', (before.contactPersons || []).length, (after.contactPersons || []).length);
        push('Socials', Object.keys(before.socials || {}).length, Object.keys(after.socials || {}).length);
        return diffs;
    };

    const handleMergeGroup = async (group: Contact[], primaryId: string) => {
        const primary = group.find(c => c.id === primaryId) || group[0];
        const others = group.filter(c => c.id !== primary.id);
        if (!primary || others.length === 0) return;
        const merged = combineContacts(primary, others);
        try {
            const snap: UndoSnapshot = { groups: [{ primaryBefore: JSON.parse(JSON.stringify(primary)), others: JSON.parse(JSON.stringify(others)) }], historyCount: 1 };
            setUndoStack(prev => [...prev, snap]);
            await db.updateContact(merged);
            for (const o of others) {
                await db.deleteContact(o.id);
            }
            setContacts(prev => {
                const withoutOthers = prev.filter(c => !others.some(o => o.id === c.id));
                return withoutOthers.map(c => (c.id === primary.id ? merged : c));
            });
            const diffs = computeDiffs(primary, merged);
            setMergeHistory(prev => [...prev, { timestamp: new Date().toISOString(), primaryId: primary.id, otherIds: others.map(o => o.id), diffs }]);
            showNotification(`Merged ${others.length + 1} records.`);
        } catch (e) {
            console.error('Merge failed', e);
            showNotification('Error merging group.');
        }
    };

    const handleMergeAll = async (groups: Contact[][], pickPrimary: (g: Contact[]) => string) => {
        const undoGroups: { primaryBefore: Contact; others: Contact[] }[] = [];
        let addedHistory = 0;
        for (const g of groups) {
            const pid = pickPrimary(g);
            const primary = g.find(c => c.id === pid) || g[0];
            const others = g.filter(c => c.id !== (primary?.id || ''));
            if (!primary || others.length === 0) continue;
            undoGroups.push({ primaryBefore: JSON.parse(JSON.stringify(primary)), others: JSON.parse(JSON.stringify(others)) });
            const merged = combineContacts(primary, others);
            // eslint-disable-next-line no-await-in-loop
            await db.updateContact(merged);
            for (const o of others) {
                // eslint-disable-next-line no-await-in-loop
                await db.deleteContact(o.id);
            }
            // Update local state incrementally
            setContacts(prev => {
                const withoutOthers = prev.filter(c => !others.some(o => o.id === c.id));
                return withoutOthers.map(c => (c.id === primary.id ? merged : c));
            });
            const diffs = computeDiffs(primary, merged);
            setMergeHistory(prev => [...prev, { timestamp: new Date().toISOString(), primaryId: primary.id, otherIds: others.map(o => o.id), diffs }]);
            addedHistory += 1;
        }
        if (undoGroups.length) {
            setUndoStack(prev => [...prev, { groups: undoGroups, historyCount: addedHistory }]);
            showNotification(`Merged ${undoGroups.reduce((acc, g) => acc + g.others.length + 1, 0)} records across ${undoGroups.length} groups.`);
        }
    };

    const handleUndo = async () => {
        if (undoStack.length === 0) return;
        const snapshot = undoStack[undoStack.length - 1];
        setUndoStack(prev => prev.slice(0, prev.length - 1));
        try {
            for (const g of snapshot.groups) {
                // Restore primary
                // eslint-disable-next-line no-await-in-loop
                await db.updateContact(g.primaryBefore);
                // Restore others
                for (const o of g.others) {
                    // eslint-disable-next-line no-await-in-loop
                    await db.addContact(o);
                }
                // Update local state
                setContacts(prev => {
                    const added = [...prev];
                    const primaryIdx = added.findIndex(c => c.id === g.primaryBefore.id);
                    if (primaryIdx >= 0) {
                        added[primaryIdx] = g.primaryBefore;
                    } else {
                        added.push(g.primaryBefore);
                    }
                    for (const o of g.others) {
                        if (!added.some(c => c.id === o.id)) added.push(o);
                    }
                    return added;
                });
            }
            if (snapshot.historyCount > 0) {
                setMergeHistory(prev => prev.slice(0, Math.max(0, prev.length - snapshot.historyCount)));
            }
            showNotification('Undo completed.');
        } catch (e) {
            console.error('Undo failed', e);
            showNotification('Error during undo.');
        }
    };

    const exportMergeHistoryJson = () => {
        const blob = new Blob([JSON.stringify(mergeHistory, null, 2)], { type: 'application/json;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'merge-history.json';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    const exportMergeHistoryCsv = () => {
        const rows: string[] = [];
        rows.push(['timestamp', 'primaryId', 'otherIds', 'field', 'before', 'after'].join(','));
        for (const entry of mergeHistory) {
            const otherIds = entry.otherIds.join('|');
            for (const d of entry.diffs) {
                const esc = (s: any) => '"' + String(s ?? '').replace(/"/g, '""') + '"';
                rows.push([
                    esc(entry.timestamp),
                    esc(entry.primaryId),
                    esc(otherIds),
                    esc(d.label),
                    esc(d.before),
                    esc(d.after)
                ].join(','));
            }
        }
        const blob = new Blob([rows.join('\n')], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'merge-history.csv';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };
    
    // AI bulk add removed

    return (
        <>
            <Layout 
                currentView={currentView} 
                setCurrentView={setCurrentView}
                onImportClick={() => setImportModalOpen(true)}
            >
                {currentView === View.Database && (
                    <DatabaseView 
                        contacts={contacts} 
                        onAdd={handleOpenAddModal} 
                        onEdit={handleOpenEditModal}
                        onDelete={handleDeleteContact}
                        onQuickUpdate={handleQuickUpdate}
                        onOpenDuplicates={() => setDupesOpen(true)}
                        onOpenAdvancedImport={() => setAdvImportOpen(true)}
                        onBulkAddWithIds={async (list) => {
                            try {
                                // De-duplicate by email first; if missing email, use name+country; if website exists, also de-dup by website.
                                const norm = (s: string) => s.trim().toLowerCase();
                                const existingEmails = new Set(contacts.map(c => (c.email ? norm(c.email) : '')).filter(Boolean));
                                const existingNameCountry = new Set(contacts.map(c => `${norm(c.name)}|${norm(c.country)}`));
                                const existingWebsites = new Set(contacts.map(c => (c.website ? norm(c.website) : '')).filter(Boolean));

                                const seenEmails = new Set<string>();
                                const seenNameCountry = new Set<string>();
                                const seenWebsites = new Set<string>();
                                const deduped: Contact[] = [];
                                for (const c of list) {
                                    const e = c.email ? norm(c.email) : '';
                                    const nc = `${norm(c.name)}|${norm(c.country)}`;
                                    const w = c.website ? norm(c.website) : '';
                                    let duplicate = false;
                                    if (e) {
                                        if (existingEmails.has(e) || seenEmails.has(e)) duplicate = true;
                                    }
                                    if (!duplicate && w) {
                                        if (existingWebsites.has(w) || seenWebsites.has(w)) duplicate = true;
                                    }
                                    if (!duplicate) {
                                        if (existingNameCountry.has(nc) || seenNameCountry.has(nc)) duplicate = true;
                                    }
                                    if (duplicate) continue;
                                    if (e) seenEmails.add(e);
                                    if (w) seenWebsites.add(w);
                                    seenNameCountry.add(nc);
                                    deduped.push(c);
                                }
                                if (deduped.length === 0) {
                                    showNotification('No new contacts to import (all duplicates).');
                                    return;
                                }
                                await db.bulkAddContacts(deduped);
                                setContacts(prev => [...prev, ...deduped]);
                                const skipped = list.length - deduped.length;
                                const msg = skipped > 0 
                                    ? `Imported ${deduped.length} contacts. Skipped ${skipped} duplicate${skipped!==1?'s':''}.`
                                    : `Imported ${deduped.length} contacts from JSON.`;
                                showNotification(msg);
                            } catch (e) {
                                console.error(e);
                                showNotification('Error importing JSON contacts');
                            }
                        }}
                    />
                )}
                {currentView === View.Shortlist && (
// Fix: Pass `genres` prop to `ShortlistView`.
                    <ShortlistView contacts={contacts} genres={genres} />
                )}
                {currentView === View.Reporting && (
                    <ReportingView contacts={contacts} />
                )}
                {currentView === View.Settings && (
                    <SettingsView />
                )}
                {/* Campaign view removed for standalone app */}
            </Layout>

            {isContactModalOpen && (
// Fix: Pass `countries` and `genres` props to `ContactModal`.
                <ContactModal 
                    isOpen={isContactModalOpen}
                    onClose={() => setContactModalOpen(false)}
                    onSaveAdd={handleAddContact}
                    onSaveEdit={handleUpdateContact}
                    contactToEdit={contactToEdit}
                    countries={countries}
                    genres={genres}
                />
            )}

            {isDupesOpen && (
                <DuplicatesModal
                    isOpen={isDupesOpen}
                    onClose={() => setDupesOpen(false)}
                    contacts={contacts}
                    onMergeGroup={handleMergeGroup}
                    onMergeAll={handleMergeAll}
                />
            )}

            {isImportModalOpen && (
                 <ImportModal
                    isOpen={isImportModalOpen}
                    onClose={() => setImportModalOpen(false)}
                    onImport={handleImportContacts}
                />
            )}

            {isAdvImportOpen && (
                <AdvancedImportModal
                    isOpen={isAdvImportOpen}
                    onClose={() => setAdvImportOpen(false)}
                    onComplete={async () => {
                        const after = await db.getAllContacts();
                        setContacts(after);
                        showNotification('Advanced import completed');
                        setAdvImportOpen(false);
                    }}
                    loadExisting={db.getAllContacts}
                    addBulk={db.bulkAddContacts}
                    updateOne={db.updateContact}
                />
            )}

            {isMigrationOpen && (
                <MigrationModal
                    isOpen={isMigrationOpen}
                    onClose={() => setMigrationOpen(false)}
                    dexieCount={dexieCount}
                    sqliteCount={sqliteCount}
                    running={migrationRunning}
                    migrated={migrationMigrated}
                    total={migrationTotal}
                    status={migrationStatus}
                    error={migrationError}
                    onExportDexie={handleExportDexieJson}
                    onStart={handleStartMigration}
                />
            )}

            {isDupesOpen && (
                <DuplicatesModal
                    isOpen={isDupesOpen}
                    onClose={() => setDupesOpen(false)}
                    contacts={contacts}
                    onMergeGroup={handleMergeGroup}
                    onMergeAll={handleMergeAll}
                    onComputeMerged={(group, primaryId) => {
                        const primary = group.find(c => c.id === primaryId) || group[0];
                        const others = group.filter(c => c.id !== (primary?.id || ''));
                        return combineContacts(primary, others);
                    }}
                />
            )}

            {notification && (
                 <div className="fixed bottom-5 right-5 bg-indigo-600 text-white py-2 px-4 rounded-lg shadow-lg animate-fade-in-out z-50">
                    {notification}
                 </div>
            )}

            {(undoStack.length > 0 || mergeHistory.length > 0) && (
                <div className="fixed bottom-5 left-5 flex items-center gap-3 z-50">
                    {undoStack.length > 0 && (
                        <button
                            onClick={handleUndo}
                            className="bg-yellow-600 hover:bg-yellow-500 text-white py-2 px-4 rounded-lg shadow-lg"
                            title={`Undos available: ${undoStack.length}`}
                        >
                            Undo last merge
                        </button>
                    )}
                    {mergeHistory.length > 0 && (
                        <>
                            <button
                                onClick={exportMergeHistoryJson}
                                className="bg-gray-700 hover:bg-gray-600 text-white py-2 px-4 rounded-lg shadow-lg"
                            >
                                Export merges .json
                            </button>
                            <button
                                onClick={exportMergeHistoryCsv}
                                className="bg-gray-700 hover:bg-gray-600 text-white py-2 px-4 rounded-lg shadow-lg"
                            >
                                Export merges .csv
                            </button>
                        </>
                    )}
                </div>
            )}
        </>
    );
};

export default App;
    // Migration assistant state
    const [isMigrationOpen, setMigrationOpen] = useState(false);
    const [migrationRunning, setMigrationRunning] = useState(false);
    const [migrationMigrated, setMigrationMigrated] = useState(0);
    const [migrationTotal, setMigrationTotal] = useState(0);
    const [migrationStatus, setMigrationStatus] = useState('Idle');
    const [migrationError, setMigrationError] = useState<string | null>(null);
    const [dexieCount, setDexieCount] = useState<number | null>(null);
    const [sqliteCount, setSqliteCount] = useState<number | null>(null);
