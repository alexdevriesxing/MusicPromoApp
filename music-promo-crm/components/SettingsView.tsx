import React, { useEffect, useMemo, useState } from 'react';
import { DownloadIcon } from './Icons';
import type { Contact, SortConfig } from '../types';
import * as storage from '../storage';

type Prefs = {
  pageSize: number;
  defaultSortKey: keyof Contact;
  defaultSortDir: 'ascending' | 'descending';
};

const PREFS_KEY = 'mpcrm:prefs';

const loadPrefs = (): Prefs => {
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return { pageSize: 25, defaultSortKey: 'name', defaultSortDir: 'ascending' } as Prefs;
};

const savePrefs = (p: Prefs) => {
  try { localStorage.setItem(PREFS_KEY, JSON.stringify(p)); } catch {}
};

export const SettingsView: React.FC = () => {
  const [prefs, setPrefs] = useState<Prefs>(loadPrefs);
  const [diag, setDiag] = useState<any | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const updateDiag = async () => {
    try {
      const d = await storage.getDiagnostics();
      setDiag(d);
    } catch (e) {
      setDiag(null);
    }
  };

  useEffect(() => { updateDiag(); }, []);

  const exportAllJson = async () => {
    setBusy('Exporting…');
    try {
      const all = await storage.getAllContacts();
      const blob = new Blob([JSON.stringify(all, null, 2)], { type: 'application/json;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'contacts-backup.json';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setMessage('Backup exported');
    } finally { setBusy(null); }
  };

  const resetDatabase = async () => {
    if (!confirm('This will delete ALL contacts and related data. Continue?')) return;
    setBusy('Resetting database…');
    try {
      await storage.clearAllData();
      await updateDiag();
      setMessage('Database cleared');
    } finally { setBusy(null); }
  };

  const loadSampleData = async () => {
    setBusy('Loading sample data…');
    try {
      const res = await fetch('/seed-data.json');
      const data: Contact[] = await res.json();
      await storage.bulkAddContacts(data as any);
      await updateDiag();
      setMessage('Sample data loaded');
    } catch { setMessage('Failed to load sample data'); }
    finally { setBusy(null); }
  };

  const rebuildFts = async () => {
    setBusy('Rebuilding search index…');
    try { await storage.rebuildSearchIndex(); await updateDiag(); setMessage('Search index rebuilt'); }
    finally { setBusy(null); }
  };

  const runMigrations = async () => {
    setBusy('Running migrations…');
    try { await storage.runMigrations(); await updateDiag(); setMessage('Migrations complete'); }
    finally { setBusy(null); }
  };

  const applyPrefs = () => {
    savePrefs(prefs);
    setMessage('Preferences saved');
  };

  return (
    <div className="space-y-6">
      <div className="p-4 bg-gray-800 rounded-lg border border-gray-700">
        <h3 className="text-lg font-semibold text-gray-200 mb-3">Preferences</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm text-gray-300 mb-1">Default Page Size</label>
            <select value={prefs.pageSize} onChange={e => setPrefs(p => ({ ...p, pageSize: Number(e.target.value) }))} className="w-full bg-gray-700 border border-gray-600 rounded-md py-2 px-3">
              {[10,25,50,100].map(n => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm text-gray-300 mb-1">Default Sort Key</label>
            <select value={prefs.defaultSortKey as string} onChange={e => setPrefs(p => ({ ...p, defaultSortKey: e.target.value as keyof Contact }))} className="w-full bg-gray-700 border border-gray-600 rounded-md py-2 px-3">
              {(['name','email','country','type'] as (keyof Contact)[]).map(k => <option key={String(k)} value={String(k)}>{String(k)}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm text-gray-300 mb-1">Default Sort Direction</label>
            <select value={prefs.defaultSortDir} onChange={e => setPrefs(p => ({ ...p, defaultSortDir: e.target.value as any }))} className="w-full bg-gray-700 border border-gray-600 rounded-md py-2 px-3">
              {(['ascending','descending'] as const).map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
        </div>
        <div className="mt-4"><button onClick={applyPrefs} className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700">Save Preferences</button></div>
        <p className="mt-2 text-xs text-gray-500">Note: Database view adopts new defaults next time it is opened.</p>
      </div>

      <div className="p-4 bg-gray-800 rounded-lg border border-gray-700">
        <h3 className="text-lg font-semibold text-gray-200 mb-3">Data Operations</h3>
        <div className="flex flex-wrap gap-3">
          <button onClick={exportAllJson} className="px-3 py-2 bg-gray-600 text-white rounded hover:bg-gray-500 flex items-center"><DownloadIcon className="h-5 w-5 mr-2"/>Backup (Export JSON)</button>
          <button onClick={resetDatabase} className="px-3 py-2 bg-red-600 text-white rounded hover:bg-red-500">Reset Database</button>
          <button onClick={loadSampleData} className="px-3 py-2 bg-gray-700 text-white rounded hover:bg-gray-600">Load Sample Data</button>
          <button onClick={rebuildFts} className="px-3 py-2 bg-gray-700 text-white rounded hover:bg-gray-600">Rebuild Search Index</button>
          <button onClick={runMigrations} className="px-3 py-2 bg-gray-700 text-white rounded hover:bg-gray-600">Run Migrations</button>
        </div>
        {busy && <div className="mt-3 text-sm text-gray-300">{busy}</div>}
        {message && <div className="mt-2 text-sm text-green-400">{message}</div>}
      </div>

      <div className="p-4 bg-gray-800 rounded-lg border border-gray-700">
        <h3 className="text-lg font-semibold text-gray-200 mb-3">Diagnostics</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-3 bg-gray-900 border border-gray-700 rounded">
            <div className="text-gray-300 text-sm">Schema Version</div>
            <div className="text-white text-xl font-semibold">{diag?.schemaVersion ?? '—'}</div>
          </div>
          <div className="p-3 bg-gray-900 border border-gray-700 rounded">
            <div className="text-gray-300 text-sm">Contacts</div>
            <div className="text-white text-xl font-semibold">{diag?.counts?.contacts ?? 0}</div>
          </div>
          <div className="p-3 bg-gray-900 border border-gray-700 rounded">
            <div className="text-gray-300 text-sm">Search Index Rows</div>
            <div className="text-white text-xl font-semibold">{diag?.counts?.contacts_fts ?? 0}</div>
          </div>
        </div>
        <div className="mt-3 text-sm text-gray-400">Other tables: persons {diag?.counts?.contact_persons ?? 0}, links {diag?.counts?.social_links ?? 0}, genres {diag?.counts?.contact_genres ?? 0}</div>
        <div className="mt-3"><button onClick={updateDiag} className="px-3 py-2 bg-gray-700 text-white rounded hover:bg-gray-600">Refresh</button></div>
      </div>
    </div>
  );
};

export default SettingsView;

