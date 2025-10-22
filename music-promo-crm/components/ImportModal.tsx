
import React, { useState } from 'react';
import { Contact } from '../types';
import { UploadIcon } from './Icons';

declare const Papa: any;

interface ImportModalProps {
    isOpen: boolean;
    onClose: () => void;
    onImport: (contacts: Omit<Contact, 'id'>[]) => void;
}

export const ImportModal: React.FC<ImportModalProps> = ({ isOpen, onClose, onImport }) => {
    const [googleSheetLink, setGoogleSheetLink] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const linkRef = React.useRef<HTMLInputElement | null>(null);

    const processData = (results: any) => {
        if (results.errors.length > 0) {
            console.error("Parsing errors:", results.errors);
            setError(`Error parsing CSV on row ${results.errors[0].row}. Please check the file format.`);
            return;
        }

        const requiredHeaders = ['name', 'type', 'country', 'genres', 'email'];
        const headers = results.meta.fields;
        if (!headers || !requiredHeaders.every(h => headers.includes(h))) {
            setError(`CSV must contain the following headers: ${requiredHeaders.join(', ')}.`);
            return;
        }
        
        const newContacts: Omit<Contact, 'id'>[] = results.data.map((row: any) => ({
            name: row.name || '',
            type: row.type || '',
            country: row.country || '',
            genres: row.genres ? row.genres.split(',').map((g: string) => g.trim()) : [],
            email: row.email || '',
            website: row.website || '',
        })).filter((c: Omit<Contact, 'id'>) => c.name && c.email); // Basic validation

        onImport(newContacts);
        onClose();
    };
    
    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        setError(null);
        const file = event.target.files?.[0];
        if (file) {
            setIsLoading(true);
            Papa.parse(file, {
                header: true,
                skipEmptyLines: true,
                complete: (results: any) => {
                    setIsLoading(false);
                    processData(results);
                },
                error: (err: any) => {
                    setIsLoading(false);
                    setError(`Failed to parse file: ${err.message}`);
                }
            });
        }
    };

    const handleGoogleSheetImport = () => {
        if (!googleSheetLink) {
            setError('Please provide a Google Sheets link.');
            return;
        }
        // Transform the public URL to a CSV export URL
        const csvUrl = googleSheetLink.replace('/edit?usp=sharing', '/export?format=csv').replace('/edit', '/export?format=csv');
        setError(null);
        setIsLoading(true);

        Papa.parse(csvUrl, {
            download: true,
            header: true,
            skipEmptyLines: true,
            complete: (results: any) => {
                setIsLoading(false);
                processData(results);
            },
            error: (err: any) => {
                setIsLoading(false);
                setError(`Failed to fetch or parse Google Sheet. Please ensure the link is correct and the sheet is 'Published to the web' as a CSV. Error: ${err.message}`);
            }
        });
    };

    React.useEffect(() => {
        if (isOpen) setTimeout(() => linkRef.current?.focus(), 0);
    }, [isOpen]);

    const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => { if (e.key === 'Escape') onClose(); };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex justify-center items-center z-50" onKeyDown={onKeyDown}>
            <div className="bg-gray-800 rounded-lg shadow-xl p-8 w-full max-w-lg border border-gray-700">
                <h2 className="text-2xl font-bold mb-4 text-white">Import Contacts</h2>
                <p className="text-gray-400 mb-6 text-sm">Upload a CSV file or paste a Google Sheets link. The file must have columns: `name`, `type`, `country`, `genres` (comma-separated), `email`, and `website` (optional).</p>
                
                {error && <div className="bg-red-500/20 text-red-300 p-3 rounded-md mb-4 text-sm">{error}</div>}

                <div className="space-y-6">
                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">From CSV File</label>
                        <div className="relative">
                           <input type="file" id="csv-upload" accept=".csv" onChange={handleFileChange} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
                           <label htmlFor="csv-upload" className="flex items-center justify-center w-full px-4 py-3 bg-gray-700 text-gray-300 rounded-md border-2 border-dashed border-gray-500 hover:border-indigo-500 hover:bg-gray-600 transition cursor-pointer">
                                <UploadIcon className="h-5 w-5 mr-2" />
                                <span>{isLoading ? 'Processing...' : 'Click to select a CSV file'}</span>
                           </label>
                        </div>
                    </div>
                    
                    <div className="text-center text-gray-500">OR</div>

                    <div>
                        <label htmlFor="gsheet-link" className="block text-sm font-medium text-gray-300 mb-2">From Google Sheets Link</label>
                        <div className="flex gap-2">
                           <input
                                type="text"
                                id="gsheet-link"
                                ref={linkRef}
                                value={googleSheetLink}
                                onChange={e => setGoogleSheetLink(e.target.value)}
                                placeholder="Paste public Google Sheets link here"
                                className="flex-grow bg-gray-700 border border-gray-600 rounded-md py-2 px-3 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            />
                            <button onClick={handleGoogleSheetImport} disabled={isLoading} className="px-4 py-2 bg-indigo-600 text-white font-semibold rounded-md hover:bg-indigo-700 disabled:bg-indigo-800 disabled:cursor-wait transition">
                                {isLoading ? 'Loading...' : 'Import'}
                            </button>
                        </div>
                        <p className="text-xs text-gray-500 mt-2">Note: In Google Sheets, go to File &gt; Share &gt; Publish to web, select "Comma-separated values (.csv)", and publish. Use that link.</p>
                    </div>
                </div>

                <div className="mt-8 text-right">
                    <button onClick={onClose} className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-500 transition">Close</button>
                </div>
            </div>
        </div>
    );
};
