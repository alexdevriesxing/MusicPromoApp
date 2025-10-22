import React from 'react';

interface MigrationModalProps {
  isOpen: boolean;
  onClose: () => void;
  dexieCount: number | null;
  sqliteCount: number | null;
  running: boolean;
  migrated: number;
  total: number;
  status: string;
  error?: string | null;
  onExportDexie: () => void;
  onStart: () => void;
  onResume?: () => void;
}

const MigrationModal: React.FC<MigrationModalProps> = ({
  isOpen,
  onClose,
  dexieCount,
  sqliteCount,
  running,
  migrated,
  total,
  status,
  error,
  onExportDexie,
  onStart,
  onResume,
}) => {
  if (!isOpen) return null;
  const percent = total > 0 ? Math.min(100, Math.round((migrated / total) * 100)) : 0;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 flex justify-center items-center z-50">
      <div className="bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-2xl border border-gray-700">
        <h2 className="text-2xl font-bold text-white mb-2">Migrate Contacts to Desktop Database</h2>
        <p className="text-gray-400 mb-4">
          We detected local browser data (Dexie/IndexedDB). You can migrate it into the desktop database (SQLite) now.
          A JSON backup is recommended before migrating.
        </p>
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div className="p-3 bg-gray-900 border border-gray-700 rounded">
            <div className="text-gray-300 text-sm">Dexie (Browser)</div>
            <div className="text-white text-xl font-semibold">{dexieCount === null ? '…' : dexieCount}</div>
          </div>
          <div className="p-3 bg-gray-900 border border-gray-700 rounded">
            <div className="text-gray-300 text-sm">SQLite (Desktop)</div>
            <div className="text-white text-xl font-semibold">{sqliteCount === null ? '…' : sqliteCount}</div>
          </div>
        </div>

        <div className="flex items-center gap-3 mb-4">
          <button
            onClick={onExportDexie}
            className="px-3 py-2 bg-gray-700 text-white rounded-md hover:bg-gray-600"
          >
            Export Dexie JSON Backup
          </button>
          {!running ? (
            <button
              onClick={onStart}
              className="px-3 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
            >
              Start Migration
            </button>
          ) : (
            <button
              disabled
              className="px-3 py-2 bg-indigo-900 text-white rounded-md"
            >
              Migrating…
            </button>
          )}
          {onResume && !running && (
            <button
              onClick={onResume}
              className="px-3 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
            >
              Resume
            </button>
          )}
          <button onClick={onClose} className="ml-auto px-3 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-500">Close</button>
        </div>

        <div className="mb-2 text-sm text-gray-400">{status}</div>
        <div className="w-full h-3 bg-gray-700 rounded overflow-hidden">
          <div className="h-full bg-indigo-600" style={{ width: `${percent}%` }} />
        </div>
        <div className="mt-1 text-xs text-gray-500">{migrated} / {total} migrated ({percent}%)</div>
        {error && <div className="mt-3 text-sm text-red-400">{error}</div>}
      </div>
    </div>
  );
};

export default MigrationModal;

