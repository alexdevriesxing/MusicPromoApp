import React, { useState, useMemo, useEffect } from 'react';
import { Contact, ContactType } from '../types';
import { isDesktop, searchContacts as dbSearchContacts } from '../storage';
import { DataTable } from './DataTable';
import { PlusIcon, SearchIcon, DownloadIcon } from './Icons';
import { CONTACT_TYPES } from '../constants';

interface DatabaseViewProps {
    contacts: Contact[];
    onAdd: () => void;
    onEdit: (contact: Contact) => void;
    onDelete: (id: string) => void;
    onQuickUpdate?: (contact: Contact) => void;
    onBulkAddWithIds?: (contacts: Contact[]) => void;
    onOpenDuplicates?: () => void;
    onOpenAdvancedImport?: () => void;
}

export const DatabaseView: React.FC<DatabaseViewProps> = ({ contacts, onAdd, onEdit, onDelete, onQuickUpdate, onBulkAddWithIds, onOpenDuplicates, onOpenAdvancedImport }) => {
    const [countryFilter, setCountryFilter] = useState<string>('All');
    const [searchTerm, setSearchTerm] = useState('');
    const [page, setPage] = useState<number>(1);
    const [pageSize, setPageSize] = useState<number>(() => {
        try {
            const raw = localStorage.getItem('mpcrm:prefs');
            if (raw) {
                const p = JSON.parse(raw);
                if (p && typeof p.pageSize === 'number') return p.pageSize;
            }
        } catch {}
        return 25;
    });
    const [ftsResults, setFtsResults] = useState<Contact[] | null>(null);
    const [isSearching, setIsSearching] = useState(false);
    const [showAdvanced, setShowAdvanced] = useState(false);
    const [advName, setAdvName] = useState('');
    const [advEmail, setAdvEmail] = useState('');
    const [advWebsite, setAdvWebsite] = useState('');
    const [advGenre, setAdvGenre] = useState('');
    const [advPerson, setAdvPerson] = useState('');
    const [advType, setAdvType] = useState('');
    const [verificationFilter, setVerificationFilter] = useState<'Any' | 'unverified' | 'verifying' | 'verified' | 'not_found' | 'error'>('Any');
    type SavedFilter = { name: string; searchTerm: string; country: string; verification?: string; pageSize?: number };
    const [savedFilters, setSavedFilters] = useState<SavedFilter[]>(() => {
        try {
            const raw = localStorage.getItem('mpcrm:savedFilters');
            return raw ? JSON.parse(raw) : [];
        } catch {
            return [];
        }
    });
    const [selectedSaved, setSelectedSaved] = useState<string>('');
    
    const availableCountries = useMemo(() => {
        const countryCounts: Record<string, number> = contacts.reduce((acc, contact) => {
            acc[contact.country] = (acc[contact.country] || 0) + 1;
            return acc;
        }, {});

        const sortedCountries = Object.keys(countryCounts).sort((a, b) => a.localeCompare(b));
        
        return [{ name: 'All', count: contacts.length }, ...sortedCountries.map(name => ({ name, count: countryCounts[name] }))];
    }, [contacts]);

    useEffect(() => {
        const run = async () => {
            const q = searchTerm.trim();
            const useFts = isDesktop() && ((q.length >= 2) || countryFilter !== 'All' || verificationFilter !== 'Any');
            if (!useFts) {
                setFtsResults(null);
                return;
            }
            setIsSearching(true);
            try {
                const res = await dbSearchContacts(
                    q,
                    countryFilter !== 'All' ? countryFilter : undefined,
                    { verificationStatus: verificationFilter === 'Any' ? undefined : (verificationFilter as any) }
                );
                setFtsResults(res);
                setPage(1);
            } catch (e) {
                console.error('FTS search failed', e);
                setFtsResults(null);
            } finally {
                setIsSearching(false);
            }
        };
        run();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [searchTerm, countryFilter, verificationFilter]);

    const filteredContacts = useMemo(() => {
        const base = ftsResults ?? contacts;
        let filtered = base;

        if (!ftsResults) {
            if (countryFilter !== 'All') {
                filtered = filtered.filter(c => c.country === countryFilter);
            }
            if (verificationFilter !== 'Any') {
                filtered = filtered.filter(c => (c.verificationStatus || 'unverified') === verificationFilter);
            }

            if (searchTerm) {
                const lowercasedTerm = searchTerm.toLowerCase();
                filtered = filtered.filter(contact =>
                    Object.entries(contact).some(([key, value]) => {
                        if (key === 'genres' && Array.isArray(value)) {
                            return value.some(g => g.toLowerCase().includes(lowercasedTerm));
                        }
                        if (typeof value === 'string' || typeof value === 'number') {
                            return String(value).toLowerCase().includes(lowercasedTerm);
                        }
                        return false;
                    })
                );
            }
        }
        return filtered;
    }, [contacts, countryFilter, searchTerm, ftsResults]);

    const total = filteredContacts.length;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const currentPage = Math.min(page, totalPages);
    const startIndex = (currentPage - 1) * pageSize;
    const endIndex = Math.min(startIndex + pageSize, total);
    const pageItems = useMemo(() => filteredContacts.slice(startIndex, endIndex), [filteredContacts, startIndex, endIndex]);

    const handleExportAll = () => {
        const esc = (s: any) => String(s ?? '').replace(/\|/g, '\\|');
        const header = '| id | name | type | country | email | website | genres |\n|---|---|---|---|---|---|---|\n';
        const rows = contacts.map(c => {
            const genres = Array.isArray(c.genres) ? c.genres.join(', ') : '';
            const row = [c.id, c.name, c.type, c.country, c.email || '', c.website || '', genres]
                .map(esc)
                .join(' | ');
            return `| ${row} |`;
        }).join('\n');
        const content = `# Contacts Export (current Dexie DB)\n\nGenerated: ${new Date().toISOString()}\n\n${header}${rows}\n`;
        const blob = new Blob([content], { type: 'text/markdown;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'contacts-export.md';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    const handleExportJson = () => {
        const blob = new Blob([JSON.stringify(contacts, null, 2)], { type: 'application/json;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'contacts-export.json';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    const exportFilteredJson = () => {
        const data = filteredContacts;
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'contacts-filtered.json';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    const exportFilteredCsv = () => {
        const rows: string[][] = [];
        rows.push(['id','name','type','country','email','website','genres']);
        filteredContacts.forEach(c => rows.push([
            c.id, c.name, String(c.type), c.country, c.email || '', c.website || '', (c.genres || []).join(';')
        ]));
        const toCsv = (rs: string[][]) => rs.map(r => r.map(v => '"'+String(v??'').replace(/"/g,'""')+'"').join(',')).join('\n');
        const blob = new Blob([toCsv(rows)], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'contacts-filtered.csv';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    const copyFilteredEmails = async () => {
        try {
            const emails = filteredContacts.map(c => c.email).filter(Boolean).join(', ');
            if (!emails) {
                alert('No email addresses in the current filtered set.');
                return;
            }
            await navigator.clipboard.writeText(emails);
            alert('Copied filtered emails to clipboard');
        } catch {
            alert('Copy failed. Select the list and copy manually.');
        }
    };

    const handleImportJsonClick = () => {
        fileInputRef.current?.click();
    };

    const handleImportJson = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => {
            try {
                const parsed = JSON.parse(String(reader.result));
                if (!Array.isArray(parsed)) throw new Error('JSON must be an array of contacts');
                const normalized: Contact[] = parsed.map((c: any) => ({
                    id: String(c.id ?? Date.now().toString() + Math.random().toString(36).slice(2)),
                    name: String(c.name ?? ''),
                    country: String(c.country ?? ''),
                    email: String(c.email ?? ''),
                    website: c.website ? String(c.website) : undefined,
                    type: c.type,
                    verificationStatus: c.verificationStatus ?? 'unverified',
                    verificationDetails: c.verificationDetails ?? undefined,
                    doNotContact: !!c.doNotContact,
                    genres: Array.isArray(c.genres) ? c.genres.map((g: any) => String(g)) : [],
                    contactPersons: Array.isArray(c.contactPersons) ? c.contactPersons.map((p: any) => ({
                        name: String(p.name ?? ''),
                        position: p.position ? String(p.position) : '',
                        email: p.email ? String(p.email) : ''
                    })) : [],
                    socials: c.socials && typeof c.socials === 'object' ? c.socials : undefined,
                }));
                onBulkAddWithIds?.(normalized);
            } catch (err: any) {
                alert(err?.message || 'Failed to import JSON');
            } finally {
                e.target.value = '';
            }
        };
        reader.onerror = () => {
            alert('Failed to read file');
            e.target.value = '';
        };
        reader.readAsText(file);
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center gap-4 flex-wrap">
                 <h2 className="text-2xl font-bold text-white">
                    Contact Database
                    <span className="ml-3 text-lg font-medium text-gray-400">({filteredContacts.length} total)</span>
                </h2>
                <div className="flex items-center gap-2">
                    <button
                        onClick={handleExportAll}
                        className="flex-shrink-0 flex items-center justify-center px-4 py-2 bg-gray-600 text-white font-semibold rounded-md hover:bg-gray-500 transition-colors duration-200 shadow-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-900 focus:ring-gray-400"
                        title="Export all contacts (Markdown)"
                    >
                        <DownloadIcon className="h-5 w-5 mr-2" />
                        Export .md
                    </button>
                    <button
                        onClick={() => onOpenDuplicates && onOpenDuplicates()}
                        className="flex-shrink-0 flex items-center justify-center px-4 py-2 bg-gray-700 text-white font-semibold rounded-md hover:bg-gray-600 transition-colors duration-200 shadow-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-900 focus:ring-gray-400"
                        title="Find and merge duplicate contacts"
                    >
                        Find Duplicates
                    </button>
                    <button
                        onClick={exportFilteredJson}
                        className="flex-shrink-0 flex items-center justify-center px-4 py-2 bg-gray-600 text-white font-semibold rounded-md hover:bg-gray-500 transition-colors duration-200 shadow-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-900 focus:ring-gray-400"
                        title="Export filtered contacts (JSON)"
                    >
                        Export filtered .json
                    </button>
                    <button
                        onClick={exportFilteredCsv}
                        className="flex-shrink-0 flex items-center justify-center px-4 py-2 bg-gray-600 text-white font-semibold rounded-md hover:bg-gray-500 transition-colors duration-200 shadow-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-900 focus:ring-gray-400"
                        title="Export filtered contacts (CSV)"
                    >
                        Export filtered .csv
                    </button>
                    <button
                        onClick={copyFilteredEmails}
                        className="flex-shrink-0 flex items-center justify-center px-4 py-2 bg-indigo-600 text-white font-semibold rounded-md hover:bg-indigo-700 transition-colors duration-200 shadow-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-900 focus:ring-indigo-500"
                        title="Copy filtered email addresses"
                    >
                        Copy filtered emails
                    </button>
                    <button
                        onClick={handleExportJson}
                        className="flex-shrink-0 flex items-center justify-center px-4 py-2 bg-gray-600 text-white font-semibold rounded-md hover:bg-gray-500 transition-colors duration-200 shadow-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-900 focus:ring-gray-400"
                        title="Export all contacts (JSON)"
                    >
                        <DownloadIcon className="h-5 w-5 mr-2" />
                        Export .json
                    </button>
                    <button
                        onClick={() => onOpenAdvancedImport && onOpenAdvancedImport()}
                        className="flex-shrink-0 flex items-center justify-center px-4 py-2 bg-gray-700 text-white font-semibold rounded-md hover:bg-gray-600 transition-colors duration-200 shadow-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-900 focus:ring-gray-400"
                        title="Advanced CSV import"
                    >
                        Advanced Import
                    </button>
                    <button
                        onClick={handleImportJsonClick}
                        className="flex-shrink-0 flex items-center justify-center px-4 py-2 bg-gray-700 text-white font-semibold rounded-md hover:bg-gray-600 transition-colors duration-200 shadow-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-900 focus:ring-gray-400"
                        title="Import contacts from JSON"
                    >
                        Import .json
                    </button>
                    <button
                        onClick={onAdd}
                        className="flex-shrink-0 flex items-center justify-center px-4 py-2 bg-indigo-600 text-white font-semibold rounded-md hover:bg-indigo-700 transition-colors duration-200 shadow-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-900 focus:ring-indigo-500"
                    >
                        <PlusIcon className="h-5 w-5 mr-2" />
                        Add Contact
                    </button>
                    <input ref={fileInputRef} type="file" accept="application/json" className="hidden" onChange={handleImportJson} />
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-gray-800 rounded-lg border border-gray-700" aria-busy={isSearching} aria-live="polite">
                <div className="md:col-span-1">
                    <label htmlFor="search-input" className="sr-only">Search</label>
                    <div className="relative">
                        <span className="absolute inset-y-0 left-0 flex items-center pl-3">
                            <SearchIcon className="h-5 w-5 text-gray-500" />
                        </span>
                        <input
                            id="search-input"
                            type="text"
                            placeholder='Search all fields... (e.g., name:radio email:gmail.com "indie rock")'
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 bg-gray-700 border border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition"
                        />
                        {isSearching && (
                            <span className="absolute inset-y-0 right-3 flex items-center text-sm text-gray-400">Searching…</span>
                        )}
                    </div>
                </div>
                <div className="md:col-span-1">
                    <label htmlFor="country-filter" className="sr-only">Filter by Country</label>
                    <select
                        id="country-filter"
                        value={countryFilter}
                        onChange={e => setCountryFilter(e.target.value)}
                        className="w-full bg-gray-700 border border-gray-600 rounded-md py-2 px-3 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition"
                    >
                        {availableCountries.map(({ name, count }) => (
                            <option key={name} value={name}>
                                {name === 'All' ? 'All Countries' : name} ({count})
                            </option>
                        ))}
                    </select>
                </div>
                <div className="md:col-span-1">
                    <label htmlFor="verification-filter" className="sr-only">Filter by Verification</label>
                    <select
                        id="verification-filter"
                        value={verificationFilter}
                        onChange={e => setVerificationFilter(e.target.value as any)}
                        className="w-full bg-gray-700 border border-gray-600 rounded-md py-2 px-3 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition"
                    >
                        {(['Any','unverified','verifying','verified','not_found','error'] as const).map(v => (
                            <option key={v} value={v}>{v === 'Any' ? 'Any Verification' : v}</option>
                        ))}
                    </select>
                </div>
            </div>

            <div className="p-4 bg-gray-800 rounded-lg border border-gray-700">
                <button
                    onClick={() => setShowAdvanced(v => !v)}
                    className="text-sm font-medium text-indigo-400 hover:text-indigo-300"
                >
                    {showAdvanced ? 'Hide Advanced Filters' : 'Show Advanced Filters'}
                </button>
                {showAdvanced && (
                    <div className="grid grid-cols-1 md:grid-cols-6 gap-4 mt-4">
                        <div>
                            <label className="block text-sm text-gray-300 mb-1">Name</label>
                            <input value={advName} onChange={e => setAdvName(e.target.value)} className="w-full bg-gray-700 border border-gray-600 rounded-md py-2 px-3 focus:outline-none" />
                        </div>
                        <div>
                            <label className="block text-sm text-gray-300 mb-1">Email</label>
                            <input value={advEmail} onChange={e => setAdvEmail(e.target.value)} className="w-full bg-gray-700 border border-gray-600 rounded-md py-2 px-3 focus:outline-none" />
                        </div>
                        <div>
                            <label className="block text-sm text-gray-300 mb-1">Website</label>
                            <input value={advWebsite} onChange={e => setAdvWebsite(e.target.value)} className="w-full bg-gray-700 border border-gray-600 rounded-md py-2 px-3 focus:outline-none" />
                        </div>
                        <div>
                            <label className="block text-sm text-gray-300 mb-1">Genre</label>
                            <input value={advGenre} onChange={e => setAdvGenre(e.target.value)} className="w-full bg-gray-700 border border-gray-600 rounded-md py-2 px-3 focus:outline-none" />
                        </div>
                        <div>
                            <label className="block text-sm text-gray-300 mb-1">Person</label>
                            <input value={advPerson} onChange={e => setAdvPerson(e.target.value)} className="w-full bg-gray-700 border border-gray-600 rounded-md py-2 px-3 focus:outline-none" />
                        </div>
                        <div>
                            <label className="block text-sm text-gray-300 mb-1">Type</label>
                            <select value={advType} onChange={e => setAdvType(e.target.value)} className="w-full bg-gray-700 border border-gray-600 rounded-md py-2 px-3 focus:outline-none">
                                <option value="">Any</option>
                                {CONTACT_TYPES.map(t => (
                                    <option key={t} value={t}>{t}</option>
                                ))}
                            </select>
                        </div>
                        <div className="md:col-span-6 flex items-center gap-3">
                            <button
                                onClick={() => {
                                    const parts: string[] = [];
                                    if (advName.trim()) parts.push(`name:"${advName.trim()}"`);
                                    if (advEmail.trim()) parts.push(`email:${advEmail.trim()}`);
                                    if (advWebsite.trim()) parts.push(`website:${advWebsite.trim()}`);
                                    if (advGenre.trim()) parts.push(`genre:"${advGenre.trim()}"`);
                                    if (advPerson.trim()) parts.push(`person:"${advPerson.trim()}"`);
                                    if (advType.trim()) parts.push(`type:"${advType.trim()}"`);
                                    setSearchTerm(parts.join(' '));
                                    setPage(1);
                                }}
                                className="px-3 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:bg-indigo-900"
                                disabled={isSearching}
                            >Apply</button>
                            <button
                                onClick={() => { setAdvName(''); setAdvEmail(''); setAdvWebsite(''); setAdvGenre(''); setAdvPerson(''); setAdvType(''); setSearchTerm(''); setPage(1); }}
                                className="px-3 py-2 bg-gray-700 text-white rounded-md hover:bg-gray-600"
                            >Clear</button>
                            <div className="text-xs text-gray-500">Advanced filters will build a structured search query.</div>
                        </div>
                    </div>
                )}
            </div>

            <div className="p-4 bg-gray-800 rounded-lg border border-gray-700 flex items-center gap-3">
                <div className="text-sm text-gray-300">Saved Filters</div>
                <select
                    value={selectedSaved}
                    onChange={e => setSelectedSaved(e.target.value)}
                    className="bg-gray-700 border border-gray-600 rounded-md py-2 px-3"
                >
                    <option value="">-- select --</option>
                    {savedFilters.map(sf => (
                        <option key={sf.name} value={sf.name}>{sf.name}</option>
                    ))}
                </select>
                <button
                    onClick={() => {
                        const name = window.prompt('Save current filter as…');
                        if (!name) return;
                        const next = {
                            name,
                            searchTerm,
                            country: countryFilter,
                            verification: verificationFilter === 'Any' ? undefined : verificationFilter,
                            pageSize,
                        };
                        const updated = [...savedFilters.filter(s => s.name !== name), next];
                        setSavedFilters(updated);
                        try { localStorage.setItem('mpcrm:savedFilters', JSON.stringify(updated)); } catch {}
                        setSelectedSaved(name);
                    }}
                    className="px-3 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 text-sm"
                >Save</button>
                <button
                    onClick={() => {
                        const sf = savedFilters.find(s => s.name === selectedSaved);
                        if (!sf) return;
                        setSearchTerm(sf.searchTerm);
                        setCountryFilter(sf.country);
                        setVerificationFilter((sf.verification as any) || 'Any');
                        if (sf.pageSize) setPageSize(sf.pageSize);
                        setPage(1);
                    }}
                    className="px-3 py-2 bg-gray-700 text-white rounded-md hover:bg-gray-600 text-sm"
                >Apply</button>
                <button
                    onClick={() => {
                        if (!selectedSaved) return;
                        const updated = savedFilters.filter(s => s.name !== selectedSaved);
                        setSavedFilters(updated);
                        setSelectedSaved('');
                        try { localStorage.setItem('mpcrm:savedFilters', JSON.stringify(updated)); } catch {}
                    }}
                    className="px-3 py-2 bg-red-600 text-white rounded-md hover:bg-red-500 text-sm"
                >Delete</button>
            </div>

            <DataTable 
                contacts={pageItems} 
                onEdit={onEdit} 
                onDelete={onDelete}
                onQuickUpdate={onQuickUpdate}
                initialSort={(() => {
                    try {
                        const raw = localStorage.getItem('mpcrm:prefs');
                        if (raw) {
                            const p = JSON.parse(raw);
                            if (p?.defaultSortKey && p?.defaultSortDir) return { key: p.defaultSortKey, direction: p.defaultSortDir } as any;
                        }
                    } catch {}
                    return { key: 'name', direction: 'ascending' };
                })()}
            />

            <div className="flex items-center justify-between mt-4 text-sm text-gray-400">
                <div>
                    Showing {total === 0 ? 0 : startIndex + 1}–{endIndex} of {total}
                </div>
                <div className="flex items-center gap-2">
                    <label htmlFor="page-size">Rows per page</label>
                    <select
                        id="page-size"
                        value={pageSize}
                        onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}
                        className="bg-gray-700 border border-gray-600 rounded-md py-1 px-2 focus:outline-none"
                    >
                        {[10, 25, 50, 100].map(n => <option key={n} value={n}>{n}</option>)}
                    </select>
                    <button
                        onClick={() => setPage(p => Math.max(1, p - 1))}
                        disabled={currentPage <= 1}
                        className="px-2 py-1 bg-gray-700 border border-gray-600 rounded disabled:opacity-50"
                    >Prev</button>
                    <span>Page {currentPage} / {totalPages}</span>
                    <button
                        onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                        disabled={currentPage >= totalPages}
                        className="px-2 py-1 bg-gray-700 border border-gray-600 rounded disabled:opacity-50"
                    >Next</button>
                    <span className="ml-2">Jump to</span>
                    <input
                        type="number"
                        min={1}
                        max={totalPages}
                        defaultValue={currentPage}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                                const val = Number((e.target as HTMLInputElement).value);
                                if (!Number.isFinite(val)) return;
                                const clamped = Math.min(totalPages, Math.max(1, val));
                                setPage(clamped);
                            }
                        }}
                        className="w-16 bg-gray-700 border border-gray-600 rounded-md py-1 px-2 focus:outline-none"
                        aria-label="Jump to page"
                    />
                    <button
                        onClick={(e) => {
                            const input = (e.currentTarget.previousElementSibling as HTMLInputElement);
                            const val = Number(input.value);
                            if (!Number.isFinite(val)) return;
                            const clamped = Math.min(totalPages, Math.max(1, val));
                            setPage(clamped);
                        }}
                        className="px-2 py-1 bg-gray-700 border border-gray-600 rounded"
                    >Go</button>
                </div>
            </div>
        </div>
    );
};
    const fileInputRef = React.useRef<HTMLInputElement | null>(null);
