import React, { useMemo, useRef, useState } from 'react';
import { Contact, ContactType } from '../types';

declare const Papa: any;

type Mapping = {
  name?: string;
  email?: string;
  website?: string;
  country?: string;
  type?: string;
  genres?: string; // comma-separated
};

type DedupKeys = {
  email: boolean;
  website: boolean;
  nameCountry: boolean;
};

type UpdateMode = 'skip' | 'update' | 'replace';

type UpdateFields = {
  name: boolean;
  email: boolean;
  website: boolean;
  country: boolean;
  type: boolean;
  genres: 'merge' | 'replace' | 'skip';
  doNotContact: 'or' | 'replace' | 'skip';
};

type ConflictEntry = {
  row: number;
  reason: string;
  name?: string;
  email?: string;
  website?: string;
  country?: string;
};

interface AdvancedImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: (result: { inserted: number; updated: number; skipped: number; errors: number }) => void;
  loadExisting: () => Promise<Contact[]>;
  addBulk: (contacts: Contact[]) => Promise<void>;
  updateOne: (contact: Contact) => Promise<void>;
}

const guessMapping = (headers: string[]): Mapping => {
  const map: Mapping = {};
  const lc = headers.map(h => h.toLowerCase());
  const find = (...names: string[]) => {
    for (const n of names) {
      const idx = lc.findIndex(h => h === n || h.includes(n));
      if (idx >= 0) return headers[idx];
    }
    return undefined;
  };
  map.name = find('name');
  map.email = find('email');
  map.website = find('website', 'url');
  map.country = find('country');
  map.type = find('type');
  map.genres = find('genres', 'genre');
  return map;
};

const toCsv = (rows: string[][]) => rows.map(r => r.map(v => '"' + String(v ?? '').replace(/"/g, '""') + '"').join(',')).join('\n');

export const AdvancedImportModal: React.FC<AdvancedImportModalProps> = ({ isOpen, onClose, onComplete, loadExisting, addBulk, updateOne }) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [mapping, setMapping] = useState<Mapping>({});
  const [dedup, setDedup] = useState<DedupKeys>({ email: true, website: true, nameCountry: true });
  const [mode, setMode] = useState<UpdateMode>('update');
  const [fields, setFields] = useState<UpdateFields>({
    name: true,
    email: false,
    website: true,
    country: false,
    type: false,
    genres: 'merge',
    doNotContact: 'or',
  });
  const [progress, setProgress] = useState({ processed: 0, total: 0 });
  const [running, setRunning] = useState(false);
  const [status, setStatus] = useState('Idle');
  const [conflicts, setConflicts] = useState<ConflictEntry[]>([]);
  const parserRef = useRef<any>(null);
  const cancelRef = useRef<boolean>(false);
  const [summary, setSummary] = useState({ inserted: 0, updated: 0, skipped: 0, errors: 0 });

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    Papa.parse(file, {
      preview: 1,
      header: true,
      complete: (res: any) => {
        const hdrs = res.meta?.fields || [];
        setHeaders(hdrs);
        setMapping(guessMapping(hdrs));
      },
    });
  };

  const startImport = async () => {
    const file = fileInputRef.current?.files?.[0];
    if (!file) return;
    setRunning(true);
    setStatus('Loading existing data…');
    setProgress({ processed: 0, total: 0 });
    setSummary({ inserted: 0, updated: 0, skipped: 0, errors: 0 });
    setConflicts([]);
    cancelRef.current = false;
    try {
      const existing = await loadExisting();
      const norm = (s: string) => (s || '').trim().toLowerCase();
      const emailToId = new Map<string, string>();
      const websiteToId = new Map<string, string>();
      const nameCountryToId = new Map<string, string>();
      const byId = new Map<string, Contact>();
      existing.forEach(c => {
        if (c.email) emailToId.set(norm(c.email), c.id);
        if (c.website) websiteToId.set(norm(c.website), c.id);
        nameCountryToId.set(`${norm(c.name)}|${norm(c.country)}`, c.id);
        byId.set(c.id, c);
      });

      const newBuffer: Contact[] = [];
      const chunkSize = 500;
      const flushNew = async () => {
        if (newBuffer.length > 0) {
          const n = newBuffer.length;
          await addBulk(newBuffer.splice(0, newBuffer.length));
          setSummary(s => ({ ...s, inserted: s.inserted + n }));
        }
      };

      const mapRow = (row: any, rowIndex: number): Contact | null => {
        try {
          const name = mapping.name ? String(row[mapping.name] || '').trim() : '';
          const email = mapping.email ? String(row[mapping.email] || '').trim() : '';
          const website = mapping.website ? String(row[mapping.website] || '').trim() : '';
          const country = mapping.country ? String(row[mapping.country] || '').trim() : '';
          const type = mapping.type ? String(row[mapping.type] || '').trim() : '';
          const genresStr = mapping.genres ? String(row[mapping.genres] || '').trim() : '';
          if (!name || !country) {
            setConflicts(prev => [...prev, { row: rowIndex, reason: 'Missing required name/country', name, email, website, country }]);
            setSummary(s => ({ ...s, errors: s.errors + 1 }));
            return null;
          }
          const contact: Contact = {
            id: `imp-${Date.now()}-${Math.random().toString(36).slice(2)}`,
            name,
            country,
            email,
            website: website || undefined,
            type: (Object.values(ContactType) as string[]).includes(type) ? (type as ContactType) : ContactType.RadioStation,
            verificationStatus: 'unverified',
            genres: genresStr ? genresStr.split(',').map((g: string) => g.trim()).filter(Boolean) : [],
            doNotContact: false,
          };
          return contact;
        } catch (e) {
          setSummary(s => ({ ...s, errors: s.errors + 1 }));
          return null;
        }
      };

      setStatus('Parsing CSV…');
      let processed = 0;
      parserRef.current = Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        worker: true,
        step: async (res: any, parser: any) => {
          parserRef.current = parser;
          if (cancelRef.current) {
            parser.abort();
            return;
          }
          const row = res.data;
          processed += 1;
          setProgress({ processed, total: 0 });
          const contact = mapRow(row, processed);
          if (!contact) return;

          const keyEmail = contact.email ? norm(contact.email) : '';
          const keyWebsite = contact.website ? norm(contact.website) : '';
          const keyNC = `${norm(contact.name)}|${norm(contact.country)}`;
          let existingId: string | undefined = undefined;
          if (dedup.email && keyEmail && emailToId.has(keyEmail)) existingId = emailToId.get(keyEmail);
          if (!existingId && dedup.website && keyWebsite && websiteToId.has(keyWebsite)) existingId = websiteToId.get(keyWebsite);
          if (!existingId && dedup.nameCountry && nameCountryToId.has(keyNC)) existingId = nameCountryToId.get(keyNC);

          try {
            if (existingId) {
              if (mode === 'skip') {
                setSummary(s => ({ ...s, skipped: s.skipped + 1 }));
                setConflicts(prev => [...prev, { row: processed, reason: 'Duplicate skipped', name: contact.name, email: contact.email, website: contact.website, country: contact.country }]);
              } else {
                const current = byId.get(existingId);
                if (!current) {
                  setSummary(s => ({ ...s, skipped: s.skipped + 1 }));
                  setConflicts(prev => [...prev, { row: processed, reason: 'Existing not cached; skipped', name: contact.name, email: contact.email, website: contact.website, country: contact.country }]);
                } else {
                  const updated: Contact = { ...current };
                  if (mode === 'replace' || mode === 'update') {
                    if (fields.name) updated.name = contact.name;
                    if (fields.email) updated.email = contact.email;
                    if (fields.website) updated.website = contact.website;
                    if (fields.country) updated.country = contact.country;
                    if (fields.type) updated.type = contact.type;
                    if (fields.genres === 'replace') updated.genres = contact.genres;
                    if (fields.genres === 'merge') {
                      const g = new Set<string>(updated.genres || []);
                      (contact.genres || []).forEach(x => g.add(x));
                      updated.genres = Array.from(g);
                    }
                    if (fields.doNotContact === 'replace') updated.doNotContact = contact.doNotContact;
                    if (fields.doNotContact === 'or') updated.doNotContact = !!(updated.doNotContact || contact.doNotContact);
                  }
                  await updateOne(updated);
                  byId.set(existingId, updated);
                  if (updated.email) emailToId.set(norm(updated.email), existingId);
                  if (updated.website) websiteToId.set(norm(updated.website), existingId);
                  nameCountryToId.set(`${norm(updated.name)}|${norm(updated.country)}`, existingId);
                  setSummary(s => ({ ...s, updated: s.updated + 1 }));
                }
              }
            } else {
              newBuffer.push(contact);
              if (newBuffer.length >= chunkSize) {
                const n = newBuffer.length;
                setStatus(`Inserting ${n} new…`);
                await addBulk(newBuffer.splice(0, newBuffer.length));
                setSummary(s => ({ ...s, inserted: s.inserted + n }));
                // update maps with those inserted
                // We don't have their IDs here since they were generated; we keep keys occupied to reduce follow-on dupes
                if (contact.email) emailToId.set(norm(contact.email), 'new');
                if (contact.website) websiteToId.set(norm(contact.website), 'new');
                nameCountryToId.set(`${norm(contact.name)}|${norm(contact.country)}`, 'new');
              }
            }
          } catch (err: any) {
            setSummary(s => ({ ...s, errors: s.errors + 1 }));
            setConflicts(prev => [...prev, { row: processed, reason: err?.message || 'Insert error', name: contact.name, email: contact.email, website: contact.website, country: contact.country }]);
          }
        },
        complete: async () => {
          try {
            if (newBuffer.length) {
              const n = newBuffer.length;
              setStatus(`Inserting final ${n} new…`);
              await addBulk(newBuffer.splice(0, newBuffer.length));
              setSummary(s => ({ ...s, inserted: s.inserted + n }));
            }
          } finally {
            setRunning(false);
            setStatus('Done');
            onComplete(summary);
          }
        },
        error: (err: any) => {
          setRunning(false);
          setStatus('Error');
        }
      });
    } catch (e) {
      setRunning(false);
      setStatus('Error');
    }
  };

  const cancel = () => {
    cancelRef.current = true;
    try { parserRef.current?.abort?.(); } catch {}
    setRunning(false);
    setStatus('Canceled');
  };

  const downloadConflicts = () => {
    const rows: string[][] = [['row', 'reason', 'name', 'email', 'website', 'country']];
    conflicts.forEach(c => rows.push([String(c.row), c.reason, c.name || '', c.email || '', c.website || '', c.country || '']));
    const blob = new Blob([toCsv(rows)], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'import-conflicts.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 flex justify-center items-center z-50">
      <div className="bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-5xl border border-gray-700 max-h-[90vh] overflow-y-auto">
        <h2 className="text-2xl font-bold text-white mb-3">Advanced CSV Import</h2>
        <p className="text-gray-400 mb-4 text-sm">Map your CSV columns, choose de-duplication/update strategy, and import large files with progress and cancel.</p>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">CSV File</label>
            <input ref={fileInputRef} type="file" accept=".csv" onChange={handleFile} className="w-full text-gray-200" />
          </div>

          {headers.length > 0 && (
            <div className="p-3 bg-gray-900 border border-gray-700 rounded">
              <div className="text-sm text-gray-300 mb-2">Column Mapping</div>
              <div className="grid grid-cols-1 md:grid-cols-6 gap-3">
                {(['name','email','website','country','type','genres'] as (keyof Mapping)[]).map((key) => (
                  <div key={key}>
                    <label className="block text-xs text-gray-400 mb-1">{key}</label>
                    <select
                      value={(mapping[key] || '') as string}
                      onChange={e => setMapping(m => ({ ...m, [key]: e.target.value }))}
                      className="w-full bg-gray-700 border border-gray-600 rounded-md py-1 px-2"
                    >
                      <option value="">-- not mapped --</option>
                      {headers.map(h => <option key={h} value={h}>{h}</option>)}
                    </select>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-3 bg-gray-900 border border-gray-700 rounded">
              <div className="text-sm text-gray-300 mb-2">De-duplication Keys</div>
              {(['email','website','nameCountry'] as (keyof DedupKeys)[]).map(k => (
                <label key={k} className="flex items-center gap-2 text-gray-300 text-sm">
                  <input type="checkbox" checked={dedup[k]} onChange={e => setDedup(d => ({ ...d, [k]: e.target.checked }))} /> {k}
                </label>
              ))}
            </div>
            <div className="p-3 bg-gray-900 border border-gray-700 rounded">
              <div className="text-sm text-gray-300 mb-2">On Duplicate</div>
              {(['skip','update','replace'] as UpdateMode[]).map(val => (
                <label key={val} className="flex items-center gap-2 text-gray-300 text-sm">
                  <input type="radio" name="dupMode" checked={mode===val} onChange={() => setMode(val)} /> {val}
                </label>
              ))}
            </div>
            <div className="p-3 bg-gray-900 border border-gray-700 rounded">
              <div className="text-sm text-gray-300 mb-2">Update Fields</div>
              {(['name','email','website','country','type'] as (keyof UpdateFields)[]).map(k => (
                k === 'genres' || k === 'doNotContact' ? null : (
                  <label key={k} className="flex items-center gap-2 text-gray-300 text-sm">
                    <input type="checkbox" checked={(fields as any)[k]} onChange={e => setFields(f => ({ ...f, [k]: e.target.checked }))} /> {k}
                  </label>
                )
              ))}
              <div className="mt-2 text-xs text-gray-400">Genres</div>
              <select value={fields.genres} onChange={e => setFields(f => ({ ...f, genres: e.target.value as any }))} className="w-full bg-gray-700 border border-gray-600 rounded-md py-1 px-2 text-xs">
                <option value="merge">Merge</option>
                <option value="replace">Replace</option>
                <option value="skip">Skip</option>
              </select>
              <div className="mt-2 text-xs text-gray-400">Do Not Contact</div>
              <select value={fields.doNotContact} onChange={e => setFields(f => ({ ...f, doNotContact: e.target.value as any }))} className="w-full bg-gray-700 border border-gray-600 rounded-md py-1 px-2 text-xs">
                <option value="or">OR</option>
                <option value="replace">Replace</option>
                <option value="skip">Skip</option>
              </select>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {!running ? (
              <button onClick={startImport} className="px-3 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700">Start Import</button>
            ) : (
              <button onClick={cancel} className="px-3 py-2 bg-yellow-600 text-white rounded-md hover:bg-yellow-500">Cancel</button>
            )}
            <button onClick={onClose} className="px-3 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-500">Close</button>
            {conflicts.length > 0 && (
              <button onClick={downloadConflicts} className="ml-auto px-3 py-2 bg-gray-700 text-white rounded-md hover:bg-gray-600">Download Conflict Report</button>
            )}
          </div>

          <div>
            <div className="text-sm text-gray-300 mb-1">{status}</div>
            <div className="w-full h-3 bg-gray-700 rounded overflow-hidden">
              <div className="h-full bg-indigo-600" style={{ width: progress.total ? `${Math.min(100, Math.round((progress.processed / progress.total) * 100))}%` : '0%' }} />
            </div>
            <div className="text-xs text-gray-500 mt-1">Processed: {progress.processed}</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdvancedImportModal;
