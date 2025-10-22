export enum ContactType {
    RadioStation = 'Radio Station',
    DJRecordPool = 'DJ Record Pool',
    IndividualDJ = 'Individual DJ',
    MusicReviewer = 'Music Reviewer',
    Publication = 'Publication',
    PlaylistCurator = 'Playlist Curator',
    BackgroundMusicProvider = 'Background Music Provider',
    GigVenue = 'Gig Venue'
}

export type VerificationStatus = 'unverified' | 'verifying' | 'verified' | 'not_found' | 'error';

export type SocialPlatform = 'facebook' | 'twitter' | 'instagram' | 'youtube' | 'spotify' | 'soundcloud' | 'bandcamp' | 'tiktok';

export interface ContactPerson {
    name: string;
    position: string;
    email: string;
}

export interface Contact {
    id: string;
    name: string;
    country: string;
    genres: string[];
    email: string;
    website?: string;
    type: ContactType;
    verificationStatus?: VerificationStatus;
    verificationDetails?: string;
    isFavorite?: boolean;
    socials?: {
        [key in SocialPlatform]?: string;
    };
    contactPersons?: ContactPerson[];
    doNotContact?: boolean;
}

export enum View {
    Database = 'database',
    Shortlist = 'shortlist',
    Reporting = 'reporting',
    Campaign = 'campaign',
    Settings = 'settings'
}

export type SortConfig = {
    key: keyof Contact;
    direction: 'ascending' | 'descending';
} | null;
