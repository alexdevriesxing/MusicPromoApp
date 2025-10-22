import React, { useState, useMemo } from 'react';
import { Contact, ContactType } from '../types';
import { ReportIcon, DownloadIcon } from './Icons';

// This makes TypeScript aware of the jsPDF global variables injected by the script tags
declare const jspdf: any;

interface ReportingViewProps {
    contacts: Contact[];
}

type SelectableColumn = 'name' | 'type' | 'country' | 'email' | 'website';

export const ReportingView: React.FC<ReportingViewProps> = ({ contacts }) => {
    const [selectedStationIds, setSelectedStationIds] = useState<Set<string>>(new Set());
    const [selectedColumns, setSelectedColumns] = useState<Record<SelectableColumn, boolean>>({
        name: true,
        type: true,
        country: true,
        email: false,
        website: false,
    });

    const radioStations = useMemo(() => 
        contacts.filter(c => c.type === ContactType.RadioStation)
        .sort((a, b) => a.name.localeCompare(b.name)),
    [contacts]);

    // Summary metrics (across all contacts)
    const totalContacts = contacts.length;
    const byType = useMemo(() => {
        const counts = new Map<string, number>();
        contacts.forEach(c => counts.set(c.type, (counts.get(c.type) || 0) + 1));
        return Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
    }, [contacts]);
    const topCountries = useMemo(() => {
        const counts = new Map<string, number>();
        contacts.forEach(c => counts.set(c.country, (counts.get(c.country) || 0) + 1));
        return Array.from(counts.entries()).sort((a, b) => b[1] - a[1]).slice(0, 10);
    }, [contacts]);
    const topGenres = useMemo(() => {
        const counts = new Map<string, number>();
        contacts.forEach(c => (c.genres || []).forEach(g => counts.set(g, (counts.get(g) || 0) + 1)));
        return Array.from(counts.entries()).sort((a, b) => b[1] - a[1]).slice(0, 10);
    }, [contacts]);

    const handleToggleStation = (id: string) => {
        const newSelection = new Set(selectedStationIds);
        if (newSelection.has(id)) {
            newSelection.delete(id);
        } else {
            newSelection.add(id);
        }
        setSelectedStationIds(newSelection);
    };

    const handleSelectAll = () => {
        const allIds = new Set(radioStations.map(s => s.id));
        setSelectedStationIds(allIds);
    };

    const handleDeselectAll = () => {
        setSelectedStationIds(new Set());
    };
    
    const handleToggleColumn = (column: SelectableColumn) => {
        setSelectedColumns(prev => ({ ...prev, [column]: !prev[column] }));
    };

    const handleGeneratePdf = () => {
        const doc = new jspdf.jsPDF();
        const selectedStations = radioStations.filter(s => selectedStationIds.has(s.id));
        
        if (selectedStations.length === 0) {
            alert("Please select at least one radio station to generate a report.");
            return;
        }

        const headers: string[] = [];
        const columnKeys: SelectableColumn[] = [];

        (Object.keys(selectedColumns) as SelectableColumn[]).forEach(key => {
            if (selectedColumns[key]) {
                headers.push(key.charAt(0).toUpperCase() + key.slice(1));
                columnKeys.push(key);
            }
        });

        if (headers.length === 0) {
            alert("Please select at least one column to include in the report.");
            return;
        }

        const body = selectedStations.map(station => 
            columnKeys.map(key => station[key] || '')
        );

        doc.setFontSize(18);
        doc.text("Radio Promotion Report", 14, 22);
        doc.setFontSize(11);
        doc.setTextColor(100);
        doc.text(`Generated on: ${new Date().toLocaleDateString()}`, 14, 28);

        (doc as any).autoTable({
            startY: 35,
            head: [headers],
            body: body,
            theme: 'striped',
            headStyles: { fillColor: [74, 85, 104] }, // gray-600
        });

        doc.save(`radio-report-${new Date().toISOString().split('T')[0]}.pdf`);
    };

    const columnOptions: { key: SelectableColumn, label: string }[] = [
        { key: 'name', label: 'Name' },
        { key: 'type', label: 'Type' },
        { key: 'country', label: 'Country' },
        { key: 'email', label: 'Email' },
        { key: 'website', label: 'Website' },
    ];

    return (
        <div className="bg-gray-800 p-6 rounded-lg shadow-lg border border-gray-700">
            <h2 className="text-2xl font-bold mb-2 text-white flex items-center">
                <ReportIcon className="h-6 w-6 mr-3 text-indigo-400"/>
                Generate Client Report
            </h2>
            <p className="text-gray-400 mb-6">Select the radio stations and the details you want to include in your PDF report.</p>

            {/* Summary section */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <div className="p-4 bg-gray-900 border border-gray-700 rounded">
                    <div className="text-gray-300 text-sm">Total Contacts</div>
                    <div className="text-white text-2xl font-bold">{totalContacts}</div>
                </div>
                <div className="p-4 bg-gray-900 border border-gray-700 rounded">
                    <div className="text-gray-300 text-sm mb-2">By Type</div>
                    <ul className="text-gray-300 text-sm space-y-1 max-h-40 overflow-y-auto">
                        {byType.map(([t, n]) => (
                            <li key={t} className="flex justify-between"><span>{t}</span><span className="text-gray-400">{n}</span></li>
                        ))}
                    </ul>
                </div>
                <div className="p-4 bg-gray-900 border border-gray-700 rounded">
                    <div className="text-gray-300 text-sm mb-2">Top Countries</div>
                    <ul className="text-gray-300 text-sm space-y-1 max-h-40 overflow-y-auto">
                        {topCountries.map(([c, n]) => (
                            <li key={c} className="flex justify-between"><span>{c}</span><span className="text-gray-400">{n}</span></li>
                        ))}
                    </ul>
                </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
                <div className="p-4 bg-gray-900 border border-gray-700 rounded md:col-span-3">
                    <div className="text-gray-300 text-sm mb-2">Top Genres</div>
                    <div className="flex flex-wrap gap-2">
                        {topGenres.map(([g, n]) => (
                            <span key={g} className="px-2 py-1 bg-indigo-500/20 text-indigo-300 rounded-full text-xs">{g} <span className="text-indigo-200">({n})</span></span>
                        ))}
                        {topGenres.length === 0 && (
                            <span className="text-gray-500 text-sm">No genres found.</span>
                        )}
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                {/* --- Configuration Column --- */}
                <div className="md:col-span-1 space-y-6">
                    <div>
                        <h3 className="text-lg font-semibold text-gray-200 mb-3 border-b border-gray-600 pb-2">1. Columns to Include</h3>
                        <div className="space-y-2 mt-3">
                            {columnOptions.map(({ key, label }) => (
                                <div key={key} className="flex items-center">
                                    <input
                                        id={`col-${key}`}
                                        type="checkbox"
                                        checked={selectedColumns[key]}
                                        onChange={() => handleToggleColumn(key)}
                                        className="h-4 w-4 rounded border-gray-500 bg-gray-700 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                                    />
                                    <label htmlFor={`col-${key}`} className="ml-3 block text-sm text-gray-300 cursor-pointer">{label}</label>
                                </div>
                            ))}
                        </div>
                    </div>
                    <div>
                        <button 
                            onClick={handleGeneratePdf}
                            className="w-full flex items-center justify-center px-4 py-3 bg-indigo-600 text-white font-semibold rounded-md hover:bg-indigo-700 transition-colors duration-200 shadow-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-indigo-500"
                        >
                            <DownloadIcon className="h-5 w-5 mr-2" />
                            Generate PDF
                        </button>
                    </div>
                </div>

                {/* --- Selection Column --- */}
                <div className="md:col-span-2">
                     <h3 className="text-lg font-semibold text-gray-200 mb-3 border-b border-gray-600 pb-2 flex justify-between items-center">
                        <span>2. Select Radio Stations</span>
                        <span className="text-sm font-medium text-gray-400">{selectedStationIds.size} / {radioStations.length} selected</span>
                    </h3>
                    <div className="flex items-center gap-4 my-3">
                        <button onClick={handleSelectAll} className="text-sm font-medium text-indigo-400 hover:text-indigo-300 transition">Select All</button>
                        <button onClick={handleDeselectAll} className="text-sm font-medium text-indigo-400 hover:text-indigo-300 transition">Deselect All</button>
                    </div>
                    <div className="bg-gray-900 border border-gray-700 rounded-lg max-h-96 overflow-y-auto">
                        {radioStations.length > 0 ? (
                            <ul className="divide-y divide-gray-700">
                                {radioStations.map(station => (
                                    <li key={station.id} className="p-3 flex items-center hover:bg-gray-800/50">
                                        <input
                                            id={`station-${station.id}`}
                                            type="checkbox"
                                            checked={selectedStationIds.has(station.id)}
                                            onChange={() => handleToggleStation(station.id)}
                                            className="h-4 w-4 rounded border-gray-500 bg-gray-700 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                                        />
                                        <label htmlFor={`station-${station.id}`} className="ml-4 flex-grow cursor-pointer">
                                            <p className="font-medium text-gray-200">{station.name}</p>
                                            <p className="text-xs text-gray-400">{station.country}</p>
                                        </label>
                                    </li>
                                ))}
                            </ul>
                        ) : (
                            <div className="text-center py-10 text-gray-500">
                                <p>No radio stations found in the database.</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};
