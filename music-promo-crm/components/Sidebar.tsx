import React from 'react';
import { View } from '../types';
import { DatabaseIcon, ListIcon, UploadIcon, ReportIcon, GearIcon } from './Icons';

interface SidebarProps {
    currentView: View;
    setCurrentView: (view: View) => void;
    onImportClick: () => void;
}

const NavItem: React.FC<{
    icon: React.ReactNode;
    label: string;
    isActive: boolean;
    onClick: () => void;
}> = ({ icon, label, isActive, onClick }) => (
    <button
        onClick={onClick}
        className={`flex items-center w-full px-4 py-3 text-left text-sm font-medium rounded-md transition-all duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
            isActive
                ? 'bg-indigo-600 text-white shadow-lg'
                : 'text-gray-300 hover:bg-gray-700 hover:text-white'
        }`}
    >
        {icon}
        <span className="ml-3">{label}</span>
    </button>
);

export const Sidebar: React.FC<SidebarProps> = ({ currentView, setCurrentView, onImportClick }) => {
    return (
        <aside className="w-64 bg-gray-800 border-r border-gray-700 p-4 flex flex-col">
            <div className="flex items-center mb-8">
                {/* <MusicNoteIcon className="h-8 w-8 text-indigo-400" /> */}
                <span className="text-2xl font-semibold text-white ml-2 tracking-tight">PromoBase</span>
            </div>
            <nav className="flex-1 flex flex-col space-y-2">
                <NavItem
                    icon={<DatabaseIcon className="h-5 w-5" />}
                    label="Contact Database"
                    isActive={currentView === View.Database}
                    onClick={() => setCurrentView(View.Database)}
                />
                <NavItem
                    icon={<ListIcon className="h-5 w-5" />}
                    label="Create Shortlist"
                    isActive={currentView === View.Shortlist}
                    onClick={() => setCurrentView(View.Shortlist)}
                />
                <NavItem
                    icon={<ReportIcon className="h-5 w-5" />}
                    label="Reporting"
                    isActive={currentView === View.Reporting}
                    onClick={() => setCurrentView(View.Reporting)}
                />
                <NavItem
                    icon={<GearIcon className="h-5 w-5" />}
                    label="Settings"
                    isActive={currentView === View.Settings}
                    onClick={() => setCurrentView(View.Settings)}
                />
            </nav>
            <div className="mt-auto">
                 <NavItem
                    icon={<UploadIcon className="h-5 w-5" />}
                    label="Import Data"
                    isActive={false}
                    onClick={onImportClick}
                />
            </div>
        </aside>
    );
};
