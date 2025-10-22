import type { Contact } from './types';
import { ContactType } from './types';

// Fallback to Dexie-based storage for web usage
import * as dexieDb from './db';

let isTauriEnv: boolean | null = null;

function isTauri(): boolean {
  if (isTauriEnv !== null) return isTauriEnv;
  try {
    // Tauri injects __TAURI__ on window
    isTauriEnv = typeof (window as any).__TAURI__ !== 'undefined';
  } catch {
    isTauriEnv = false;
  }
  return isTauriEnv;
}

export function isDesktop(): boolean {
  return isTauri();
}

// Lazy-initialized SQLite database via Tauri SQL plugin
let sqlDb: any = null;
const SCHEMA_VERSION = 2; // increment when schema changes
async function getSqlDb() {
  if (!isTauri()) return null;
  if (sqlDb) return sqlDb;
  const Database = (await import('@tauri-apps/plugin-sql')).default as any;
  // File lives next to app data; Tauri resolves it properly
  sqlDb = await Database.load('sqlite:promobase.db');
  await ensureSchema(sqlDb);
  await applyMigrations(sqlDb);
  return sqlDb;
}

async function ensureSchema(db: any) {
  await db.execute(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS contacts (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      country TEXT NOT NULL,
      email TEXT,
      website TEXT,
      type TEXT NOT NULL,
      verificationStatus TEXT,
      verificationDetails TEXT,
      isFavorite INTEGER NOT NULL DEFAULT 0,
      doNotContact INTEGER NOT NULL DEFAULT 0,
      createdAt TEXT NOT NULL DEFAULT (datetime('now')),
      updatedAt TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS genres (
      name TEXT PRIMARY KEY
    );
    CREATE TABLE IF NOT EXISTS contact_genres (
      contactId TEXT NOT NULL,
      genreName TEXT NOT NULL,
      PRIMARY KEY (contactId, genreName)
    );
    CREATE TABLE IF NOT EXISTS contact_persons (
      id TEXT PRIMARY KEY,
      contactId TEXT NOT NULL,
      name TEXT NOT NULL,
      position TEXT,
      email TEXT
    );
    CREATE TABLE IF NOT EXISTS social_links (
      id TEXT PRIMARY KEY,
      contactId TEXT NOT NULL,
      platform TEXT NOT NULL,
      url TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_contacts_name ON contacts(name);
    CREATE INDEX IF NOT EXISTS idx_contacts_country ON contacts(country);
    CREATE INDEX IF NOT EXISTS idx_contacts_type ON contacts(type);
    CREATE INDEX IF NOT EXISTS idx_contacts_email ON contacts(email);
    CREATE UNIQUE INDEX IF NOT EXISTS uq_contacts_email
      ON contacts(LOWER(email))
      WHERE email IS NOT NULL AND email <> '';
    CREATE UNIQUE INDEX IF NOT EXISTS uq_contacts_website
      ON contacts(LOWER(website))
      WHERE website IS NOT NULL AND website <> '';
    CREATE VIRTUAL TABLE IF NOT EXISTS contacts_fts USING fts5(
      id UNINDEXED,
      name,
      email,
      website,
      country,
      type,
      genres_text,
      persons_text,
      content=''
    );
  `);
  await verifyIndexes(db);
  await maybeRebuildFts(db);
}

async function getUserVersion(db: any): Promise<number> {
  try {
    const rows = await db.select(`PRAGMA user_version;`);
    // tauri plugin returns array of rows with user_version column or single value
    const v = Number(rows?.[0]?.user_version ?? rows?.[0]?.USER_VERSION ?? rows?.[0] ?? 0);
    return Number.isFinite(v) ? v : 0;
  } catch {
    return 0;
  }
}

async function setUserVersion(db: any, v: number): Promise<void> {
  await db.execute(`PRAGMA user_version = ${v};`);
}

// Minimal migration framework; extend with cases as schema evolves
async function applyMigrations(db: any) {
  const current = await getUserVersion(db);
  if (current >= SCHEMA_VERSION) return;
  // Initial creation handled in ensureSchema
  if (current < 2) {
    try {
      await db.execute(`ALTER TABLE contacts ADD COLUMN isFavorite INTEGER NOT NULL DEFAULT 0;`);
    } catch (e) {
      // Column may already exist; ignore
    }
  }
  await setUserVersion(db, SCHEMA_VERSION);
}

export async function getAllContacts(): Promise<Contact[]> {
  const db = await getSqlDb();
  if (!db) return dexieDb.getAllContacts();

  const base = await db.select(
    `SELECT id, name, country, email, website, type, verificationStatus, verificationDetails, isFavorite, doNotContact
     FROM contacts`
  );

  const contacts: Contact[] = [];
  for (const row of base) {
    const genres = await db.select(
      `SELECT genreName FROM contact_genres WHERE contactId = ?`,
      [row.id]
    );
    const persons = await db.select(
      `SELECT name, position, email FROM contact_persons WHERE contactId = ?`,
      [row.id]
    );
    const socials = await db.select(
      `SELECT platform, url FROM social_links WHERE contactId = ?`,
      [row.id]
    );

    const socialMap: Record<string, string> = {};
    for (const s of socials) socialMap[s.platform] = s.url;

    contacts.push({
      id: String(row.id),
      name: String(row.name),
      country: String(row.country),
      email: String(row.email),
      website: row.website ? String(row.website) : undefined,
      type: row.type,
      verificationStatus: row.verificationStatus || 'unverified',
      verificationDetails: row.verificationDetails || undefined,
      isFavorite: !!row.isFavorite,
      doNotContact: !!row.doNotContact,
      genres: genres.map((g: any) => g.genreName as string),
      contactPersons: persons.map((p: any) => ({
        name: String(p.name),
        position: p.position ? String(p.position) : '',
        email: p.email ? String(p.email) : ''
      })),
      socials: Object.keys(socialMap).length ? (socialMap as any) : undefined,
    } as Contact);
  }
  return contacts;
}

export async function addContact(contact: Contact): Promise<void> {
  const db = await getSqlDb();
  if (!db) return dexieDb.addContact(contact);

  const c = sanitizeAndValidate(contact);
  await db.execute(
    `INSERT OR REPLACE INTO contacts 
      (id, name, country, email, website, type, verificationStatus, verificationDetails, isFavorite, doNotContact, createdAt, updatedAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
    [
      c.id,
      c.name,
      c.country,
      c.email || null,
      c.website || null,
      c.type,
      c.verificationStatus || 'unverified',
      c.verificationDetails || null,
      c.isFavorite ? 1 : 0,
      c.doNotContact ? 1 : 0,
    ]
  );

  await upsertRelations(db, c);
  await upsertFts(db, c.id);
}

export async function updateContact(contact: Contact): Promise<void> {
  const db = await getSqlDb();
  if (!db) return dexieDb.updateContact(contact);

  const c = sanitizeAndValidate(contact);
  await db.execute(
    `UPDATE contacts SET 
      name=?, country=?, email=?, website=?, type=?, verificationStatus=?, verificationDetails=?, isFavorite=?, doNotContact=?, updatedAt=datetime('now')
     WHERE id=?`,
    [
      c.name,
      c.country,
      c.email || null,
      c.website || null,
      c.type,
      c.verificationStatus || 'unverified',
      c.verificationDetails || null,
      c.isFavorite ? 1 : 0,
      c.doNotContact ? 1 : 0,
      c.id,
    ]
  );

  // Clear and re-insert relations
  await db.execute(`DELETE FROM contact_genres WHERE contactId = ?`, [c.id]);
  await db.execute(`DELETE FROM contact_persons WHERE contactId = ?`, [c.id]);
  await db.execute(`DELETE FROM social_links WHERE contactId = ?`, [c.id]);
  await upsertRelations(db, c);
  await upsertFts(db, c.id);
}

export async function deleteContact(id: string): Promise<void> {
  const db = await getSqlDb();
  if (!db) return dexieDb.deleteContact(id);
  await db.execute(`DELETE FROM contact_genres WHERE contactId = ?`, [id]);
  await db.execute(`DELETE FROM contact_persons WHERE contactId = ?`, [id]);
  await db.execute(`DELETE FROM social_links WHERE contactId = ?`, [id]);
  await db.execute(`DELETE FROM contacts WHERE id = ?`, [id]);
  await db.execute(`DELETE FROM contacts_fts WHERE id = ?`, [id]);
}

export async function bulkAddContacts(contacts: Contact[]): Promise<void> {
  const db = await getSqlDb();
  if (!db) return dexieDb.bulkAddContacts(contacts);
  // Transactional insert for performance and atomicity
  await db.execute('BEGIN IMMEDIATE');
  try {
    for (const c of contacts) {
      await addContact(c);
    }
    await db.execute('COMMIT');
  } catch (e) {
    await db.execute('ROLLBACK');
    throw e;
  }
}

export async function clearAllData(): Promise<void> {
  const db = await getSqlDb();
  if (!db) return; // no-op for web fallback
  await db.execute('BEGIN IMMEDIATE');
  try {
    await db.execute(`DELETE FROM contact_genres`);
    await db.execute(`DELETE FROM contact_persons`);
    await db.execute(`DELETE FROM social_links`);
    await db.execute(`DELETE FROM contacts_fts`);
    await db.execute(`DELETE FROM contacts`);
    await db.execute('COMMIT');
  } catch (e) {
    await db.execute('ROLLBACK');
    throw e;
  }
}

export async function getDiagnostics(): Promise<{
  schemaVersion: number;
  counts: Record<string, number>;
}> {
  const db = await getSqlDb();
  if (!db) {
    const all = await dexieDb.getAllContacts();
    return { schemaVersion: 0, counts: { contacts: all.length } } as any;
  }
  const svRows = await db.select(`PRAGMA user_version;`);
  const schemaVersion = Number(svRows?.[0]?.user_version ?? svRows?.[0] ?? 0) || 0;
  const tables = ['contacts','contact_genres','contact_persons','social_links','contacts_fts'];
  const counts: Record<string, number> = {};
  for (const t of tables) {
    try {
      const r = await db.select(`SELECT COUNT(*) as c FROM ${t}`);
      counts[t] = Number(r?.[0]?.c || 0);
    } catch { counts[t] = 0; }
  }
  return { schemaVersion, counts };
}

export async function rebuildSearchIndex(): Promise<void> {
  const db = await getSqlDb();
  if (!db) return;
  const ids = await db.select(`SELECT id FROM contacts`);
  for (const r of ids) {
    await upsertFts(db, String((r as any).id));
  }
}

export async function runMigrations(): Promise<void> {
  const db = await getSqlDb();
  if (!db) return;
  await applyMigrations(db);
}

async function upsertRelations(db: any, contact: Contact) {
  const genres = Array.isArray(contact.genres) ? contact.genres : [];
  for (const g of genres) {
    await db.execute(`INSERT OR IGNORE INTO genres(name) VALUES (?)`, [g]);
    await db.execute(
      `INSERT OR REPLACE INTO contact_genres(contactId, genreName) VALUES(?, ?)`,
      [contact.id, g]
    );
  }

  const persons = contact.contactPersons || [];
  for (const p of persons) {
    const pid = `${contact.id}-person-${Math.random().toString(36).slice(2)}`;
    await db.execute(
      `INSERT INTO contact_persons(id, contactId, name, position, email) VALUES(?, ?, ?, ?, ?)`,
      [pid, contact.id, p.name, p.position || '', p.email || '']
    );
  }

  const socials = contact.socials || {};
  for (const key of Object.keys(socials)) {
    const sid = `${contact.id}-social-${key}-${Math.random().toString(36).slice(2)}`;
    const url = (socials as any)[key];
    if (typeof url === 'string' && url.trim()) {
      await db.execute(
        `INSERT INTO social_links(id, contactId, platform, url) VALUES(?, ?, ?, ?)`,
        [sid, contact.id, key, url.trim()]
      );
    }
  }
}

async function upsertFts(db: any, contactId: string) {
  const [row] = await db.select(
    `SELECT id, name, email, website, country, type FROM contacts WHERE id = ? LIMIT 1`,
    [contactId]
  );
  if (!row) return;
  const genres = await db.select(
    `SELECT genreName FROM contact_genres WHERE contactId = ?`,
    [contactId]
  );
  const persons = await db.select(
    `SELECT name, position, email FROM contact_persons WHERE contactId = ?`,
    [contactId]
  );
  const genresText = (genres || []).map((g: any) => g.genreName).join(' ');
  const personsText = (persons || [])
    .map((p: any) => `${p.name || ''} ${p.position || ''} ${p.email || ''}`)
    .join(' ');
  await db.execute(`DELETE FROM contacts_fts WHERE id = ?`, [contactId]);
  await db.execute(
    `INSERT INTO contacts_fts(id, name, email, website, country, type, genres_text, persons_text)
     VALUES(?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      row.id,
      row.name || '',
      row.email || '',
      row.website || '',
      row.country || '',
      row.type || '',
      genresText,
      personsText,
    ]
  );
}

async function buildContact(db: any, id: string): Promise<Contact | null> {
  const [row] = await db.select(
    `SELECT id, name, country, email, website, type, verificationStatus, verificationDetails, isFavorite, doNotContact
     FROM contacts WHERE id = ? LIMIT 1`,
    [id]
  );
  if (!row) return null;
  const genres = await db.select(
    `SELECT genreName FROM contact_genres WHERE contactId = ?`,
    [id]
  );
  const persons = await db.select(
    `SELECT name, position, email FROM contact_persons WHERE contactId = ?`,
    [id]
  );
  const socials = await db.select(
    `SELECT platform, url FROM social_links WHERE contactId = ?`,
    [id]
  );
  const socialMap: Record<string, string> = {};
  for (const s of socials) socialMap[s.platform] = s.url;
  return {
    id: String(row.id),
    name: String(row.name),
    country: String(row.country),
    email: String(row.email),
    website: row.website ? String(row.website) : undefined,
    type: row.type,
    verificationStatus: row.verificationStatus || 'unverified',
    verificationDetails: row.verificationDetails || undefined,
    isFavorite: !!row.isFavorite,
    doNotContact: !!row.doNotContact,
    genres: (genres || []).map((g: any) => g.genreName as string),
    contactPersons: (persons || []).map((p: any) => ({
      name: String(p.name || ''),
      position: p.position ? String(p.position) : '',
      email: p.email ? String(p.email) : ''
    })),
    socials: Object.keys(socialMap).length ? (socialMap as any) : undefined,
  } as Contact;
}

export async function searchContacts(
  term: string,
  country?: string,
  options?: { verificationStatus?: 'unverified' | 'verifying' | 'verified' | 'not_found' | 'error' }
): Promise<Contact[]> {
  const db = await getSqlDb();
  const q = (term || '').trim();
  // Fallback to Dexie in web
  if (!db) {
    const all = await dexieDb.getAllContacts();
    let filtered = all;
    if (country && country !== 'All') {
      filtered = filtered.filter(c => c.country === country);
    }
    if (options?.verificationStatus) {
      filtered = filtered.filter(c => (c.verificationStatus || 'unverified') === options.verificationStatus);
    }
    if (q) {
      const lq = q.toLowerCase();
      filtered = filtered.filter(contact =>
        Object.entries(contact).some(([key, value]) => {
          if (key === 'genres' && Array.isArray(value)) {
            return value.some(g => g.toLowerCase().includes(lq));
          }
          if (typeof value === 'string' || typeof value === 'number') {
            return String(value).toLowerCase().includes(lq);
          }
          return false;
        })
      );
    }
    return filtered;
  }

  type Filter = { column?: string; phrase?: string; token?: string };
  const parseQuery = (input: string): Filter[] => {
    const filters: Filter[] = [];
    const re = /(\w+):\"([^\"]+)\"|(\w+):([^\s]+)|\"([^\"]+)\"|([^\s]+)/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(input)) !== null) {
      if (m[1] && m[2]) {
        // column:"phrase"
        filters.push({ column: m[1].toLowerCase(), phrase: m[2] });
      } else if (m[3] && m[4]) {
        // column:token
        filters.push({ column: m[3].toLowerCase(), token: m[4] });
      } else if (m[5]) {
        // "phrase"
        filters.push({ phrase: m[5] });
      } else if (m[6]) {
        // token
        filters.push({ token: m[6] });
      }
    }
    return filters;
  };

  const esc = (s: string) => s.replace(/"/g, '');
  const colMap: Record<string, string> = {
    name: 'name',
    email: 'email',
    website: 'website',
    country: 'country',
    type: 'type',
    genre: 'genres_text',
    genres: 'genres_text',
    person: 'persons_text',
    persons: 'persons_text',
  };

  const parts: string[] = [];
  const filters = parseQuery(q);
  for (const f of filters) {
    if (f.column) {
      const col = colMap[f.column] || f.column;
      if (f.phrase) {
        parts.push(`${col}:"${esc(f.phrase)}"`);
      } else if (f.token) {
        parts.push(`${col}:${esc(f.token)}*`);
      }
    } else if (f.phrase) {
      // phrase across all columns -> OR chain
      parts.push(
        `name:"${esc(f.phrase)}" OR email:"${esc(f.phrase)}" OR website:"${esc(f.phrase)}" OR country:"${esc(f.phrase)}" OR type:"${esc(f.phrase)}" OR genres_text:"${esc(f.phrase)}" OR persons_text:"${esc(f.phrase)}"`
      );
    } else if (f.token) {
      const t = esc(f.token);
      parts.push(
        `name:${t}* OR email:${t}* OR website:${t}* OR country:${t}* OR type:${t}* OR genres_text:${t}* OR persons_text:${t}*`
      );
    }
  }

  const matchExpr = parts.join(' AND ');
  let ids: { id: string }[] = [];
  const hasCountryFilter = country && country !== 'All';
  const hasVerification = !!options?.verificationStatus;
  const params: any[] = [];
  if (matchExpr) {
    let sql = `SELECT c.id FROM contacts c JOIN contacts_fts f ON f.id = c.id WHERE f MATCH ?`;
    params.push(matchExpr);
    if (hasCountryFilter) {
      sql += ` AND c.country = ?`;
      params.push(country);
    }
    if (hasVerification) {
      sql += ` AND c.verificationStatus = ?`;
      params.push(options!.verificationStatus);
    }
    ids = await db.select(sql, params);
  } else {
    let sql = `SELECT id FROM contacts`;
    const where: string[] = [];
    const wparams: any[] = [];
    if (hasCountryFilter) { where.push(`country = ?`); wparams.push(country); }
    if (hasVerification) { where.push(`verificationStatus = ?`); wparams.push(options!.verificationStatus); }
    if (where.length) sql += ` WHERE ` + where.join(' AND ');
    ids = await db.select(sql, wparams);
  }

  const results: Contact[] = [];
  for (const r of ids) {
    const c = await buildContact(db, String((r as any).id));
    if (c) results.push(c);
  }
  return results;
}

// -------------------
// Validation & helpers
// -------------------

const allowedTypes = new Set<string>(Object.values(ContactType));
const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i;
const urlRe = /^(https?:\/\/)[\w.-]+(?:\.[\w\.-]+)+(?:[\w\-\._~:\/?#[\]@!$&'()*+,;=.]+)?$/i;

function sanitizeAndValidate(raw: Contact): Contact {
  const c: Contact = {
    ...raw,
    id: String(raw.id).trim(),
    name: String(raw.name).trim(),
    country: String(raw.country).trim(),
    email: raw.email ? String(raw.email).trim() : '',
    website: raw.website ? String(raw.website).trim() : undefined,
    type: raw.type,
    verificationStatus: raw.verificationStatus || 'unverified',
    doNotContact: !!raw.doNotContact,
    isFavorite: !!(raw as any).isFavorite,
    genres: Array.isArray(raw.genres) ? raw.genres.map(g => String(g).trim()).filter(Boolean) : [],
    contactPersons: Array.isArray(raw.contactPersons)
      ? raw.contactPersons.map(p => ({
          name: String(p.name || '').trim(),
          position: String(p.position || '').trim(),
          email: String(p.email || '').trim(),
        }))
      : [],
    socials: raw.socials ? Object.fromEntries(Object.entries(raw.socials).map(([k, v]) => [k, String(v || '').trim()]).filter(([, v]) => v)) as any : undefined,
  };

  if (!c.id) throw new Error('Contact id is required');
  if (!c.name) throw new Error('Contact name is required');
  if (!c.country) throw new Error('Contact country is required');
  if (!allowedTypes.has(c.type as any)) throw new Error('Invalid contact type');
  if (c.email && !emailRe.test(c.email)) throw new Error('Invalid email format');
  if (c.website && !urlRe.test(c.website)) throw new Error('Invalid website URL');
  return c;
}

async function verifyIndexes(db: any) {
  try {
    const plans = await Promise.all([
      db.select(`EXPLAIN QUERY PLAN SELECT id FROM contacts WHERE email = ?`, ['test@example.com']),
      db.select(`EXPLAIN QUERY PLAN SELECT id FROM contacts WHERE country = ?`, ['USA']),
      db.select(`EXPLAIN QUERY PLAN SELECT id FROM contacts WHERE type = ?`, ['Radio Station']),
    ]);
    // Log once for diagnostics
    console.debug('[DB] Index plans:', plans.map(p => p.map((r: any) => r.detail || JSON.stringify(r))));
  } catch {
    // ignore
  }
}

async function maybeRebuildFts(db: any) {
  try {
    const cnt = await db.select(`SELECT (SELECT COUNT(*) AS c FROM contacts) as c1, (SELECT COUNT(*) AS c FROM contacts_fts) as c2`);
    const c1 = Number(cnt?.[0]?.c1 || 0);
    const c2 = Number(cnt?.[0]?.c2 || 0);
    if (c1 > 0 && c2 === 0) {
      // Rebuild FTS table
      const ids = await db.select(`SELECT id FROM contacts`);
      for (const r of ids) {
        await upsertFts(db, String((r as any).id));
      }
      console.debug('[DB] Rebuilt contacts_fts from contacts');
    }
  } catch {
    // ignore
  }
}
