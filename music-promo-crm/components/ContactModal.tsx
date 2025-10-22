
import React, { useState, useEffect } from 'react';
import { Contact, ContactType, SocialPlatform, ContactPerson } from '../types';
// Fix: Removed non-existent COUNTRIES and GENRES imports. Data is now passed via props.
import { CONTACT_TYPES } from '../constants';
import { PlusIcon, TrashIcon } from './Icons';

interface ContactModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSaveAdd: (contact: Omit<Contact, 'id'>) => void;
    onSaveEdit: (contact: Contact) => void;
    contactToEdit: Contact | null;
    // Fix: Added countries and genres to props to receive dynamic lists from App.tsx.
    countries: string[];
    genres: string[];
}

// Fix: Changed hardcoded country to an empty string to be populated dynamically.
const initialFormState: Omit<Contact, 'id' | 'verificationStatus' | 'verificationDetails'> = {
    name: '',
    type: ContactType.RadioStation,
    country: '',
    genres: [],
    email: '',
    website: '',
    socials: {},
    contactPersons: [],
    doNotContact: false,
    isFavorite: false,
};

const socialPlatforms: { name: SocialPlatform; label: string }[] = [
    { name: 'facebook', label: 'Facebook' },
    { name: 'twitter', label: 'Twitter' },
    { name: 'instagram', label: 'Instagram' },
    { name: 'youtube', label: 'YouTube' },
    { name: 'spotify', label: 'Spotify' },
    { name: 'soundcloud', label: 'SoundCloud' },
    { name: 'bandcamp', label: 'Bandcamp' },
    { name: 'tiktok', label: 'TikTok' },
];

export const ContactModal: React.FC<ContactModalProps> = ({ isOpen, onClose, onSaveAdd, onSaveEdit, contactToEdit, countries, genres }) => {
    const [formData, setFormData] = useState<Omit<Contact, 'id' | 'verificationStatus' | 'verificationDetails'>>(initialFormState);
    const [selectedGenres, setSelectedGenres] = useState<Set<string>>(new Set());
    const [verificationStatus, setVerificationStatus] = useState<'unverified' | 'verifying' | 'verified' | 'not_found' | 'error'>('unverified');
    const [verificationDetails, setVerificationDetails] = useState<string>('');
    const [errors, setErrors] = useState<{ name?: string; country?: string; email?: string }>({});
    const nameRef = React.useRef<HTMLInputElement | null>(null);

    useEffect(() => {
        if (contactToEdit) {
            const { id, verificationStatus, verificationDetails, ...editableData } = contactToEdit;
            setFormData({
                ...initialFormState,
                ...editableData,
                socials: contactToEdit.socials || {},
                contactPersons: contactToEdit.contactPersons || [],
            });
            setSelectedGenres(new Set(contactToEdit.genres));
            setVerificationStatus(contactToEdit.verificationStatus || 'unverified');
            setVerificationDetails(contactToEdit.verificationDetails || '');
        } else {
            // Fix: Set a default country from the props when adding a new contact.
            setFormData({
                ...initialFormState,
                country: countries[0] || '',
            });
            setSelectedGenres(new Set());
            setVerificationStatus('unverified');
            setVerificationDetails('');
        }
    }, [contactToEdit, isOpen, countries]);

    useEffect(() => {
        if (isOpen) {
            setTimeout(() => nameRef.current?.focus(), 0);
        }
    }, [isOpen]);

    const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
        if (e.key === 'Escape') onClose();
    };

    if (!isOpen) return null;

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };
    
    const handleCheckboxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, checked } = e.target;
        setFormData(prev => ({ ...prev, [name]: checked }));
    };

    const handleSocialsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        const platform = name as SocialPlatform;
        setFormData(prev => ({
            ...prev,
            socials: {
                ...prev.socials,
                [platform]: value,
            },
        }));
    };
    
    const handleGenreToggle = (genre: string) => {
        const newGenres = new Set(selectedGenres);
        if (newGenres.has(genre)) {
            newGenres.delete(genre);
        } else {
            newGenres.add(genre);
        }
        setSelectedGenres(newGenres);
        setFormData(prev => ({ ...prev, genres: Array.from(newGenres) }));
    };

    const handleAddPerson = () => {
        setFormData(prev => ({
            ...prev,
            contactPersons: [...(prev.contactPersons || []), { name: '', position: '', email: '' }],
        }));
    };

    const handlePersonChange = (index: number, field: keyof ContactPerson, value: string) => {
        setFormData(prev => {
            const newPersons = [...(prev.contactPersons || [])];
            newPersons[index] = { ...newPersons[index], [field]: value };
            return { ...prev, contactPersons: newPersons };
        });
    };

    const handleRemovePerson = (index: number) => {
        setFormData(prev => ({
            ...prev,
            contactPersons: (prev.contactPersons || []).filter((_, i) => i !== index),
        }));
    };


    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const newErrors: { name?: string; country?: string; email?: string } = {};
        if (!formData.name.trim()) newErrors.name = 'Name is required';
        if (!formData.country.trim()) newErrors.country = 'Country is required';
        const emailVal = formData.email.trim();
        if (!emailVal) newErrors.email = 'Email is required';
        else if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i.test(emailVal)) newErrors.email = 'Invalid email format';
        setErrors(newErrors);
        if (Object.keys(newErrors).length > 0) return;
        
        const finalSocials: { [key: string]: string } = {};
        if (formData.socials) {
            Object.entries(formData.socials).forEach(([key, value]) => {
                if (typeof value === 'string') {
                    const v = value.trim();
                    if (v !== '') {
                        finalSocials[key] = v;
                    }
                }
            });
        }
        
        const finalContactPersons = (formData.contactPersons || []).filter(p => p.name && p.email);

        const finalData = { 
            ...formData, 
            socials: finalSocials, 
            contactPersons: finalContactPersons,
            verificationStatus,
            verificationDetails: verificationDetails || undefined,
        } as Omit<Contact, 'id'>;
    
        if (Object.keys(finalData.socials).length === 0) {
            delete finalData.socials;
        }

        if (contactToEdit) {
            onSaveEdit({ ...contactToEdit, ...finalData });
        } else {
            onSaveAdd(finalData);
        }
        onClose();
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex justify-center items-center z-50" onKeyDown={onKeyDown}>
            <div className="bg-gray-800 rounded-lg shadow-xl p-8 w-full max-w-3xl border border-gray-700 max-h-[90vh] overflow-y-auto">
                <h2 className="text-2xl font-bold mb-6 text-white">{contactToEdit ? 'Edit Contact' : 'Add New Contact'}</h2>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label htmlFor="name" className="block text-sm font-medium text-gray-300">Name</label>
                        <input ref={nameRef} type="text" name="name" id="name" value={formData.name} onChange={handleChange} aria-invalid={!!errors.name} aria-describedby={errors.name ? 'name-error' : undefined} required className="mt-1 w-full input-style" />
                        {errors.name && <p id="name-error" className="mt-1 text-sm text-red-400">{errors.name}</p>}
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label htmlFor="type" className="block text-sm font-medium text-gray-300">Type</label>
                            <select name="type" id="type" value={formData.type} onChange={handleChange} className="mt-1 w-full input-style">
                                {CONTACT_TYPES.map(type => <option key={type} value={type}>{type}</option>)}
                            </select>
                        </div>
                        <div>
                        <label htmlFor="country" className="block text-sm font-medium text-gray-300">Country</label>
                        <select name="country" id="country" value={formData.country} onChange={handleChange} aria-invalid={!!errors.country} aria-describedby={errors.country ? 'country-error' : undefined} className="mt-1 w-full input-style">
                            {/* Fix: Use `countries` prop instead of non-existent `COUNTRIES` constant. */}
                            {countries.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                        {errors.country && <p id="country-error" className="mt-1 text-sm text-red-400">{errors.country}</p>}
                    </div>
                    </div>
                    
                    <div>
                        <label className="block text-sm font-medium text-gray-300">Genres</label>
                        <div className="mt-2 p-2 border border-gray-600 rounded-md max-h-32 overflow-y-auto flex flex-wrap gap-2 bg-gray-900">
                           {/* Fix: Use `genres` prop instead of non-existent `GENRES` constant. */}
                           {genres.map(genre => (
                               <button type="button" key={genre} onClick={() => handleGenreToggle(genre)}
                                   className={`px-3 py-1 text-sm rounded-full transition ${selectedGenres.has(genre) ? 'bg-indigo-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}>
                                   {genre}
                               </button>
                           ))}
                        </div>
                    </div>

                    <div>
                        <label htmlFor="email" className="block text-sm font-medium text-gray-300">Primary Email</label>
                        <input type="email" name="email" id="email" value={formData.email} onChange={handleChange} aria-invalid={!!errors.email} aria-describedby={errors.email ? 'email-error' : undefined} required className="mt-1 w-full input-style" />
                        {errors.email && <p id="email-error" className="mt-1 text-sm text-red-400">{errors.email}</p>}
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label htmlFor="verificationStatus" className="block text-sm font-medium text-gray-300">Verification Status</label>
                            <select id="verificationStatus" value={verificationStatus} onChange={e => setVerificationStatus(e.target.value as any)} className="mt-1 w-full input-style">
                                <option value="unverified">Unverified</option>
                                <option value="verifying">Verifying</option>
                                <option value="verified">Verified</option>
                                <option value="not_found">Not Found</option>
                                <option value="error">Error</option>
                            </select>
                        </div>
                        <div>
                            <label htmlFor="verificationDetails" className="block text-sm font-medium text-gray-300">Verification Details (Optional)</label>
                            <input id="verificationDetails" type="text" value={verificationDetails} onChange={e => setVerificationDetails(e.target.value)} className="mt-1 w-full input-style" />
                        </div>
                    </div>
                     <div>
                        <label htmlFor="website" className="block text-sm font-medium text-gray-300">Website (Optional)</label>
                        <input type="url" name="website" id="website" value={formData.website || ''} onChange={handleChange} placeholder="https://example.com" className="mt-1 w-full input-style" />
                    </div>

                    <div className="pt-2 border-t border-gray-700">
                        <h3 className="text-lg font-medium text-gray-200 mt-2">Contact Persons (Optional)</h3>
                        <div className="space-y-3 mt-2">
                            {(formData.contactPersons || []).map((person, index) => (
                                <div key={index} className="grid grid-cols-1 md:grid-cols-7 gap-2 p-3 bg-gray-900/50 border border-gray-700 rounded-md items-center">
                                    <input type="text" placeholder="Name" value={person.name} onChange={e => handlePersonChange(index, 'name', e.target.value)} className="md:col-span-2 input-style" />
                                    <input type="text" placeholder="Position" value={person.position} onChange={e => handlePersonChange(index, 'position', e.target.value)} className="md:col-span-2 input-style" />
                                    <input type="email" placeholder="Email" value={person.email} onChange={e => handlePersonChange(index, 'email', e.target.value)} className="md:col-span-2 input-style" />
                                    <button type="button" onClick={() => handleRemovePerson(index)} className="md:col-span-1 text-red-500 hover:text-red-400 flex justify-center items-center h-full">
                                        <TrashIcon className="h-5 w-5" />
                                    </button>
                                </div>
                            ))}
                        </div>
                        <button type="button" onClick={handleAddPerson} className="mt-2 flex items-center px-3 py-1.5 text-sm bg-indigo-600/20 text-indigo-300 font-semibold rounded-md hover:bg-indigo-600/40 transition">
                            <PlusIcon className="h-4 w-4 mr-2" /> Add Person
                        </button>
                    </div>

                    <div className="pt-2 border-t border-gray-700">
                        <h3 className="text-lg font-medium text-gray-200 mt-2">Social Media Links (Optional)</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
                            {socialPlatforms.map(({ name, label }) => (
                                <div key={name}>
                                    <label htmlFor={name} className="block text-sm font-medium text-gray-300">{label}</label>
                                    <input type="url" name={name} id={name} value={formData.socials?.[name] || ''} onChange={handleSocialsChange} placeholder={`https://...`} className="mt-1 w-full input-style" />
                                </div>
                            ))}
                        </div>
                    </div>
                    
                    <div className="pt-4 border-t border-gray-700">
                         <div className="flex items-center">
                            <input
                                id="doNotContact"
                                name="doNotContact"
                                type="checkbox"
                                checked={!!formData.doNotContact}
                                onChange={handleCheckboxChange}
                                className="h-4 w-4 rounded border-gray-500 bg-gray-700 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                            />
                            <label htmlFor="doNotContact" className="ml-3 block text-sm text-gray-300 cursor-pointer">
                                Exclude from Shortlists (Do Not Contact)
                            </label>
                        </div>
                        <div className="mt-3 flex items-center">
                            <input
                                id="isFavorite"
                                name="isFavorite"
                                type="checkbox"
                                checked={!!formData.isFavorite}
                                onChange={handleCheckboxChange}
                                className="h-4 w-4 rounded border-gray-500 bg-gray-700 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                            />
                            <label htmlFor="isFavorite" className="ml-3 block text-sm text-gray-300 cursor-pointer">
                                Mark as Favorite
                            </label>
                        </div>
                    </div>

                    <div className="flex justify-end gap-4 pt-4">
                        <button type="button" onClick={onClose} className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-500 transition">Cancel</button>
                        <button type="submit" className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition">{contactToEdit ? 'Save Changes' : 'Add Contact'}</button>
                    </div>
                </form>
            </div>
            <style>{`
                .input-style {
                    background-color: #1F2937; /* gray-800 */
                    border: 1px solid #4B5563; /* gray-600 */
                    border-radius: 0.375rem;
                    padding: 0.5rem 0.75rem;
                    color: #D1D5DB; /* gray-300 */
                    font-size: 0.875rem;
                }
                .input-style:focus {
                    outline: none;
                    box-shadow: 0 0 0 2px #6366F1; /* ring-indigo-500 */
                    border-color: #6366F1; /* border-indigo-500 */
                }
                .input-style::placeholder {
                    color: #6B7280; /* gray-500 */
                }
            `}</style>
        </div>
    );
};
