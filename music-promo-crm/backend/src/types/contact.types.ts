export type ContactStatus = 'active' | 'inactive' | 'lead' | 'customer' | 'influencer';
export type VerificationStatus = 'unverified' | 'pending' | 'verified' | 'failed';

export interface SocialMedia {
  platform: 'facebook' | 'twitter' | 'instagram' | 'linkedin' | 'youtube' | 'tiktok' | 'other';
  url: string;
}

export interface IContact {
  _id?: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  company?: string;
  position?: string;
  country: string;
  city?: string;
  address?: string;
  postalCode?: string;
  website?: string;
  socialMedia?: SocialMedia[];
  tags: string[];
  notes?: string;
  status: ContactStatus;
  verificationStatus: VerificationStatus;
  lastContacted?: Date;
  nextFollowUp?: Date;
  createdBy: string;
  updatedBy: string;
  isFavorite: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface ContactQueryParams {
  search?: string;
  status?: ContactStatus;
  verificationStatus?: VerificationStatus;
  tags?: string[];
  country?: string;
  isFavorite?: boolean;
  sort?: string;
  page?: number;
  limit?: number;
}

export interface ContactStats {
  _id: ContactStatus;
  count: number;
}

export interface ContactResponse {
  status: 'success' | 'error';
  results?: number;
  total?: number;
  data: {
    contact?: IContact;
    contacts?: IContact[];
    stats?: ContactStats[];
  };
  message?: string;
}
