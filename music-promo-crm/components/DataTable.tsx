import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { Contact, SortConfig, SocialPlatform, ContactPerson } from '../types';
import { 
    EditIcon, TrashIcon, SortUpIcon, SortDownIcon, LinkIcon, LoadingSpinnerIcon, 
    VerifiedIcon, NotFoundIcon, ErrorIcon, UnverifiedIcon, FacebookIcon, TwitterIcon, 
    InstagramIcon, YoutubeIcon, SpotifyIcon, SoundcloudIcon, BandcampIcon, TiktokIcon, BellIcon, BellSlashIcon
} from './Icons';

interface DataTableProps {
    contacts: Contact[];
    onEdit: (contact: Contact) => void; // open modal for full edit
    onDelete: (id: string) => void;
    onQuickUpdate?: (contact: Contact) => void; // inline updates (favorite, DNC)
    initialSort?: SortConfig | null;
}

const SortableHeader: React.FC<{
    label: string;
    sortKey: keyof Contact;
    sortConfig: SortConfig;
    requestSort: (key: keyof Contact) => void;
}> = ({ label, sortKey, sortConfig, requestSort }) => {
    const isSorted = sortConfig?.key === sortKey;
    const direction = isSorted ? sortConfig.direction : undefined;

    return (
        <th
            className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider cursor-pointer select-none group"
            onClick={() => requestSort(sortKey)}
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

const SocialIcon: React.FC<{ platform: SocialPlatform; url?: string }> = ({ platform, url }) => {
    const icons: Record<SocialPlatform, React.ReactNode> = {
        facebook: <FacebookIcon className="h-5 w-5" />,
        twitter: <TwitterIcon className="h-5 w-5" />,
        instagram: <InstagramIcon className="h-5 w-5" />,
        youtube: <YoutubeIcon className="h-5 w-5" />,
        spotify: <SpotifyIcon className="h-5 w-5" />,
        soundcloud: <SoundcloudIcon className="h-5 w-5" />,
        bandcamp: <BandcampIcon className="h-5 w-5" />,
        tiktok: <TiktokIcon className="h-5 w-5" />,
    };

    const icon = icons[platform];
    const platformName = platform.charAt(0).toUpperCase() + platform.slice(1);

    if (url) {
        return (
            <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                title={platformName}
                className="text-gray-400 hover:text-indigo-400 transition"
                aria-label={`Visit ${platformName} profile`}
            >
                {icon}
            </a>
        );
    } else {
        return (
            <span
                title={platformName}
                className="text-gray-500 cursor-not-allowed"
            >
                {icon}
            </span>
        );
    }
};

export const DataTable: React.FC<DataTableProps> = ({ contacts, onEdit, onDelete, onQuickUpdate, initialSort = { key: 'name', direction: 'ascending' } }) => {
    const [sortConfig, setSortConfig] = useState<SortConfig>(initialSort);
    const scrollRef = useRef<HTMLDivElement | null>(null);
    const [containerHeight, setContainerHeight] = useState<number>(480);
    const [scrollTop, setScrollTop] = useState<number>(0);
    const [rowHeight, setRowHeight] = useState<number>(64); // dynamic row height

    const socialPlatforms: SocialPlatform[] = ['facebook', 'twitter', 'instagram', 'youtube', 'spotify', 'soundcloud', 'bandcamp', 'tiktok'];

    const sortedContacts = useMemo(() => {
        let sortableItems = [...contacts];
        if (sortConfig !== null) {
            sortableItems.sort((a, b) => {
                const aValue = a[sortConfig.key];
                const bValue = b[sortConfig.key];
                
                if (aValue === undefined || aValue === null) return 1;
                if (bValue === undefined || bValue === null) return -1;

                if (typeof aValue === 'string' && typeof bValue === 'string') {
                    const comparison = aValue.localeCompare(bValue, undefined, { sensitivity: 'base' });
                    return sortConfig.direction === 'ascending' ? comparison : -comparison;
                }

                if (aValue < bValue) {
                    return sortConfig.direction === 'ascending' ? -1 : 1;
                }
                if (aValue > bValue) {
                    return sortConfig.direction === 'ascending' ? 1 : -1;
                }
                return 0;
            });
        }
        return sortableItems;
    }, [contacts, sortConfig]);

    // Simple virtualization to keep DOM light for large lists
    const useVirtual = sortedContacts.length > 200;
    useEffect(() => {
        const el = scrollRef.current;
        if (!el) return;
        const onScroll = () => setScrollTop(el.scrollTop);
        const onResize = () => setContainerHeight(el.clientHeight || 480);
        el.addEventListener('scroll', onScroll);
        window.addEventListener('resize', onResize);
        onResize();
        return () => {
            el.removeEventListener('scroll', onScroll);
            window.removeEventListener('resize', onResize);
        };
    }, []);

    // Measure a sample row height dynamically to improve virtualization accuracy
    useEffect(() => {
        if (!useVirtual) return;
        const el = scrollRef.current;
        if (!el) return;
        // Try to find a rendered row and measure its height
        const row = el.querySelector('tbody tr[data-row="true"]') as HTMLTableRowElement | null;
        if (row && row.offsetHeight) {
            const h = Math.max(32, Math.min(128, row.offsetHeight));
            if (Math.abs(h - rowHeight) > 2) setRowHeight(h);
        }
    });

    const visibleCount = Math.ceil(containerHeight / rowHeight) + 6;
    const startIndex = useVirtual ? Math.max(0, Math.floor(scrollTop / rowHeight) - 3) : 0;
    const endIndex = useVirtual ? Math.min(sortedContacts.length, startIndex + visibleCount) : sortedContacts.length;
    const topPad = useVirtual ? startIndex * rowHeight : 0;
    const bottomPad = useVirtual ? Math.max(0, (sortedContacts.length - endIndex) * rowHeight) : 0;
    const visible = useVirtual ? sortedContacts.slice(startIndex, endIndex) : sortedContacts;

    const requestSort = useCallback((key: keyof Contact) => {
        let direction: 'ascending' | 'descending' = 'ascending';
        if (sortConfig && sortConfig.key === key && sortConfig.direction === 'ascending') {
            direction = 'descending';
        }
        setSortConfig({ key, direction });
    }, [sortConfig]);

    const getStatusIcon = (contact: Contact) => {
        switch (contact.verificationStatus) {
            case 'verified':
                return <VerifiedIcon className="h-5 w-5 text-green-500" />;
            case 'not_found':
                return <NotFoundIcon className="h-5 w-5 text-red-500" />;
            case 'verifying':
                return <LoadingSpinnerIcon className="h-5 w-5 text-indigo-400" />;
            case 'error':
                return <ErrorIcon className="h-5 w-5 text-yellow-500" />;
            case 'unverified':
            default:
                return <UnverifiedIcon className="h-5 w-5 text-gray-500" />;
        }
    }

    const handleToggleDNC = (contact: Contact) => {
        const updated = { ...contact, doNotContact: !contact.doNotContact };
        if (onQuickUpdate) onQuickUpdate(updated); else onEdit(updated);
    };
    const handleToggleFavorite = (contact: Contact) => {
        const updated = { ...contact, isFavorite: !contact.isFavorite } as Contact;
        if (onQuickUpdate) onQuickUpdate(updated); else onEdit(updated);
    };

    return (
        <div ref={scrollRef} className="overflow-auto bg-gray-800 rounded-lg shadow-lg border border-gray-700 max-h-[60vh]">
            <table className="min-w-full divide-y divide-gray-700">
                <thead className="bg-gray-800">
                    <tr>
                        <SortableHeader label="Name" sortKey="name" sortConfig={sortConfig} requestSort={requestSort} />
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Status</th>
                        <SortableHeader label="Type" sortKey="type" sortConfig={sortConfig} requestSort={requestSort} />
                        <SortableHeader label="Country" sortKey="country" sortConfig={sortConfig} requestSort={requestSort} />
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Genres</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Contact</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Contact Persons</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Socials</th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-400 uppercase tracking-wider">Actions</th>
                    </tr>
                </thead>
                <tbody className="bg-gray-800 divide-y divide-gray-700">
                    {useVirtual && (
                        <tr>
                            <td colSpan={12} style={{ height: topPad }} />
                        </tr>
                    )}
                    {visible.map((contact) => (
                        <tr data-row="true" key={contact.id} className={`hover:bg-gray-700/50 transition-colors ${contact.doNotContact ? 'opacity-50' : ''}`}>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-100">{contact.name}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                                <div className="relative group flex items-center justify-center" title={contact.verificationDetails || contact.verificationStatus}>
                                    {getStatusIcon(contact)}
                                </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">{contact.type}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">{contact.country}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                                <div className="flex flex-wrap gap-1">
                                    {contact.genres.map(genre => (
                                        <span key={genre} className="px-2 py-1 text-xs bg-indigo-500/20 text-indigo-300 rounded-full">{genre}</span>
                                    ))}
                                </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                                <div className="flex items-center">{contact.email}</div>
                                {contact.website && (
                                    <a href={contact.website} target="_blank" rel="noopener noreferrer" className="flex items-center text-indigo-400 hover:text-indigo-300 text-xs mt-1">
                                        <LinkIcon className="h-3 w-3 mr-1" />
                                        {contact.website}
                                    </a>
                                )}
                            </td>
                            <td className="px-6 py-4 align-top text-sm text-gray-300">
                                {(contact.contactPersons || []).length > 0 ? (
                                    <ul className="space-y-2">
                                        {contact.contactPersons?.map((person, index) => (
                                            <li key={index}>
                                                <p className="font-medium text-gray-100">{person.name}</p>
                                                <p className="text-xs text-gray-400">{person.position}</p>
                                                <a href={`mailto:${person.email}`} className="text-xs text-indigo-400 hover:underline">{person.email}</a>
                                            </li>
                                        ))}
                                    </ul>
                                ) : (
                                    <span className="text-gray-500">N/A</span>
                                )}
                            </td>
                             <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                                <div className="flex items-center gap-3">
                                    {socialPlatforms.map(platform => (
                                        <SocialIcon key={platform} platform={platform} url={contact.socials?.[platform]} />
                                    ))}
                                </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                <button
                                    onClick={() => handleToggleFavorite(contact)}
                                    className="text-yellow-400 hover:text-yellow-300 mr-4 transition"
                                    title={contact.isFavorite ? 'Unfavorite' : 'Mark as favorite'}
                                    aria-label={contact.isFavorite ? 'Unfavorite contact' : 'Mark contact as favorite'}
                                >
                                    {contact.isFavorite ? (
                                        // filled star
                                        <span className="inline-flex"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5"><path d="M11.48 3.499a.562.562 0 011.04 0l2.07 4.196a.563.563 0 00.424.308l4.63.673c.513.074.718.705.346 1.066l-3.35 3.264a.563.563 0 00-.162.498l.79 4.604a.562.562 0 01-.816.592l-4.135-2.174a.563.563 0 00-.524 0L6.117 18.7a.562.562 0 01-.816-.592l.79-4.604a.563.562 0 00-.162-.498L2.58 9.742a.563.563 0 01.346-1.066l4.63-.673a.563.563 0 00.424-.308l2.07-4.196z"/></svg></span>
                                    ) : (
                                        // outline star
                                        <span className="inline-flex"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="h-5 w-5"><path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 011.04 0l2.07 4.196a.563.563 0 00.424.308l4.63.673c.513.074.718.705.346 1.066l-3.35 3.264a.563.563 0 00-.162.498l.79 4.604a.562.562 0 01-.816.592l-4.135-2.174a.563.563 0 00-.524 0L6.117 18.7a.562.562 0 01-.816-.592l.79-4.604a.563.563 0 00-.162-.498L2.58 9.742a.563.563 0 01.346-1.066l4.63-.673a.563.563 0 00.424-.308l2.07-4.196z"/></svg></span>
                                    )}
                                </button>
                                <button
                                    onClick={() => handleToggleDNC(contact)}
                                    className="text-gray-400 hover:text-white mr-4 transition"
                                    title={contact.doNotContact ? 'Allow contact (currently excluded)' : 'Do not contact (exclude from shortlists)'}
                                    aria-label={contact.doNotContact ? 'Allow contact' : 'Mark as do not contact'}
                                >
                                    {contact.doNotContact ? <BellSlashIcon className="h-5 w-5 text-yellow-500" /> : <BellIcon className="h-5 w-5" />}
                                </button>
                                <button onClick={() => onEdit(contact)} className="text-yellow-400 hover:text-yellow-300 mr-4 transition"><EditIcon className="h-5 w-5"/></button>
                                <button onClick={() => onDelete(contact.id)} className="text-red-500 hover:text-red-400 transition"><TrashIcon className="h-5 w-5"/></button>
                            </td>
                        </tr>
                    ))}
                    {useVirtual && (
                        <tr>
                            <td colSpan={12} style={{ height: bottomPad }} />
                        </tr>
                    )}
                </tbody>
            </table>
        </div>
    );
};
