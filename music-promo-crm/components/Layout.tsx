
import React from 'react';
import { Sidebar } from './Sidebar';
import { View } from '../types';
import { MusicNoteIcon } from './Icons';

interface LayoutProps {
    children: React.ReactNode;
    currentView: View;
    setCurrentView: (view: View) => void;
    onImportClick: () => void;
}

export const Layout: React.FC<LayoutProps> = ({ children, currentView, setCurrentView, onImportClick }) => {
    const [theme, setTheme] = React.useState<'dark' | 'light'>(() => {
        try {
            const saved = localStorage.getItem('mpcrm:theme');
            if (saved === 'light' || saved === 'dark') return saved;
        } catch {}
        const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
        return prefersDark ? 'dark' : 'light';
    });

    React.useEffect(() => {
        try { localStorage.setItem('mpcrm:theme', theme); } catch {}
        const root = document.documentElement;
        if (theme === 'light') root.classList.add('theme-light');
        else root.classList.remove('theme-light');
    }, [theme]);

    const toggleTheme = () => setTheme(t => (t === 'dark' ? 'light' : 'dark'));
    return (
        <div className="flex h-screen bg-gray-900 text-gray-100 font-sans">
            <Sidebar 
                currentView={currentView} 
                setCurrentView={setCurrentView} 
                onImportClick={onImportClick}
            />
            <main className="flex-1 flex flex-col overflow-hidden">
                <header className="bg-gray-800 shadow-md p-4 flex items-center border-b border-gray-700">
                    <MusicNoteIcon className="h-6 w-6 mr-3 text-indigo-400" />
                    <h1 className="text-xl font-bold tracking-wider text-gray-200">Music Promo CRM</h1>
                    <div className="ml-auto flex items-center gap-3">
                        <button
                            onClick={toggleTheme}
                            className="px-3 py-1.5 bg-gray-700 text-white rounded-md hover:bg-gray-600 text-sm"
                            title="Toggle dark/light theme"
                            aria-label="Toggle theme"
                        >
                            {theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
                        </button>
                    </div>
                </header>
                <div className="flex-1 p-6 overflow-y-auto bg-gray-900">
                    {children}
                </div>
            </main>
        </div>
    );
};
