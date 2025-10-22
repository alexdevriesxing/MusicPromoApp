import { Contact } from './types';

// This assumes Dexie is loaded globally from a <script> tag in index.html
declare const Dexie: any;

class MusicPromoDB extends Dexie {
    // Define the type of the table
    // Fix: Changed Dexie.Table<Contact, string> to any to resolve namespace error as Dexie types are not imported.
    public contacts: any; 

    constructor() {
        super('MusicPromoCRM');
        this.version(2).stores({
            // Primary key 'id', and index the properties we will query on for performance
            contacts: 'id, name, country, type, *genres'
        });
        this.contacts = this.table('contacts');
    }
}

const db = new MusicPromoDB();

export const getAllContacts = async (): Promise<Contact[]> => {
    return db.contacts.toArray();
};

export const addContact = async (contact: Contact): Promise<void> => {
    await db.contacts.add(contact);
};

export const updateContact = async (contact: Contact): Promise<void> => {
    await db.contacts.put(contact);
};

export const deleteContact = async (id: string): Promise<void> => {
    await db.contacts.delete(id);
};

export const bulkAddContacts = async (contacts: Contact[]): Promise<void> => {
    await db.contacts.bulkAdd(contacts);
};