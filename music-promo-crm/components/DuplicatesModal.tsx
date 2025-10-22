import React, { useMemo, useState } from 'react';
import { Contact } from '../types';

type Group = Contact[];

interface DuplicatesModalProps {
  isOpen: boolean;
  onClose: () => void;
  contacts: Contact[];
  onMergeGroup: (group: Group, primaryId: string) => Promise<void>;
  onMergeAll: (groups: Group[], pickPrimary: (g: Group) => string) => Promise<void>;
  onComputeMerged: (group: Group, primaryId: string) => Contact;
}

const norm = (s: string) => (s || '').trim().toLowerCase();

function buildGroups(contacts: Contact[]): Group[] {
  const used = new Set<string>();
  const groups: Group[] = [];

  const byEmail = new Map<string, Contact[]>();
  const byWebsite = new Map<string, Contact[]>();
  const byNameCountry = new Map<string, Contact[]>();

  for (const c of contacts) {
    const e = norm(c.email || '');
    const w = norm(c.website || '');
    const nc = `${norm(c.name)}|${norm(c.country)}`;
    if (e) {
      const arr = byEmail.get(e) || [];
      arr.push(c); byEmail.set(e, arr);
    }
    if (w) {
      const arr = byWebsite.get(w) || [];
      arr.push(c); byWebsite.set(w, arr);
    }
    const arr = byNameCountry.get(nc) || [];
    arr.push(c); byNameCountry.set(nc, arr);
  }

  const addGroup = (list: Contact[]) => {
    if (!list || list.length < 2) return;
    const group = list.filter(c => !used.has(c.id));
    if (group.length > 1) {
      group.forEach(c => used.add(c.id));
      groups.push(group);
    }
  };

  for (const arr of byEmail.values()) addGroup(arr);
  for (const arr of byWebsite.values()) addGroup(arr);
  for (const arr of byNameCountry.values()) addGroup(arr);

  return groups;
}

const pickDefaultPrimary = (group: Group): string => {
  // Prefer contact with email, then with website, else first
  const withEmail = group.find(c => norm(c.email));
  if (withEmail) return withEmail.id;
  const withWebsite = group.find(c => norm(c.website || ''));
  if (withWebsite) return withWebsite.id;
  return group[0].id;
};

export const DuplicatesModal: React.FC<DuplicatesModalProps> = ({ isOpen, onClose, contacts, onMergeGroup, onMergeAll, onComputeMerged }) => {
  const initialGroups = useMemo(() => buildGroups(contacts), [contacts]);
  const [groups, setGroups] = useState<Group[]>(initialGroups);
  const [primary, setPrimary] = useState<Record<string, string>>(() => {
    const map: Record<string, string> = {};
    initialGroups.forEach((g, idx) => { map[`g${idx}`] = pickDefaultPrimary(g); });
    return map;
  });
  const [merging, setMerging] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  if (!isOpen) return null;

  const handleMergeGroup = async (idx: number) => {
    try {
      setMerging(true);
      const g = groups[idx];
      if (!g) return;
      const pid = primary[`g${idx}`] || pickDefaultPrimary(g);
      await onMergeGroup(g, pid);
      const next = groups.slice();
      next.splice(idx, 1);
      setGroups(next);
    } finally {
      setMerging(false);
    }
  };

  const handleMergeAll = async () => {
    try {
      setMerging(true);
      await onMergeAll(groups, (g) => {
        const idx = groups.indexOf(g);
        return primary[`g${idx}`] || pickDefaultPrimary(g);
      });
      setGroups([]);
    } finally {
      setMerging(false);
    }
  };

  const renderDiff = (primaryContact: Contact, merged: Contact) => {
    const diffs: { label: string; before: any; after: any }[] = [];
    const push = (label: string, b: any, a: any, cmp: (x: any, y: any) => boolean = (x, y) => x === y) => {
      if (!cmp(b, a)) diffs.push({ label, before: b, after: a });
    };
    push('Name', primaryContact.name, merged.name);
    push('Email', primaryContact.email, merged.email);
    push('Website', primaryContact.website || '', merged.website || '');
    push('Country', primaryContact.country, merged.country);
    push('Type', primaryContact.type, merged.type);
    push('Verification', primaryContact.verificationStatus || 'unverified', merged.verificationStatus || 'unverified');
    push('Do Not Contact', !!primaryContact.doNotContact, !!merged.doNotContact);
    push('Genres', (primaryContact.genres || []).join(', '), (merged.genres || []).join(', '));
    push('Persons', (primaryContact.contactPersons || []).length, (merged.contactPersons || []).length);
    push('Socials', Object.keys(primaryContact.socials || {}).length, Object.keys(merged.socials || {}).length);

    if (diffs.length === 0) {
      return <div className="text-xs text-gray-500">No changes.</div>;
    }
    return (
      <ul className="text-xs space-y-1">
        {diffs.map((d, i) => (
          <li key={i} className="text-gray-300">
            <span className="text-gray-400">{d.label}:</span>{' '}
            <span className="text-red-300 line-through mr-1">{String(d.before)}</span>
            <span className="text-green-300">{String(d.after)}</span>
          </li>
        ))}
      </ul>
    );
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 flex justify-center items-center z-50">
      <div className="bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-5xl border border-gray-700 max-h-[85vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-bold text-white">Find & Merge Duplicates</h2>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowPreview(p => !p)}
              className="px-3 py-2 bg-gray-700 text-white rounded-md hover:bg-gray-600"
            >
              {showPreview ? 'Hide Preview' : 'Preview Merge All'}
            </button>
            <button
              onClick={handleMergeAll}
              disabled={groups.length === 0 || merging}
              className="px-3 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:bg-indigo-900"
            >
              {merging ? 'Merging…' : `Merge All (${groups.length})`}
            </button>
            <button onClick={onClose} className="px-3 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-500">Close</button>
          </div>
        </div>
        {groups.length === 0 ? (
          <div className="text-gray-400">No duplicate groups found.</div>
        ) : (
          <div className="space-y-4">
            {groups.map((g, gi) => (
              <div key={gi} className="border border-gray-700 rounded-lg p-4 bg-gray-900">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-lg font-semibold text-gray-200">Group {gi + 1} ({g.length} records)</h3>
                  <button
                    onClick={() => handleMergeGroup(gi)}
                    disabled={merging}
                    className="px-3 py-1.5 bg-indigo-600 text-white text-sm rounded-md hover:bg-indigo-700"
                  >
                    Merge Group
                  </button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {g.map(c => (
                    <label key={c.id} className="border border-gray-700 rounded-md p-3 bg-gray-800 flex items-start gap-3 cursor-pointer">
                      <input
                        type="radio"
                        name={`primary-${gi}`}
                        checked={(primary[`g${gi}`] || pickDefaultPrimary(g)) === c.id}
                        onChange={() => setPrimary(p => ({ ...p, [`g${gi}`]: c.id }))}
                        className="mt-1"
                        aria-label="Select primary record"
                      />
                      <div>
                        <div className="text-gray-100 font-medium">{c.name}</div>
                        <div className="text-gray-400 text-sm">{c.type} • {c.country}</div>
                        <div className="text-gray-400 text-sm break-all">{c.email || 'no email'}</div>
                        {c.website && <div className="text-gray-400 text-xs break-all">{c.website}</div>}
                        {c.genres?.length ? (
                          <div className="mt-1 flex flex-wrap gap-1">
                            {c.genres.slice(0,4).map(gx => (
                              <span key={gx} className="px-2 py-0.5 text-xs bg-indigo-500/20 text-indigo-300 rounded-full">{gx}</span>
                            ))}
                            {c.genres.length > 4 && <span className="text-xs text-gray-500">+{c.genres.length-4}</span>}
                          </div>
                        ) : null}
                      </div>
                    </label>
                  ))}
                </div>
                {showPreview && (() => {
                  const pid = primary[`g${gi}`] || pickDefaultPrimary(g);
                  const primaryContact = g.find(c => c.id === pid) || g[0];
                  const merged = onComputeMerged(g, pid);
                  return (
                    <div className="mt-3 p-3 border border-gray-700 bg-gray-800 rounded">
                      <div className="text-sm font-medium text-gray-200 mb-1">Preview changes (primary vs merged)</div>
                      {renderDiff(primaryContact, merged)}
                    </div>
                  );
                })()}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default DuplicatesModal;
