
import React, { useState, useMemo } from 'react';
import { Contact } from '../types';
// Fix: Removed non-existent GENRES import. Genres are now passed as a prop.
import { CONTACT_TYPES } from '../constants';
import { CopyIcon, FilterIcon, DownloadIcon, ExportIcon, SearchIcon, SortDownIcon, SortUpIcon } from './Icons';

declare const Papa: any;

interface ShortlistViewProps {
    contacts: Contact[];
    // Fix: Added genres to props to receive the list of available genres.
    genres: string[];
}

type SortableKey = 'name' | 'email' | 'type' | 'country';

export const ShortlistView: React.FC<ShortlistViewProps> = ({ contacts, genres }) => {
    const [selectedCountry, setSelectedCountry] = useState<string>('All');
    const [selectedGenres, setSelectedGenres] = useState<string[]>([]);
    const [selectedType, setSelectedType] = useState<string>('All');
    const [copySuccess, setCopySuccess] = useState('');
    const [genreSearch, setGenreSearch] = useState('');
    const [shortlistSearchTerm, setShortlistSearchTerm] = useState('');
    const [sortConfig, setSortConfig] = useState<{ key: SortableKey; direction: 'ascending' | 'descending' }>({ key: 'name', direction: 'ascending' });

    const availableCountries = useMemo(() => {
        const countryCounts = contacts.reduce((acc: Record<string, number>, contact) => {
            acc[contact.country] = (acc[contact.country] || 0) + 1;
            return acc;
        }, {});
        
        return Object.entries(countryCounts)
            .map(([name, count]) => ({ name, count }))
            .sort((a, b) => a.name.localeCompare(b.name));
    }, [contacts]);

    const availableTypes = useMemo(() => {
        const typeCounts = contacts.reduce((acc: Record<string, number>, contact) => {
            acc[contact.type] = (acc[contact.type] || 0) + 1;
            return acc;
        }, {});

        return CONTACT_TYPES.map(type => ({
            name: type,
            count: typeCounts[type] || 0,
        })).filter(t => t.count > 0);
    }, [contacts]);

    const filteredContacts = useMemo(() => {
        const lowercasedTerm = shortlistSearchTerm.toLowerCase();
        return contacts
            .filter(contact => {
                if (contact.doNotContact) {
                    return false;
                }
                const countryMatch = selectedCountry === 'All' || contact.country === selectedCountry;
                const typeMatch = selectedType === 'All' || contact.type === selectedType;
                const genreMatch = selectedGenres.length === 0 || selectedGenres.some(g => contact.genres.includes(g));
                const searchMatch = !shortlistSearchTerm ||
                    contact.name.toLowerCase().includes(lowercasedTerm) ||
                    contact.email.toLowerCase().includes(lowercasedTerm);

                return countryMatch && typeMatch && genreMatch && searchMatch;
            });
    }, [contacts, selectedCountry, selectedGenres, selectedType, shortlistSearchTerm]);

    const sortedContacts = useMemo(() => {
        const sortableItems = [...filteredContacts];
        sortableItems.sort((a, b) => {
            const aValue = a[sortConfig.key];
            const bValue = b[sortConfig.key];

            if (typeof aValue === 'string' && typeof bValue === 'string') {
                 if (aValue.toLowerCase() < bValue.toLowerCase()) {
                    return sortConfig.direction === 'ascending' ? -1 : 1;
                }
                if (aValue.toLowerCase() > bValue.toLowerCase()) {
                    return sortConfig.direction === 'ascending' ? 1 : -1;
                }
            }
            return 0;
        });
        return sortableItems;
    }, [filteredContacts, sortConfig]);

    const filteredEmails = useMemo(() => {
        return sortedContacts.map(contact => contact.email).join(', ');
    }, [sortedContacts]);

    const handleCopy = () => {
        if (filteredEmails) {
            navigator.clipboard.writeText(filteredEmails).then(() => {
                setCopySuccess('Copied!');
                setTimeout(() => setCopySuccess(''), 2000);
            }, () => {
                setCopySuccess('Failed to copy.');
                setTimeout(() => setCopySuccess(''), 2000);
            });
        }
    };
    
    const handleDownload = () => {
        if (!filteredEmails) return;

        const blob = new Blob([filteredEmails], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'email_shortlist.txt';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    };

    const handleExportCsv = () => {
        if (sortedContacts.length === 0) return;
    
        const csvData = sortedContacts.map(contact => ({
            name: contact.name,
            email: contact.email,
        }));
    
        const csvString = Papa.unparse(csvData);
    
        const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'contact_shortlist.csv';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    };

    const handleClearFilters = () => {
        setSelectedCountry('All');
        setSelectedGenres([]);
        setSelectedType('All');
        setGenreSearch('');
        setShortlistSearchTerm('');
        setSortConfig({ key: 'name', direction: 'ascending' });
    };

    const handleGenreToggle = (genre: string) => {
        const newSelectedGenres = new Set(selectedGenres);
        if (newSelectedGenres.has(genre)) {
            newSelectedGenres.delete(genre);
        } else {
            newSelectedGenres.add(genre);
        }
        setSelectedGenres(Array.from(newSelectedGenres));
    };

    const filteredGenresForDisplay = useMemo(() =>
        // Fix: Use `genres` prop instead of non-existent `GENRES` constant.
        genres.filter(genre =>
            genre.toLowerCase().includes(genreSearch.toLowerCase())
        ), [genres, genreSearch]
    );

    const areAllFilteredGenresSelected = useMemo(() =>
        filteredGenresForDisplay.length > 0 && filteredGenresForDisplay.every(g => selectedGenres.includes(g)),
        [filteredGenresForDisplay, selectedGenres]
    );
    
    const isAnyFilteredGenreSelected = useMemo(() =>
        filteredGenresForDisplay.some(g => selectedGenres.includes(g)),
        [filteredGenresForDisplay, selectedGenres]
    );

    const handleSelectAllVisible = () => {
        const newSelectedGenres = new Set(selectedGenres);
        filteredGenresForDisplay.forEach(genre => newSelectedGenres.add(genre));
        setSelectedGenres(Array.from(newSelectedGenres));
    };

    const handleDeselectAllVisible = () => {
        const newSelectedGenres = new Set(selectedGenres);
        filteredGenresForDisplay.forEach(genre => newSelectedGenres.delete(genre));
        setSelectedGenres(Array.from(newSelectedGenres));
    };

    const requestSort = (key: SortableKey) => {
        let direction: 'ascending' | 'descending' = 'ascending';
        if (sortConfig.key === key && sortConfig.direction === 'ascending') {
            direction = 'descending';
        }
        setSortConfig({ key, direction });
    };

    const SortableHeader: React.FC<{
        label: string;
        sortKey: SortableKey;
    }> = ({ label, sortKey }) => {
        const isSorted = sortConfig.key === sortKey;
        const direction = isSorted ? sortConfig.direction : undefined;
    
        return (
            <th
                className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider cursor-pointer select-none group"
                onClick={() => requestSort(sortKey)}
                scope="col"
            >
                <div className="flex items-center">
                    {label}
                    <span className="ml-2">
                        {isSorted ? (
                            direction === 'ascending' ? <SortUpIcon className="h-4 w-4 text-indigo-400" /> : <SortDownIcon className="h-4 w-4 text-indigo-400" />
                        ) : (
                           <SortUpIcon className="h-4 w-4 text-gray-600 group-hover:text-gray-400 transition" />
                        )}
                    </span>
                </div>
            </th>
        );
    };

    return (
        <div className="bg-gray-800 p-6 rounded-lg shadow-lg border border-gray-700">
            <h2 className="text-2xl font-bold mb-4 text-white flex items-center">
                <FilterIcon className="h-6 w-6 mr-3 text-indigo-400"/>
                Create Email Shortlist
                <span className="ml-3 text-lg font-medium text-gray-400">
                    ({sortedContacts.length} contact{sortedContacts.length !== 1 ? 's' : ''} found)
                </span>
            </h2>
            <p className="text-gray-400 mb-6">Filter your database to generate a list of emails you can copy and paste into your email client.</p>

            <div className="grid grid-cols-1 md:grid-cols-5 gap-6 mb-6 items-end">
                 <div className="md:col-span-5">
                    <label htmlFor="shortlist-search" className="block text-sm font-medium text-gray-300 mb-1">
                        Search Contacts by Name/Email
                    </label>
                    <div className="relative">
                        <span className="absolute inset-y-0 left-0 flex items-center pl-3">
                            <SearchIcon className="h-5 w-5 text-gray-500" />
                        </span>
                        <input
                            type="text"
                            id="shortlist-search"
                            placeholder="e.g. 'Global Groove' or 'submissions@...'"
                            value={shortlistSearchTerm}
                            onChange={e => setShortlistSearchTerm(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 bg-gray-700 border border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition"
                        />
                    </div>
                </div>
                
                <div>
                    <label htmlFor="country-filter" className="block text-sm font-medium text-gray-300 mb-1">Country</label>
                    <select
                        id="country-filter"
                        value={selectedCountry}
                        onChange={e => setSelectedCountry(e.target.value)}
                        className="w-full bg-gray-700 border border-gray-600 rounded-md py-2 px-3 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                        <option value="All">All Countries ({contacts.length})</option>
                        {availableCountries.map(c => <option key={c.name} value={c.name}>{c.name} ({c.count})</option>)}
                    </select>
                </div>
                <div className="md:col-span-2 self-start">
                    <label className="block text-sm font-medium text-gray-300 mb-1">Genres</label>
                    <div className="mb-2 min-h-[42px] p-2 border border-gray-600 rounded-md bg-gray-900 flex flex-wrap gap-2 items-center">
                        {selectedGenres.length > 0 ? (
                            selectedGenres.map(genre => (
                                <span key={genre} className="flex items-center px-2 py-1 bg-indigo-600 text-white text-xs font-medium rounded-full">
                                    {genre}
                                    <button 
                                        onClick={() => handleGenreToggle(genre)} 
                                        className="ml-1.5 text-indigo-200 hover:text-white focus:outline-none"
                                        aria-label={`Remove ${genre}`}
                                    >
                                        <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                                    </button>
                                </span>
                            ))
                        ) : (
                            <p className="text-sm text-gray-500 px-1">No genres selected.</p>
                        )}
                    </div>
                    <div
                        role="group"
                        aria-label="Select one or more genres"
                        className="p-3 border border-gray-600 rounded-md max-h-48 overflow-y-auto bg-gray-900"
                    >
                        <div className="relative mb-2">
                            <span className="absolute inset-y-0 left-0 flex items-center pl-3">
                                <SearchIcon className="h-4 w-4 text-gray-500" />
                            </span>
                            <input
                                type="text"
                                placeholder="Search genres..."
                                value={genreSearch}
                                onChange={e => setGenreSearch(e.target.value)}
                                className="w-full pl-9 pr-3 py-1.5 bg-gray-700 border border-gray-600 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 transition"
                            />
                        </div>
                        <div className="flex items-center justify-end gap-4 pb-2 mb-2 border-b border-gray-700">
                            <button
                                onClick={handleSelectAllVisible}
                                disabled={areAllFilteredGenresSelected}
                                className="text-xs font-medium text-indigo-400 hover:text-indigo-300 disabled:text-gray-500 disabled:cursor-not-allowed transition"
                            >
                                Select All Visible
                            </button>
                            <button
                                onClick={handleDeselectAllVisible}
                                disabled={!isAnyFilteredGenreSelected}
                                className="text-xs font-medium text-indigo-400 hover:text-indigo-300 disabled:text-gray-500 disabled:cursor-not-allowed transition"
                            >
                                Deselect All Visible
                            </button>
                        </div>
                        <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                            {filteredGenresForDisplay.length > 0 ? (
                                filteredGenresForDisplay.map(genre => (
                                    <div key={genre} className="flex items-center">
                                        <input
                                            id={`genre-${genre}`}
                                            name={genre}
                                            type="checkbox"
                                            checked={selectedGenres.includes(genre)}
                                            onChange={() => handleGenreToggle(genre)}
                                            className="h-4 w-4 rounded border-gray-500 bg-gray-700 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                                        />
                                        <label
                                            htmlFor={`genre-${genre}`}
                                            className={`ml-3 block text-sm cursor-pointer transition-colors ${
                                                selectedGenres.includes(genre)
                                                    ? 'text-indigo-300 font-medium'
                                                    : 'text-gray-400 hover:text-gray-200'
                                            }`}
                                        >
                                            {genre}
                                        </label>
                                    </div>
                                ))
                            ) : (
                                <p className="text-sm text-gray-500 col-span-2 text-center py-2">No genres found.</p>
                            )}
                        </div>
                    </div>
                </div>
                 <div>
                    <label htmlFor="type-filter" className="block text-sm font-medium text-gray-300 mb-1">Contact Type</label>
                    <select
                        id="type-filter"
                        value={selectedType}
                        onChange={e => setSelectedType(e.target.value)}
                        className="w-full bg-gray-700 border border-gray-600 rounded-md py-2 px-3 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                        <option value="All">All Types ({contacts.length})</option>
                        {availableTypes.map(t => <option key={t.name} value={t.name}>{t.name} ({t.count})</option>)}
                    </select>
                </div>
                <div>
                    <button
                        onClick={handleClearFilters}
                        aria-label="Clear all filters"
                        className="w-full px-4 py-2 bg-gray-600 text-white font-semibold rounded-md hover:bg-gray-500 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-indigo-500"
                    >
                        Clear Filters
                    </button>
                </div>
            </div>

            <div className="my-8">
                <h3 className="text-lg font-semibold text-gray-200 mb-3">
                    Filtered Contacts Preview
                </h3>
                <div className="bg-gray-900 border border-gray-700 rounded-lg max-h-72 overflow-y-auto">
                    {sortedContacts.length > 0 ? (
                        <table className="min-w-full">
                            <thead className="bg-gray-800 sticky top-0 z-10">
                                <tr>
                                    <SortableHeader label="Name" sortKey="name" />
                                    <SortableHeader label="Email" sortKey="email" />
                                    <SortableHeader label="Type" sortKey="type" />
                                    <SortableHeader label="Country" sortKey="country" />
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-700">
                                {sortedContacts.map(contact => (
                                    <tr key={contact.id}>
                                        <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-100">{contact.name}</td>
                                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-400">{contact.email}</td>
                                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-400">{contact.type}</td>
                                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-400">{contact.country}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    ) : (
                        <div className="text-center py-10 text-gray-500">
                            <p>No contacts match the current filters.</p>
                        </div>
                    )}
                </div>
            </div>

            <div>
                <div className="flex justify-between items-center mb-2">
                    <label htmlFor="email-list" className="block text-sm font-medium text-gray-300">Generated Email List (Sorted)</label>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={handleExportCsv}
                            disabled={sortedContacts.length === 0}
                            className="flex items-center px-3 py-1.5 bg-gray-600 text-white text-xs font-semibold rounded-md hover:bg-gray-500 disabled:bg-gray-700 disabled:cursor-not-allowed transition"
                            aria-label="Export contact list as a CSV file"
                        >
                            <ExportIcon className="h-4 w-4 mr-1.5"/>
                            Export CSV
                        </button>
                        <button
                            onClick={handleDownload}
                            disabled={sortedContacts.length === 0}
                            className="flex items-center px-3 py-1.5 bg-gray-600 text-white text-xs font-semibold rounded-md hover:bg-gray-500 disabled:bg-gray-700 disabled:cursor-not-allowed transition"
                            aria-label="Download email list as a text file"
                        >
                            <DownloadIcon className="h-4 w-4 mr-1.5"/>
                            Download .txt
                        </button>
                        <button
                            onClick={handleCopy}
                            disabled={sortedContacts.length === 0}
                            className="flex items-center px-3 py-1.5 bg-indigo-600 text-white text-xs font-semibold rounded-md hover:bg-indigo-700 disabled:bg-indigo-800 disabled:cursor-not-allowed transition"
                            aria-label="Copy email list to clipboard"
                        >
                            {copySuccess ? copySuccess : <><CopyIcon className="h-4 w-4 mr-1.5"/> Copy Emails</>}
                        </button>
                    </div>
                </div>
                <textarea
                    id="email-list"
                    readOnly
                    value={filteredEmails}
                    placeholder={sortedContacts.length > 0 ? "Your sorted email list will appear here..." : "No contacts match the current filters."}
                    className="w-full h-48 bg-gray-900 border border-gray-600 rounded-md p-3 text-gray-300 font-mono text-sm resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
            </div>
        </div>
    );
};
